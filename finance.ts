import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const financeRouter = Router();
financeRouter.use(requireAuth);
// Trainers never see money — enforced here, not just hidden client-side (section 3, test 17).
financeRouter.use(requireRole("OWNER", "ADMINISTRATOR"));

// POST /api/v1/finance/charges/generate-monthly { period: "2026-09" }
// Idempotent: the (athleteTariffId, period) unique constraint means re-running
// this for a period that's already billed simply skips those rows.
financeRouter.post("/charges/generate-monthly", async (req, res) => {
  const { organizationId } = req.employee!;
  const period = String(req.body.period ?? new Date().toISOString().slice(0, 7));

  const activeTariffs = await prisma.athleteTariff.findMany({
    where: {
      athleteGroup: { status: "ACTIVE", athlete: { organizationId, status: "ACTIVE" } },
      OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
    },
    include: { tariff: true, discounts: true, athleteGroup: true },
  });

  let created = 0;
  for (const at of activeTariffs) {
    const base = at.overridePrice ?? at.tariff.price;
    const activeDiscount = at.discounts.find(
      (d) => d.startDate <= new Date() && (!d.endDate || d.endDate >= new Date())
    );
    const discountAmount = activeDiscount
      ? activeDiscount.kind === "PERCENT"
        ? Math.round((base * activeDiscount.value) / 100)
        : activeDiscount.value
      : 0;
    const total = Math.max(0, base - discountAmount);

    try {
      await prisma.charge.create({
        data: {
          organizationId,
          athleteId: at.athleteGroup.athleteId,
          athleteTariffId: at.id,
          period,
          baseAmount: base,
          discountAmount,
          totalAmount: total,
          dueDate: new Date(`${period}-10`), // organization-configurable due date; simplified here
        },
      });
      created++;
    } catch {
      // unique constraint hit => already charged for this period, skip (idempotent)
    }
  }

  res.json({ period, created, consideredAthleteTariffs: activeTariffs.length });
});

// GET /api/v1/finance/debts — aging buckets per PRD section 8.4 / 10.2.
financeRouter.get("/debts", async (req, res) => {
  const { organizationId } = req.employee!;
  const unpaid = await prisma.charge.findMany({
    where: { organizationId, status: { in: ["UNPAID", "PARTIALLY_PAID"] }, dueDate: { lt: new Date() } },
    include: { athlete: true, allocations: true },
  });

  const rows = unpaid.map((c) => {
    const paid = c.allocations.reduce((s, a) => s + a.amount, 0);
    const remaining = c.totalAmount - paid;
    const days = Math.floor((Date.now() - c.dueDate.getTime()) / 86400000);
    const bucket = days <= 7 ? "1-7" : days <= 30 ? "8-30" : "30+";
    return { chargeId: c.id, athlete: c.athlete.fullName, remaining, days, bucket };
  });

  res.json(rows);
});

const paymentSchema = z.object({
  athleteId: z.string(),
  amount: z.number().int().positive(),
  method: z.enum(["CASH", "BANK_TRANSFER", "SBP", "CARD", "OTHER"]),
  // Optional manual allocation; if omitted, defaults to oldest-unpaid-first.
  allocations: z.array(z.object({ chargeId: z.string(), amount: z.number().int().positive() })).optional(),
});

// POST /api/v1/finance/payments
financeRouter.post("/payments", async (req, res) => {
  const { organizationId, employeeId } = req.employee!;
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { athleteId, amount, method, allocations } = parsed.data;

  const payment = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: { organizationId, athleteId, amount, method, createdByEmployeeId: employeeId },
    });

    let remaining = amount;
    let toAllocate = allocations;

    if (!toAllocate) {
      // Default: oldest unpaid/partially-paid charge first (section 8.4).
      const openCharges = await tx.charge.findMany({
        where: { athleteId, status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
        include: { allocations: true },
        orderBy: { dueDate: "asc" },
      });
      toAllocate = [];
      for (const c of openCharges) {
        if (remaining <= 0) break;
        const already = c.allocations.reduce((s, a) => s + a.amount, 0);
        const owed = c.totalAmount - already;
        if (owed <= 0) continue;
        const take = Math.min(owed, remaining);
        toAllocate.push({ chargeId: c.id, amount: take });
        remaining -= take;
      }
    }

    for (const a of toAllocate) {
      await tx.paymentAllocation.create({
        data: { paymentId: payment.id, chargeId: a.chargeId, amount: a.amount },
      });
      const charge = await tx.charge.findUniqueOrThrow({
        where: { id: a.chargeId },
        include: { allocations: true },
      });
      const paidSoFar = charge.allocations.reduce((s, x) => s + x.amount, 0) + a.amount;
      await tx.charge.update({
        where: { id: charge.id },
        data: { status: paidSoFar >= charge.totalAmount ? "PAID" : "PARTIALLY_PAID" },
      });
    }

    return payment;
  });

  res.status(201).json(payment);
});

const reversalSchema = z.object({ reason: z.string().min(1) });

// POST /api/v1/finance/payments/:id/reverse — physical deletion is forbidden (section 8.4).
financeRouter.post("/payments/:id/reverse", async (req, res) => {
  const parsed = reversalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.update({
      where: { id: req.params.id },
      data: { status: "REVERSED", reversalReason: parsed.data.reason, reversedAt: new Date() },
      include: { allocations: true },
    });
    for (const alloc of p.allocations) {
      const charge = await tx.charge.findUniqueOrThrow({
        where: { id: alloc.chargeId },
        include: { allocations: { include: { payment: true } } },
      });
      const stillPaid = charge.allocations
        .filter((a) => a.payment.status === "CONFIRMED")
        .reduce((s, a) => s + a.amount, 0);
      await tx.charge.update({
        where: { id: charge.id },
        data: { status: stillPaid <= 0 ? "UNPAID" : stillPaid < charge.totalAmount ? "PARTIALLY_PAID" : "PAID" },
      });
    }
    return p;
  });

  res.json(payment);
});
