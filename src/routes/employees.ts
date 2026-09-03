import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const employeesRouter = Router();
employeesRouter.use(requireAuth);

// Section 3: staff management (invite, role/status, venue access) is
// owner-only. Reading the list is opened a little further than that: an
// administrator needs to see trainers to assign them as group coaches, but
// never the full roster (other admins/owner) or anyone outside their venues.
employeesRouter.get("/", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId, role } = req.employee!;
  const employees = await prisma.employee.findMany({
    where: { organizationId, ...(role === "ADMINISTRATOR" ? { role: "TRAINER" } : {}) },
    include: { user: true, venueAccess: { include: { venue: true } }, coachOf: { include: { group: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(employees);
});

employeesRouter.get("/:id", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId, role } = req.employee!;
  const employee = await prisma.employee.findFirst({
    where: { id: req.params.id, organizationId, ...(role === "ADMINISTRATOR" ? { role: "TRAINER" } : {}) },
    include: { user: true, venueAccess: { include: { venue: true } }, coachOf: { include: { group: true } } },
  });
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  res.json(employee);
});

employeesRouter.use(requireRole("OWNER"));

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["OWNER", "ADMINISTRATOR", "TRAINER"]),
  venueIds: z.array(z.string()).optional(), // initial scope for ADMINISTRATOR
});

// POST /api/v1/employees — MVP has no email invite flow yet (README "next
// steps"): the owner sets a password directly and hands it to the new hire.
employeesRouter.post("/", async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, fullName, password, role, venueIds } = parsed.data;

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, fullName, passwordHash: await bcrypt.hash(password, 10) },
    });
  }

  const existingEmployment = await prisma.employee.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
  });
  if (existingEmployment) {
    return res.status(409).json({ error: "This user is already a member of the organization" });
  }

  const employee = await prisma.employee.create({
    data: {
      organizationId,
      userId: user.id,
      role,
      venueAccess: venueIds?.length
        ? { create: venueIds.map((venueId) => ({ venueId })) }
        : undefined,
    },
    include: { user: true, venueAccess: true },
  });

  res.status(201).json(employee);
});

const updateSchema = z.object({
  role: z.enum(["OWNER", "ADMINISTRATOR", "TRAINER"]).optional(),
  status: z.enum(["ACTIVE", "INVITED", "SUSPENDED"]).optional(),
});

employeesRouter.patch("/:id", async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.employee.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) return res.status(404).json({ error: "Employee not found" });

  const employee = await prisma.employee.update({ where: { id: existing.id }, data: parsed.data });
  res.json(employee);
});

const venueAccessSchema = z.object({ venueIds: z.array(z.string()) });

// PUT /api/v1/employees/:id/venue-access — replaces an administrator's full
// venue scope in one call (section 3 "Свои площадки: Назначенные").
employeesRouter.put("/:id/venue-access", async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = venueAccessSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.employee.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) return res.status(404).json({ error: "Employee not found" });

  const venues = await prisma.venue.findMany({
    where: { id: { in: parsed.data.venueIds }, organizationId },
    select: { id: true },
  });
  if (venues.length !== parsed.data.venueIds.length) {
    return res.status(400).json({ error: "One or more venues do not belong to this organization" });
  }

  await prisma.$transaction([
    prisma.employeeVenueAccess.deleteMany({ where: { employeeId: existing.id } }),
    prisma.employeeVenueAccess.createMany({
      data: parsed.data.venueIds.map((venueId) => ({ employeeId: existing.id, venueId })),
    }),
  ]);

  const updated = await prisma.employee.findUnique({
    where: { id: existing.id },
    include: { venueAccess: { include: { venue: true } } },
  });
  res.json(updated);
});
