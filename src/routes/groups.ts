import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { resolveGroupScope } from "../lib/scope";

export const groupsRouter = Router();
groupsRouter.use(requireAuth);

groupsRouter.get("/", async (req, res) => {
  const { organizationId } = req.employee!;
  const groupScope = await resolveGroupScope(req.employee!);
  const groups = await prisma.group.findMany({
    where: { organizationId, status: "ACTIVE", ...(groupScope ? { id: { in: groupScope } } : {}) },
    include: {
      venue: true,
      sportType: true,
      coaches: { include: { employee: { include: { user: true } } } },
      _count: { select: { athleteGroups: true } },
    },
  });
  res.json(groups);
});

groupsRouter.get("/:id", async (req, res) => {
  const { organizationId } = req.employee!;
  const groupScope = await resolveGroupScope(req.employee!);
  if (groupScope && !groupScope.includes(req.params.id)) return res.status(404).json({ error: "Group not found" });

  const group = await prisma.group.findFirst({
    where: { id: req.params.id, organizationId },
    include: {
      venue: true,
      sportType: true,
      coaches: { include: { employee: { include: { user: true } } } },
      scheduleRules: true,
      groupTariffs: { include: { tariff: true } },
      _count: { select: { athleteGroups: true } },
    },
  });
  if (!group) return res.status(404).json({ error: "Group not found" });
  res.json(group);
});

const createGroupSchema = z.object({
  venueId: z.string(),
  sportTypeId: z.string(),
  name: z.string().min(1),
  participantLimit: z.number().int().positive().optional(),
});

groupsRouter.post("/", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const group = await prisma.group.create({ data: { organizationId, ...parsed.data } });
  res.status(201).json(group);
});

const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  participantLimit: z.number().int().positive().nullable().optional(),
});

groupsRouter.patch("/:id", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const groupScope = await resolveGroupScope(req.employee!);
  if (groupScope && !groupScope.includes(req.params.id)) return res.status(404).json({ error: "Group not found" });
  const parsed = updateGroupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.group.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) return res.status(404).json({ error: "Group not found" });

  const group = await prisma.group.update({ where: { id: existing.id }, data: parsed.data });
  res.json(group);
});

groupsRouter.post("/:id/archive", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const existing = await prisma.group.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) return res.status(404).json({ error: "Group not found" });
  const group = await prisma.group.update({ where: { id: existing.id }, data: { status: "ARCHIVED" } });
  res.json(group);
});

const groupCoachSchema = z.object({ employeeId: z.string(), coachRole: z.string().optional() });

groupsRouter.post("/:id/coaches", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = groupCoachSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const group = await prisma.group.findFirst({ where: { id: req.params.id, organizationId } });
  if (!group) return res.status(404).json({ error: "Group not found" });

  const coach = await prisma.groupCoach.create({
    data: { groupId: group.id, employeeId: parsed.data.employeeId, coachRole: parsed.data.coachRole ?? "MAIN" },
    include: { employee: { include: { user: true } } },
  });
  res.status(201).json(coach);
});

const attachTariffSchema = z.object({ tariffId: z.string() });

// POST /api/v1/groups/:id/tariffs — which tariffs are offered for this group (section 4/8.1).
groupsRouter.post("/:id/tariffs", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = attachTariffSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const group = await prisma.group.findFirst({ where: { id: req.params.id, organizationId } });
  if (!group) return res.status(404).json({ error: "Group not found" });

  const groupTariff = await prisma.groupTariff.create({
    data: { groupId: group.id, tariffId: parsed.data.tariffId },
    include: { tariff: true },
  });
  res.status(201).json(groupTariff);
});

groupsRouter.delete("/:id/tariffs/:tariffId", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const group = await prisma.group.findFirst({ where: { id: req.params.id, organizationId } });
  if (!group) return res.status(404).json({ error: "Group not found" });
  await prisma.groupTariff.deleteMany({ where: { groupId: group.id, tariffId: req.params.tariffId } });
  res.json({ ok: true });
});

const scheduleRuleSchema = z.object({
  groupId: z.string(),
  venueId: z.string(),
  zoneId: z.string().optional(),
  coachEmployeeId: z.string().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string(), // "17:00"
  endTime: z.string(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
});

// POST /api/v1/groups/schedule-rules
groupsRouter.post("/schedule-rules", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const parsed = scheduleRuleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const rule = await prisma.scheduleRule.create({
    data: {
      ...parsed.data,
      effectiveFrom: new Date(parsed.data.effectiveFrom),
      effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : undefined,
    },
  });
  res.status(201).json(rule);
});

// POST /api/v1/groups/schedule-rules/:id/generate?weeks=8
// Generates concrete TrainingSessions from a recurring rule. Safe to re-run:
// it skips dates that already have a session for this rule.
groupsRouter.post("/schedule-rules/:id/generate", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const weeks = Number(req.query.weeks ?? 8);
  const rule = await prisma.scheduleRule.findUnique({ where: { id: req.params.id } });
  if (!rule) return res.status(404).json({ error: "Schedule rule not found" });

  const existing = await prisma.trainingSession.findMany({
    where: { scheduleRuleId: rule.id },
    select: { startsAt: true },
  });
  const existingDates = new Set(existing.map((s) => s.startsAt.toDateString()));

  const [sh, sm] = rule.startTime.split(":").map(Number);
  const [eh, em] = rule.endTime.split(":").map(Number);

  const toCreate: { startsAt: Date; endsAt: Date }[] = [];
  const from = new Date(Math.max(rule.effectiveFrom.getTime(), Date.now()));
  for (let i = 0; i < weeks * 7; i++) {
    const day = new Date(from);
    day.setDate(day.getDate() + i);
    if (day.getDay() !== ((rule.dayOfWeek + 1) % 7)) continue; // 0=Mon in our rule vs JS 0=Sun
    if (rule.effectiveTo && day > rule.effectiveTo) break;
    const startsAt = new Date(day.setHours(sh, sm, 0, 0));
    const endsAt = new Date(new Date(startsAt).setHours(eh, em, 0, 0));
    if (!existingDates.has(startsAt.toDateString())) toCreate.push({ startsAt, endsAt });
  }

  const created = await prisma.$transaction(
    toCreate.map((d) =>
      prisma.trainingSession.create({
        data: {
          scheduleRuleId: rule.id,
          groupId: rule.groupId,
          venueId: rule.venueId,
          zoneId: rule.zoneId,
          coachEmployeeId: rule.coachEmployeeId,
          startsAt: d.startsAt,
          endsAt: d.endsAt,
        },
      })
    )
  );

  res.status(201).json({ createdCount: created.length });
});
