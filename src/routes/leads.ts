import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { resolveVenueScope } from "../lib/scope";

export const leadsRouter = Router();
leadsRouter.use(requireAuth);

// GET /api/v1/leads?stage=NEW
leadsRouter.get("/", async (req, res) => {
  const { organizationId } = req.employee!;
  const stage = typeof req.query.stage === "string" ? req.query.stage : undefined;
  // Administrators only see leads for their assigned venues (section 3); leads
  // with no venue set yet are org-wide intake and stay visible to everyone.
  const venueScope = await resolveVenueScope(req.employee!);
  const leads = await prisma.lead.findMany({
    where: {
      organizationId,
      ...(stage ? { stage: stage as any } : {}),
      ...(venueScope ? { OR: [{ venueId: { in: venueScope } }, { venueId: null }] } : {}),
    },
    include: { responsibleEmployee: { include: { user: true } }, trialSessions: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(leads);
});

const createLeadSchema = z.object({
  childFullName: z.string().min(1),
  dateOfBirth: z.string().datetime().optional(),
  parentName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  sportTypeId: z.string().optional(),
  venueId: z.string().optional(),
  source: z.string().optional(),
  comment: z.string().optional(),
});

// POST /api/v1/leads — external form / QR / manual creation all land here.
leadsRouter.post("/", async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = createLeadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Duplicate check per section 6: child name + DOB + representative phone.
  const dup = await prisma.lead.findFirst({
    where: {
      organizationId,
      childFullName: parsed.data.childFullName,
      phone: parsed.data.phone,
    },
  });

  const lead = await prisma.lead.create({
    data: { organizationId, ...parsed.data, dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : undefined },
  });

  res.status(201).json({ lead, possibleDuplicate: dup ?? null });
});

const stageSchema = z.object({
  stage: z.enum(["NEW", "TRIAL_SCHEDULED", "TRIAL_ATTENDED", "ENROLLED", "NO_SHOW", "REJECTED", "WAITLIST"]),
});

// PATCH /api/v1/leads/:id/stage
leadsRouter.patch("/:id/stage", async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = stageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const lead = await prisma.lead.findFirst({ where: { id: req.params.id, organizationId } });
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  // Enrolling creates (or reuses) the Athlete card — the funnel's exit point
  // into the operational model (section 5.4 / 12).
  let athleteId = lead.athleteId ?? undefined;
  if (parsed.data.stage === "ENROLLED" && !athleteId) {
    const athlete = await prisma.athlete.create({
      data: {
        organizationId,
        fullName: lead.childFullName,
        dateOfBirth: lead.dateOfBirth ?? undefined,
        source: lead.source ?? undefined,
        status: "PENDING_SETUP",
        startDate: new Date(),
      },
    });
    athleteId = athlete.id;
  }

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { stage: parsed.data.stage, athleteId },
  });

  res.json(updated);
});
