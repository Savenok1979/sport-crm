import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const athletesRouter = Router();
athletesRouter.use(requireAuth);

// GET /api/v1/athletes?search=&groupId=&status=
athletesRouter.get("/", async (req, res) => {
  const { organizationId, role, employeeId } = req.employee!;
  const { search, groupId, status } = req.query as Record<string, string | undefined>;

  // Trainers only ever see athletes in groups they coach (section 3 scope rule).
  let groupIdFilter: string[] | undefined;
  if (role === "TRAINER") {
    const coachGroups = await prisma.groupCoach.findMany({ where: { employeeId }, select: { groupId: true } });
    groupIdFilter = coachGroups.map((g) => g.groupId);
  }

  const athletes = await prisma.athlete.findMany({
    where: {
      organizationId,
      ...(status ? { status: status as any } : {}),
      ...(search ? { fullName: { contains: search } } : {}),
      athleteGroups: {
        some: {
          status: "ACTIVE",
          ...(groupId ? { groupId } : {}),
          ...(groupIdFilter ? { groupId: { in: groupIdFilter } } : {}),
        },
      },
    },
    include: { athleteGroups: { where: { status: "ACTIVE" }, include: { group: true } } },
    orderBy: { fullName: "asc" },
  });

  res.json(athletes);
});

athletesRouter.get("/:id", async (req, res) => {
  const { organizationId } = req.employee!;
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

  res.status(201).json(athlete);
});
