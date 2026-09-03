import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { resolveVenueScope } from "../lib/scope";

export const venuesRouter = Router();
venuesRouter.use(requireAuth);

// GET /api/v1/venues — owner sees all, administrator only assigned venues,
// trainer only venues of the groups they coach (section 3).
venuesRouter.get("/", async (req, res) => {
  const { organizationId } = req.employee!;
  const venueScope = await resolveVenueScope(req.employee!);

  const venues = await prisma.venue.findMany({
    where: {
      organizationId,
      archivedAt: null,
      ...(venueScope ? { id: { in: venueScope } } : {}),
    },
    include: { zones: true, _count: { select: { groups: true } } },
    orderBy: { name: "asc" },
  });
  res.json(venues);
});

venuesRouter.get("/:id", async (req, res) => {
  const { organizationId } = req.employee!;
  const venueScope = await resolveVenueScope(req.employee!);
  if (venueScope && !venueScope.includes(req.params.id)) {
    return res.status(404).json({ error: "Venue not found" });
  }

  const venue = await prisma.venue.findFirst({
    where: { id: req.params.id, organizationId },
    include: {
      zones: true,
      groups: { where: { status: "ACTIVE" }, include: { sportType: true } },
    },
  });
  if (!venue) return res.status(404).json({ error: "Venue not found" });
  res.json(venue);
});

const createVenueSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
});

// Creating/archiving venues is organization-wide structure — owner only.
venuesRouter.post("/", requireRole("OWNER"), async (req, res) => {
  const { organizationId } = req.employee!;
  const parsed = createVenueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const venue = await prisma.venue.create({ data: { organizationId, ...parsed.data } });
  res.status(201).json(venue);
});

const updateVenueSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
});

// OWNER manages every venue; ADMINISTRATOR may update the basic details of a
// venue they're already scoped to, but never reach outside that scope.
venuesRouter.patch("/:id", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const venueScope = await resolveVenueScope(req.employee!);
  if (venueScope && !venueScope.includes(req.params.id)) {
    return res.status(404).json({ error: "Venue not found" });
  }
  const parsed = updateVenueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.venue.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) return res.status(404).json({ error: "Venue not found" });

  const venue = await prisma.venue.update({ where: { id: existing.id }, data: parsed.data });
  res.json(venue);
});

venuesRouter.post("/:id/archive", requireRole("OWNER"), async (req, res) => {
  const { organizationId } = req.employee!;
  const existing = await prisma.venue.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) return res.status(404).json({ error: "Venue not found" });
  const venue = await prisma.venue.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
  res.json(venue);
});

const createZoneSchema = z.object({ name: z.string().min(1) });

venuesRouter.post("/:id/zones", requireRole("OWNER", "ADMINISTRATOR"), async (req, res) => {
  const { organizationId } = req.employee!;
  const venueScope = await resolveVenueScope(req.employee!);
  if (venueScope && !venueScope.includes(req.params.id)) {
    return res.status(404).json({ error: "Venue not found" });
  }
  const parsed = createZoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const venue = await prisma.venue.findFirst({ where: { id: req.params.id, organizationId } });
  if (!venue) return res.status(404).json({ error: "Venue not found" });

  const zone = await prisma.zone.create({ data: { venueId: venue.id, name: parsed.data.name } });
  res.status(201).json(zone);
});
