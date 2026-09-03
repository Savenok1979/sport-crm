import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { resolveGroupScope } from "../lib/scope";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

function parseRange(req: any): { from: Date; to: Date } {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = req.query.from ? new Date(String(req.query.from)) : defaultFrom;
  const to = req.query.to ? new Date(String(req.query.to)) : now;
  return { from, to };
}

// GET /api/v1/analytics/athletes — section 10.2 "Спортсмены".
// Active/new/left per KPI definitions in section 16.
analyticsRouter.get("/athletes", async (req, res) => {
  const { organizationId } = req.employee!;
  const { from, to } = parseRange(req);
  const groupScope = await resolveGroupScope(req.employee!);
  const groupFilter = groupScope ? { groupId: { in: groupScope } } : {};

  const [active, newCount, left, paused] = await Promise.all([
    prisma.athlete.count({
      where: { organizationId, status: "ACTIVE", athleteGroups: { some: { status: "ACTIVE", ...groupFilter } } },
    }),
    prisma.athlete.count({
      where: {
        organizationId,
        athleteGroups: { some: { startDate: { gte: from, lte: to }, ...groupFilter } },
      },
    }),
    prisma.athlete.count({
      where: { organizationId, status: "LEFT", leftDate: { gte: from, lte: to } },
    }),
    prisma.athlete.count({
      where: { organizationId, status: "PAUSED", ...(groupScope ? { athleteGroups: { some: groupFilter } } : {}) },
    }),
  ]);

  res.json({ from, to, active, new: newCount, left, paused });
});

// GET /api/v1/analytics/attendance — average rate, best/worst groups,
// unfilled sessions, long-absence count. Cancelled sessions excluded from
// the denominator per section 16.
analyticsRouter.get("/attendance", async (req, res) => {
  const { organizationId } = req.employee!;
  const { from, to } = parseRange(req);
  const groupScope = await resolveGroupScope(req.employee!);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      startsAt: { gte: from, lte: to },
      status: { not: "CANCELLED" },
      group: { organizationId },
      ...(groupScope ? { groupId: { in: groupScope } } : {}),
    },
    include: { attendances: true, group: true },
  });

  const byGroup = new Map<string, { name: string; present: number; total: number }>();
  let unfilled = 0;
  for (const s of sessions) {
    if (s.status === "HELD" && !s.attendanceCompletedAt) unfilled++;
    const entry = byGroup.get(s.groupId) ?? { name: s.group.name, present: 0, total: 0 };
    entry.present += s.attendances.filter((a) => a.status === "PRESENT").length;
    entry.total += s.attendances.length;
    byGroup.set(s.groupId, entry);
  }

  const groupRates = [...byGroup.entries()].map(([groupId, v]) => ({
    groupId,
    name: v.name,
    rate: v.total ? Math.round((v.present / v.total) * 1000) / 10 : null,
  }));
  groupRates.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));

  const totals = sessions.reduce(
    (acc, s) => {
      acc.present += s.attendances.filter((a) => a.status === "PRESENT").length;
      acc.total += s.attendances.length;
      return acc;
    },
    { present: 0, total: 0 }
  );

  res.json({
    from,
    to,
    averageRate: totals.total ? Math.round((totals.present / totals.total) * 1000) / 10 : null,
    unfilledSessions: unfilled,
    bestGroups: groupRates.slice(0, 5),
    worstGroups: groupRates.slice(-5).reverse(),
  });
});

// GET /api/v1/analytics/finance — accrued/paid/debt/collectability + aging
// (section 16: collectability uses PaymentAllocation, not raw cash received).
analyticsRouter.get("/finance", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const { from, to } = parseRange(req);
  const groupScope = await resolveGroupScope(req.employee!);

  const charges = await prisma.charge.findMany({
    where: {
      organizationId,
      createdAt: { gte: from, lte: to },
      ...(groupScope ? { athlete: { athleteGroups: { some: { groupId: { in: groupScope } } } } } : {}),
    },
    include: { allocations: true },
  });

  const accrued = charges.reduce((s, c) => s + c.totalAmount, 0);
  const paid = charges.reduce((s, c) => s + c.allocations.reduce((sa, a) => sa + a.amount, 0), 0);
  const debt = accrued - paid;

  const now = Date.now();
  const aging = { "1-7": 0, "8-30": 0, "30+": 0 };
  for (const c of charges) {
    const remaining = c.totalAmount - c.allocations.reduce((s, a) => s + a.amount, 0);
    if (remaining <= 0 || c.dueDate.getTime() >= now) continue;
    const days = Math.floor((now - c.dueDate.getTime()) / 86400000);
    const bucket = days <= 7 ? "1-7" : days <= 30 ? "8-30" : "30+";
    aging[bucket] += remaining;
  }

  res.json({
    from,
    to,
    accrued,
    paid,
    debt,
    collectabilityPct: accrued ? Math.round((paid / accrued) * 1000) / 10 : null,
    aging,
  });
});

// GET /api/v1/analytics/funnel — leads by stage, conversion, sources.
analyticsRouter.get("/funnel", async (req, res) => {
  const { organizationId } = req.employee!;
  const { from, to } = parseRange(req);

  const leads = await prisma.lead.findMany({
    where: { organizationId, createdAt: { gte: from, lte: to } },
  });

  const byStage: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const l of leads) {
    byStage[l.stage] = (byStage[l.stage] ?? 0) + 1;
    const source = l.source ?? "unknown";
    bySource[source] = (bySource[source] ?? 0) + 1;
  }

  const total = leads.length;
  const enrolled = byStage["ENROLLED"] ?? 0;

  res.json({
    from,
    to,
    total,
    byStage,
    bySource,
    conversionToEnrolledPct: total ? Math.round((enrolled / total) * 1000) / 10 : null,
  });
});

// GET /api/v1/analytics/coaches — per-coach KPIs. Trainers only ever see
// their own row (section 10.2: "Доход/долг тренера не используется как KPI").
analyticsRouter.get("/coaches", async (req, res) => {
  const { organizationId, role, employeeId } = req.employee!;
  const { from, to } = parseRange(req);

  const coaches = await prisma.employee.findMany({
    where: {
      organizationId,
      role: "TRAINER",
      ...(role === "TRAINER" ? { id: employeeId } : {}),
    },
    include: { user: true, coachOf: { include: { group: { include: { _count: { select: { athleteGroups: true } } } } } } },
  });

  const rows = await Promise.all(
    coaches.map(async (coach) => {
      const sessions = await prisma.trainingSession.findMany({
        where: { coachEmployeeId: coach.id, startsAt: { gte: from, lte: to } },
        include: { attendances: true },
      });
      const held = sessions.filter((s) => s.status === "HELD");
      const cancelled = sessions.filter((s) => s.status === "CANCELLED");
      const totalMarks = held.reduce((s, x) => s + x.attendances.length, 0);
      const present = held.reduce((s, x) => s + x.attendances.filter((a) => a.status === "PRESENT").length, 0);
      const completedOnTime = held.filter((s) => s.attendanceCompletedAt).length;

      return {
        employeeId: coach.id,
        name: coach.user.fullName,
        groupCount: coach.coachOf.length,
        athleteCount: coach.coachOf.reduce((s, gc) => s + gc.group._count.athleteGroups, 0),
        sessionsHeld: held.length,
        sessionsCancelled: cancelled.length,
        averageAttendancePct: totalMarks ? Math.round((present / totalMarks) * 1000) / 10 : null,
        attendanceTimelinessPct: held.length ? Math.round((completedOnTime / held.length) * 1000) / 10 : null,
      };
    })
  );

  res.json({ from, to, coaches: rows });
});
