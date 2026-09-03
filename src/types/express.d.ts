import { EmployeeRole } from "../lib/domain-types";

// Populated by requireAuth (src/middleware/auth.ts) from the JWT payload.
declare global {
  namespace Express {
    interface Request {
      employee?: {
        employeeId: string;
        userId: string;
        organizationId: string;
        role: EmployeeRole;
      };
    }
  }
}

export {};
