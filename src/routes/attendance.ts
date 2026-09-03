import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { resolveVenueScope } from "../lib/scope";

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);

// GET /api/v1/attendance/today — trainer's "Сегодня" screen.
attendanceRouter.get("/today", async (req, res) => {
  const { employeeId, role } = req.employee!;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const venueScope = await resolveVenueScope(req.employee!);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      startsAt: { gte: start, lte: end },
      ...(role === "TRAINER" ? { coachEmployeeId: employeeId } : {}),
      ...(venueScope ? { venueId: { in: venueScope } } : {}),
      status: { not: "CANCELLED" },
    },
    include: {
      group: true,
      venue: true,
      attendances: { include: { athlete: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  // A freshly generated session has no Attendance rows at all — nothing is
  // marked yet. Merge in every active member of the group so the trainer has
  // a full roster to mark ("Отметить всех Был → изменить отсутствующих"),
  // not just whoever happens to already have a row.
  const withRoster = await Promise.all(
    sessions.map(async (session) => {
      const activeMembers = await prisma.athleteGroup.findMany({
        where: { groupId: session.groupId, status: "ACTIVE" },
        include: { athlete: true },
      });
      const marked = new Map(session.attendances.map((a) => [a.athleteId, a]));
      const attendances = activeMembers.map(
        (m) =>
          marked.get(m.athleteId) ?? {
            id: null,
            athleteId: m.athleteId,
            status: null,
            athlete: m.athlete,
          }
      );
      return { ...session, attendances };
    })
  );

  res.json(withRoster);
});

const markSchema = z.object({
  entries: z.array(z.object({ athleteId: z.string(), status: z.enum(["PRESENT", "ABSENT"]) })),
});

// POST /api/v1/attendance/sessions/:id/mark — bulk upsert of present/absent.
// Editable by the trainer until end of calendar day (section 7.4); after
// that only ADMINISTRATOR/OWNER — enforced here, not just hidden in the UI.
attendanceRouter.post("/sessions/:id/mark", async (req, res) => {
  const { employeeId, role } = req.employee!;
  const parsed = markSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const session = await prisma.trainingSession.findUnique({ where: { id: req.params.id } });
  if (!session) return res.status(404).json({ error: "Session not found" });

  if (role === "TRAINER") {
    const sameDay = new Date().toDateString() === session.startsAt.toDateString();
    if (!sameDay) return res.status(403).json({ error: "Attendance for this day is locked for trainers" });
  }

  await prisma.$transaction(
    parsed.data.entries.map((e) =>
      prisma.attendance.upsert({
        where: { trainingSessionId_athleteId: { trainingSessionId: session.id, athleteId: e.athleteId } },
        update: { status: e.status, editedAt: new Date() },
        create: {
          trainingSessionId: session.id,
          athleteId: e.athleteId,
          status: e.status,
          markedByEmployeeId: employeeId,
        },
      })
    )
  );

  res.json({ ok: true });
});

// POST /api/v1/attendance/sessions/:id/complete
attendanceRouter.post("/sessions/:id/complete", async (req, res) => {
  const session = await prisma.trainingSession.update({
    where: { id: req.params.id },
    data: { status: "HELD", attendanceCompletedAt: new Date() },
  });

  // Recompute "last visit" for everyone marked PRESENT — cheap enough at MVP
  // scale; move to a queued job once venues/athletes grow (section 15).
  const present = await prisma.attendance.findMany({
    where: { trainingSessionId: session.id, status: "PRESENT" },
  });
  // In a fuller build this would update a denormalized lastVisitAt on Athlete
  // and evaluate the configurable long-absence threshold (section 7.4/13).

  res.json({ session, presentCount: present.length });
});
