import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { EmployeeRole } from "../lib/domain-types";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = "12h";

export interface EmployeeTokenPayload {
  employeeId: string;
  userId: string;
  organizationId: string;
  role: EmployeeRole;
}

export function signEmployeeToken(payload: EmployeeTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// Section 3: rights are checked on the backend, not just hidden client-side.
// The token itself carries role + organizationId; every route trusts req.employee
// rather than re-deriving scope from client-supplied ids.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: "Missing authorization token" });

  try {
    req.employee = jwt.verify(token, JWT_SECRET) as EmployeeTokenPayload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: EmployeeRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.employee || !roles.includes(req.employee.role)) {
      return res.status(403).json({ error: "Insufficient role" });
    }
    next();
  };
}
