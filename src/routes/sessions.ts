import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { assertAthleteInScope, resolveGroupScope, resolveVenueScope } from "../lib/scope";

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);

// GET /api/v1/sessions?from=&to=&venueId=&groupId=&coachEmployeeId=&status=
// Week/Month schedule view (section 11: "Расписание — Неделя/Месяц; фильтры").
sessionsRouter.get("/", async (req, res) => {
  const { employeeId, role } = req.employee!;
  const { venueId, groupId, coachEmployeeId, status } = req.query as Record<string, string | undefined>;
  const now = new Date();
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const groupScope = await resolveGroupScope(req.employee!);
  const venueScope = await resolveVenueScope(req.employee!);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      startsAt: { gte: from, lte: to },
      ...(venueId ? { venueId } : {}),
      ...(groupId ? { groupId } : {}),
      ...(coachEmployeeId ? { coachEmployeeId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(role === "TRAINER" ? { coachEmployeeId: employeeId } : {}),
      ...(groupScope ? { groupId: { in: groupScope } } : {}),
      ...(venueScope ? { venueId: { in: venueScope } } : {}),
    },
    include: { group: true, venue: true, zone: true },
    orderBy: { startsAt: "asc" },
  });

  res.json(sessions);
});

const cancelSchema = z.object({ reason: z.string().min(1) });

// POST /api/v1/sessions/:id/cancel — section 7.3: trainers may only cancel
// for force-majeure, and a reason is always mandatory. No automatic
// financial recalculation follows from a cancellation.
sessionsRouter.post("/:id/cancel", async (req, res) => {
  const { employeeId, role } = req.employee!;
  const parsed = cancelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const session = await prisma.trainingSession.findUnique({ where: { id: req.params.id } });
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (role === "TRAINER" && session.coachEmployeeId !== employeeId) {
    return res.status(403).json({ error: "Not your session" });
  }

  const updated = await prisma.trainingSession.update({
    where: { id: session.id },
    data: { status: "CANCELLED", cancelReason: parsed.data.reason },
  });
  res.json(updated);
});

// ---------------------------------------------------------------
// Individual trainings (section 8.1/8.2/12): one-off, creates exactly one
// Charge once status becomes HELD.
// ---------------------------------------------------------------

const createIndividualSchema = z.object({
  athleteId: z.string(),
  coachEmployeeId: z.string().optional(),
  venueId: z.string().optional(),
  scheduledAt: z.string().datetime(),
  price: z.number().int().positive(),
});

sessionsRouter.post("/individual", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = createIndividualSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (!(await assertAthleteInScope(req.employee!, parsed.data.athleteId))) {
    return res.status(404).json({ error: "Athlete not found" });
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);

  // Conflict check (section 7.2): the same coach can't be double-booked at
  // the same instant across a group session or another individual training.
  if (parsed.data.coachEmployeeId) {
    const conflict = await prisma.trainingSession.findFirst({
      where: { coachEmployeeId: parsed.data.coachEmployeeId, startsAt: scheduledAt, status: { not: "CANCELLED" } },
    });
    const individualConflict = await prisma.individualTraining.findFirst({
      where: { coachEmployeeId: parsed.data.coachEmployeeId, scheduledAt, status: { not: "CANCELLED" } },
    });
    if (conflict || individualConflict) {
      return res.status(409).json({ error: "Coach already has a session at this time" });
    }
  }

  const training = await prisma.individualTraining.create({
    data: {
      organizationId,
      athleteId: parsed.data.athleteId,
      coachEmployeeId: parsed.data.coachEmployeeId,
      venueId: parsed.data.venueId,
      scheduledAt,
      price: parsed.data.price,
    },
  });
  res.status(201).json(training);
});

sessionsRouter.get("/individual", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const trainings = await prisma.individualTraining.findMany({
    where: { organizationId },
    include: { athlete: true, charge: true },
    orderBy: { scheduledAt: "desc" },
  });
  res.json(trainings);
});

// POST /api/v1/sessions/individual/:id/hold — marks it held and creates the
// one-off Charge (idempotent: the unique Charge.individualTrainingId means a
// second call is a no-op on the charge, section 13).
sessionsRouter.post("/individual/:id/hold", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const training = await prisma.individualTraining.findFirst({ where: { id: req.params.id, organizationId } });
  if (!training) return res.status(404).json({ error: "Individual training not found" });

  const updated = await prisma.$transaction(async (tx) => {
    const held = await tx.individualTraining.update({ where: { id: training.id }, data: { status: "HELD" } });
    const existingCharge = await tx.charge.findUnique({ where: { individualTrainingId: held.id } });
    if (!existingCharge) {
      await tx.charge.create({
        data: {
          organizationId,
          athleteId: held.athleteId,
          individualTrainingId: held.id,
          period: held.scheduledAt.toISOString().slice(0, 10),
          baseAmount: held.price,
          totalAmount: held.price,
          dueDate: held.scheduledAt,
          isManual: true,
        },
      });
    }
    return held;
  });

  res.json(updated);
});

sessionsRouter.post("/individual/:id/cancel", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const training = await prisma.individualTraining.findFirst({ where: { id: req.params.id, organizationId } });
  if (!training) return res.status(404).json({ error: "Individual training not found" });
  const updated = await prisma.individualTraining.update({ where: { id: training.id }, data: { status: "CANCELLED" } });
  res.json(updated);
});
