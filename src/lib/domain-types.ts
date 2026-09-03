// SQLite has no native enum support, so schema.prisma stores these as plain
// String columns (see the comment at the top of that file). These TS union
// types are the single source of truth for the allowed values everywhere
// they're checked in application code (zod schemas should match them).

export type EmployeeRole = "OWNER" | "ADMINISTRATOR" | "TRAINER";
export type EmployeeStatus = "ACTIVE" | "INVITED" | "SUSPENDED";
export type GroupStatus = "ACTIVE" | "ARCHIVED";
export type AthleteStatus = "ACTIVE" | "PAUSED" | "LEFT" | "PENDING_SETUP";
export type AthleteGroupStatus = "ACTIVE" | "CLOSED";
export type LeadStage =
  | "NEW"
  | "TRIAL_SCHEDULED"
  | "TRIAL_ATTENDED"
  | "ENROLLED"
  | "NO_SHOW"
  | "REJECTED"
  | "WAITLIST";
export type TrialResult = "SCHEDULED" | "ATTENDED" | "NO_SHOW";
export type TrainingSessionStatus = "SCHEDULED" | "HELD" | "CANCELLED";
export type AttendanceStatus = "PRESENT" | "ABSENT";
export type ChargeStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "SBP" | "CARD" | "OTHER";
export type PaymentStatus = "CONFIRMED" | "REVERSED";
export type MailingScopeType = "ORGANIZATION" | "VENUE" | "SPORT" | "GROUP" | "SELECTED";
export type CommunicationStatus = "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "BOUNCED";
