import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { resolveGroupScope, resolveVenueScope } from "../lib/scope";

export const mailingsRouter = Router();
mailingsRouter.use(requireAuth);
// Trainers only ever mail their own groups; owner/administrator manage templates too.
mailingsRouter.use(requireRole("OWNER", "ADMINISTRATOR", "TRAINER"));

// ---------------------------------------------------------------
// Templates
// ---------------------------------------------------------------

mailingsRouter.get("/templates", async (req, res) => {
  const { organizationId } = req.employee!;
  const templates = await prisma.messageTemplate.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } });
  res.json(templates);
});

const templateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1), // supports {athlete} {group} {venue} {coach} {amount} {debt} {period} {due_date}
});

mailingsRouter.post("/templates", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const template = await prisma.messageTemplate.create({
    data: { organizationId, kind: "CUSTOM", ...parsed.data },
  });
  res.status(201).json(template);
});

mailingsRouter.patch("/templates/:id", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = templateSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.messageTemplate.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) return res.status(404).json({ error: "Template not found" });
  if (existing.kind === "SYSTEM") return res.status(403).json({ error: "System templates cannot be edited" });

  const template = await prisma.messageTemplate.update({ where: { id: existing.id }, data: parsed.data });
  res.json(template);
});

function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

const previewSchema = z.object({ athleteId: z.string().optional() });

// POST /api/v1/mailings/templates/:id/preview — renders on a sample/real athlete.
mailingsRouter.post("/templates/:id/preview", async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const template = await prisma.messageTemplate.findFirst({ where: { id: req.params.id, organizationId } });
  if (!template) return res.status(404).json({ error: "Template not found" });

  let vars: Record<string, string> = {
    athlete: "Иванов Иван",
    group: "Волейбол 8–10 · А",
    venue: "Сокольники",
    coach: "Игорь Соколов",
    amount: "3 200,00",
    debt: "0,00",
    period: new Date().toISOString().slice(0, 7),
    due_date: new Date().toLocaleDateString("ru-RU"),
  };

  if (parsed.data.athleteId) {
    const athlete = await prisma.athlete.findFirst({
      where: { id: parsed.data.athleteId, organizationId },
      include: { athleteGroups: { where: { status: "ACTIVE" }, include: { group: { include: { venue: true } } } } },
    });
    if (athlete) {
      const ag = athlete.athleteGroups[0];
      vars = {
        ...vars,
        athlete: athlete.fullName,
        group: ag?.group.name ?? vars.group,
        venue: ag?.group.venue.name ?? vars.venue,
      };
    }
  }

  res.json({
    subject: template.subject ? renderTemplate(template.subject, vars) : null,
    body: renderTemplate(template.body, vars),
  });
});

// ---------------------------------------------------------------
// Mailings (mass send) + history
// ---------------------------------------------------------------

const mailingSchema = z.object({
  templateId: z.string(),
  scopeType: z.enum(["ORGANIZATION", "VENUE", "SPORT", "GROUP", "SELECTED"]),
  scopeId: z.string().optional(), // venueId / sportTypeId / groupId, depending on scopeType
  athleteIds: z.array(z.string()).optional(), // required when scopeType = SELECTED
});

// POST /api/v1/mailings — resolves recipients, dedupes by e-mail, logs one
// CommunicationLog per recipient. No real e-mail provider yet (README "next
// steps"): messages are recorded as SENT immediately to simulate delivery.
mailingsRouter.post("/", async (req, res) => {
  const { organizationId, employeeId, role } = req.employee!;
  const parsed = mailingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { templateId, scopeType, scopeId, athleteIds } = parsed.data;

  const template = await prisma.messageTemplate.findFirst({ where: { id: templateId, organizationId } });
  if (!template) return res.status(404).json({ error: "Template not found" });

  // Section 9: trainer only their own groups; administrator only their venues.
  const groupScope = await resolveGroupScope(req.employee!);
  const venueScope = await resolveVenueScope(req.employee!);

  if (role === "TRAINER" && scopeType !== "GROUP" && scopeType !== "SELECTED") {
    return res.status(403).json({ error: "Trainers may only mail their own groups" });
  }
  if (scopeType === "GROUP" && groupScope && (!scopeId || !groupScope.includes(scopeId))) {
    return res.status(403).json({ error: "Group is outside your scope" });
  }
  if (scopeType === "VENUE" && venueScope && (!scopeId || !venueScope.includes(scopeId))) {
    return res.status(403).json({ error: "Venue is outside your scope" });
  }
  if (scopeType === "ORGANIZATION" && role !== "OWNER") {
    return res.status(403).json({ error: "Only the owner may mail the whole organization" });
  }
  if (scopeType === "SPORT" && role !== "OWNER") {
    return res.status(403).json({ error: "Only the owner may mail by sport type" });
  }

  let athleteWhere: any;
  if (scopeType === "ORGANIZATION") athleteWhere = { organizationId };
  else if (scopeType === "VENUE") athleteWhere = { organizationId, athleteGroups: { some: { group: { venueId: scopeId } } } };
  else if (scopeType === "SPORT") athleteWhere = { organizationId, athleteGroups: { some: { group: { sportTypeId: scopeId } } } };
  else if (scopeType === "GROUP") athleteWhere = { organizationId, athleteGroups: { some: { groupId: scopeId } } };
  else {
    if (!athleteIds?.length) return res.status(400).json({ error: "athleteIds is required for SELECTED scope" });
    const scopedIds = groupScope
      ? (await prisma.athleteGroup.findMany({ where: { athleteId: { in: athleteIds }, groupId: { in: groupScope } }, select: { athleteId: true } })).map((a) => a.athleteId)
      : athleteIds;
    athleteWhere = { organizationId, id: { in: [...new Set(scopedIds)] } };
  }

  const athletes = await prisma.athlete.findMany({
    where: athleteWhere,
    include: { representatives: { where: { receivesOrganizationalMessages: true }, include: { representative: true } } },
  });

  const mailing = await prisma.mailing.create({
    data: { organizationId, templateId, scopeType, scopeId, createdByEmployeeId: employeeId },
  });

  const seenEmails = new Set<string>();
  const logsData: { mailingId: string; athleteId: string; representativeId: string; channel: string; status: "SENT"; sentAt: Date }[] = [];
  for (const athlete of athletes) {
    for (const link of athlete.representatives) {
      const email = link.representative.email;
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      logsData.push({
        mailingId: mailing.id,
        athleteId: athlete.id,
        representativeId: link.representativeId,
        channel: "EMAIL",
        status: "SENT",
        sentAt: new Date(),
      });
    }
  }
  if (logsData.length) await prisma.communicationLog.createMany({ data: logsData });

  res.status(201).json({ mailing, recipientCount: logsData.length, athleteCount: athletes.length });
});

// GET /api/v1/mailings/history?athleteId=&mailingId=
mailingsRouter.get("/history", async (req, res) => {
  const { organizationId, role, employeeId } = req.employee!;
  const { athleteId, mailingId } = req.query as Record<string, string | undefined>;
  const groupScope = await resolveGroupScope(req.employee!);

  const logs = await prisma.communicationLog.findMany({
    where: {
      mailing: { organizationId, ...(role === "TRAINER" ? { createdByEmployeeId: employeeId } : {}) },
      ...(athleteId ? { athleteId } : {}),
      ...(mailingId ? { mailingId } : {}),
      ...(groupScope ? { athlete: { athleteGroups: { some: { groupId: { in: groupScope } } } } } : {}),
    },
    include: { athlete: true, mailing: { include: { template: true } } },
    orderBy: { sentAt: "desc" },
    take: 200,
  });
  res.json(logs);
});
