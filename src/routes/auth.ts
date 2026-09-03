import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signEmployeeToken } from "../middleware/auth";
import { EmployeeRole } from "../lib/domain-types";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // A user can belong to more than one organization; for MVP the client
  // picks which one to sign into (self-onboarding creates exactly one).
  organizationId: z.string().optional(),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, organizationId } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { employments: true },
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const employment = organizationId
    ? user.employments.find((e) => e.organizationId === organizationId)
    : user.employments[0];

  if (!employment || employment.status !== "ACTIVE") {
    return res.status(403).json({ error: "No active membership in this organization" });
  }

  const token = signEmployeeToken({
    employeeId: employment.id,
    userId: user.id,
    organizationId: employment.organizationId,
    role: employment.role as EmployeeRole,
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  res.json({ token, role: employment.role, organizationId: employment.organizationId });
});
