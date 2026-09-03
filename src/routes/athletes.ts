import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { assertAthleteInScope, resolveGroupScope } from "../lib/scope";

export const athletesRouter = Router();
athletesRouter.use(requireAuth);

// GET /api/v1/athletes?search=&groupId=&status=
athletesRouter.get("/", async (req, res) => {
  const { organizationId } = req.employee!;
  const { search, groupId, status } = req.query as Record<string, string | undefined>;

  // Administrators only see athletes at their assigned venues, trainers only
  // in groups they coach (section 3 scope rule) — enforced here, not in the UI.
  const groupScope = await resolveGroupScope(req.employee!);

  const athletes = await prisma.athlete.findMany({
    where: {
      organizationId,
      ...(status ? { status: status as any } : {}),
      ...(search ? { fullName: { contains: search } } : {}),
      athleteGroups: {
        some: {
          status: "ACTIVE",
          ...(groupId ? { groupId } : {}),
          ...(groupScope ? { groupId: { in: groupScope } } : {}),
        },
      },
    },
    include: { athleteGroups: { where: { status: "ACTIVE" }, include: { group: true } } },
    orderBy: { fullName: "asc" },
  });

  res.json(athletes);
});

// Section 3: "Финансовые суммы" is Nо for TRAINER — enforced here, not just
// hidden client-side, so a trainer can never read money via this endpoint
// either (acceptance test 17).
athletesRouter.get("/:id", async (req, res) => {
  const { organizationId, role } = req.employee!;
  const canSeeFinance = role === "OWNER" || role === "ADMINISTRATOR";

  const athlete = await prisma.athlete.findFirst({
    where: { id: req.params.id, organizationId },
    include: {
      athleteGroups: { include: { group: true, athleteTariffs: { include: { tariff: true, discounts: true } } } },
      representatives: { include: { representative: true } },
      charges: { orderBy: { period: "desc" }, take: 12 },
      attendances: { orderBy: { markedAt: "desc" }, take: 20 },
    },
  });
  if (!athlete) return res.status(404).json({ error: "Athlete not found" });
  if (!(await assertAthleteInScope(req.employee!, athlete.id))) {
    return res.status(404).json({ error: "Athlete not found" });
  }

  if (!canSeeFinance) {
    (athlete as any).charges = undefined;
    (athlete as any).athleteGroups = athlete.athleteGroups.map((ag) => ({ ...ag, athleteTariffs: undefined }));
  }

  res.json(athlete);
});

const createAthleteSchema = z.object({
  fullName: z.string().min(1),
  dateOfBirth: z.string().datetime().optional(),
  parentName: z.string().optional(),
  phone: z.string().optional(),
  groupId: z.string().optional(),
});

// POST /api/v1/athletes/quick-add — trainer adds a child mid-training.
// Lands as PENDING_SETUP and must be completed by an administrator.
athletesRouter.post("/quick-add", async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = createAthleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const athlete = await prisma.athlete.create({
    data: {
      organizationId,
      fullName: parsed.data.fullName,
      dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : undefined,
      status: "PENDING_SETUP",
      startDate: new Date(),
    },
  });

  if (parsed.data.groupId) {
    await prisma.athleteGroup.create({
      data: { athleteId: athlete.id, groupId: parsed.data.groupId, startDate: new Date() },
    });
  }

  if (parsed.data.parentName || parsed.data.phone) {
    const representative = await prisma.representative.create({
      data: { organizationId, fullName: parsed.data.parentName || "Родитель", phone: parsed.data.phone },
    });
    await prisma.athleteRepresentative.create({
      data: { athleteId: athlete.id, representativeId: representative.id, isPrimary: true },
    });
  }

  res.status(201).json(athlete);
});

const updateAthleteSchema = z.object({
  fullName: z.string().min(1).optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.string().optional(),
  adminComment: z.string().optional(),
  coachComment: z.string().optional(),
});

// PATCH /api/v1/athletes/:id — basic card fields, not lifecycle (see below).
// Trainers may only ever touch their own free-text comment, never the
// admin-facing fields — enforced by stripping the body server-side rather
// than trusting the client to only send what it's allowed to.
athletesRouter.patch("/:id", async (req, res) => {
  const { organizationId, role } = req.employee!;
  const parsed = updateAthleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.athlete.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing || !(await assertAthleteInScope(req.employee!, existing.id))) {
    return res.status(404).json({ error: "Athlete not found" });
  }

  const data =
    role === "TRAINER"
      ? { coachComment: parsed.data.coachComment }
      : { ...parsed.data, dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : undefined };

  const athlete = await prisma.athlete.update({ where: { id: existing.id }, data });
  res.json(athlete);
});

const lifecycleSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("pause"), pauseStartDate: z.string().datetime(), pauseEndDate: z.string().datetime().optional() }),
  z.object({ action: z.literal("leave"), leftDate: z.string().datetime(), leftReason: z.string().min(1) }),
]);

// POST /api/v1/athletes/:id/lifecycle — section 5.4: pause stops future
// charges (see finance.ts monthly generation, which only bills ACTIVE
// athletes); leaving keeps existing debt untouched; nothing here deletes history.
athletesRouter.post("/:id/lifecycle", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = lifecycleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.athlete.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing || !(await assertAthleteInScope(req.employee!, existing.id))) {
    return res.status(404).json({ error: "Athlete not found" });
  }

  const data =
    parsed.data.action === "activate"
      ? { status: "ACTIVE" as const, pauseStartDate: null, pauseEndDate: null }
      : parsed.data.action === "pause"
        ? {
            status: "PAUSED" as const,
            pauseStartDate: new Date(parsed.data.pauseStartDate),
            pauseEndDate: parsed.data.pauseEndDate ? new Date(parsed.data.pauseEndDate) : null,
          }
        : {
            status: "LEFT" as const,
            leftDate: new Date(parsed.data.leftDate),
            leftReason: parsed.data.leftReason,
          };

  const athlete = await prisma.athlete.update({ where: { id: existing.id }, data });
  res.json(athlete);
});

const addToGroupSchema = z.object({
  groupId: z.string(),
  tariffId: z.string(),
  startDate: z.string().datetime(),
  transferFromAthleteGroupId: z.string().optional(), // closes the old membership (section 12 "Перевод группы")
});

// POST /api/v1/athletes/:id/groups — enroll into a group with a tariff.
athletesRouter.post("/:id/groups", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const parsed = addToGroupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { organizationId } = req.employee!;

  const athlete = await prisma.athlete.findFirst({ where: { id: req.params.id, organizationId } });
  if (!athlete || !(await assertAthleteInScope(req.employee!, athlete.id))) {
    return res.status(404).json({ error: "Athlete not found" });
  }

  const groupScope = await resolveGroupScope(req.employee!);
  if (groupScope && !groupScope.includes(parsed.data.groupId)) {
    return res.status(403).json({ error: "Group is outside your scope" });
  }

  const startDate = new Date(parsed.data.startDate);

  const athleteGroup = await prisma.$transaction(async (tx) => {
    if (parsed.data.transferFromAthleteGroupId) {
      await tx.athleteGroup.update({
        where: { id: parsed.data.transferFromAthleteGroupId },
        data: { status: "CLOSED", endDate: startDate },
      });
    }
    const created = await tx.athleteGroup.create({
      data: { athleteId: athlete.id, groupId: parsed.data.groupId, startDate },
    });
    await tx.athleteTariff.create({
      data: { athleteId: athlete.id, athleteGroupId: created.id, tariffId: parsed.data.tariffId, startDate },
    });
    return created;
  });

  res.status(201).json(athleteGroup);
});

const representativeSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  isPrimary: z.boolean().optional(),
  receivesFinancialMessages: z.boolean().optional(),
  receivesOrganizationalMessages: z.boolean().optional(),
});

// POST /api/v1/athletes/:id/representatives (section 5.3).
athletesRouter.post("/:id/representatives", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = representativeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const athlete = await prisma.athlete.findFirst({ where: { id: req.params.id, organizationId } });
  if (!athlete || !(await assertAthleteInScope(req.employee!, athlete.id))) {
    return res.status(404).json({ error: "Athlete not found" });
  }

  const representative = await prisma.representative.create({
    data: { organizationId, fullName: parsed.data.fullName, phone: parsed.data.phone, email: parsed.data.email },
  });
  const link = await prisma.athleteRepresentative.create({
    data: {
      athleteId: athlete.id,
      representativeId: representative.id,
      isPrimary: parsed.data.isPrimary ?? false,
      receivesFinancialMessages: parsed.data.receivesFinancialMessages ?? true,
      receivesOrganizationalMessages: parsed.data.receivesOrganizationalMessages ?? true,
    },
    include: { representative: true },
  });

  res.status(201).json(link);
});
