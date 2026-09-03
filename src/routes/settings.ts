import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

// GET /api/v1/settings/organization — readable by any employee (needed to
// render currency/timezone across the app), editable by the owner only.
settingsRouter.get("/organization", async (req, res) => {
  const { organizationId } = req.employee!;
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return res.status(404).json({ error: "Organization not found" });
  res.json(organization);
});

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  legalDetails: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  logoUrl: z.string().optional(),
});

settingsRouter.patch("/organization", requireRole("OWNER"), async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = updateOrgSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const organization = await prisma.organization.update({ where: { id: organizationId }, data: parsed.data });
  res.json(organization);
});

// ---------------------------------------------------------------
// Sport types (section 17: add / rename / archive)
// ---------------------------------------------------------------

settingsRouter.get("/sport-types", async (req, res) => {
  const { organizationId } = req.employee!;
  const sportTypes = await prisma.sportType.findMany({
    where: { organizationId, archivedAt: null },
    orderBy: { name: "asc" },
  });
  res.json(sportTypes);
});

const sportTypeSchema = z.object({ name: z.string().min(1) });

settingsRouter.post("/sport-types", requireRole("OWNER"), async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = sportTypeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const sportType = await prisma.sportType.create({ data: { organizationId, name: parsed.data.name } });
  res.status(201).json(sportType);
});

settingsRouter.patch("/sport-types/:id", requireRole("OWNER"), async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = sportTypeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.sportType.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) return res.status(404).json({ error: "Sport type not found" });

  const sportType = await prisma.sportType.update({ where: { id: existing.id }, data: { name: parsed.data.name } });
  res.json(sportType);
});

settingsRouter.post("/sport-types/:id/archive", requireRole("OWNER"), async (req, res) => {
  const { organizationId } = req.employee!;
  const existing = await prisma.sportType.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) return res.status(404).json({ error: "Sport type not found" });
  const sportType = await prisma.sportType.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
  res.json(sportType);
});
