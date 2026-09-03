// Mirrors backend/src/lib/domain-types.ts — kept in sync manually since the
// two projects don't share a build step.

export type EmployeeRole = "OWNER" | "ADMINISTRATOR" | "TRAINER";
export type EmployeeStatus = "ACTIVE" | "INVITED" | "SUSPENDED";
export type GroupStatus = "ACTIVE" | "ARCHIVED";
export type AthleteStatus = "ACTIVE" | "PAUSED" | "LEFT" | "PENDING_SETUP";
export type LeadStage =
  | "NEW"
  | "TRIAL_SCHEDULED"
  | "TRIAL_ATTENDED"
  | "ENROLLED"
  | "NO_SHOW"
  | "REJECTED"
  | "WAITLIST";
export type TrainingSessionStatus = "SCHEDULED" | "HELD" | "CANCELLED";
export type AttendanceStatus = "PRESENT" | "ABSENT";
export type ChargeStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "SBP" | "CARD" | "OTHER";
export type MailingScopeType = "ORGANIZATION" | "VENUE" | "SPORT" | "GROUP" | "SELECTED";

export interface Organization {
  id: string;
  name: string;
  legalDetails: string | null;
  timezone: string;
  currency: string;
  logoUrl: string | null;
  saasAthleteLimit: number | null;
}

export interface Venue {
  id: string;
  name: string;
  address: string | null;
  archivedAt: string | null;
  zones: Zone[];
  groups?: Group[];
  _count?: { groups: number };
}

export interface Zone {
  id: string;
  venueId: string;
  name: string;
}

export interface SportType {
  id: string;
  name: string;
  archivedAt: string | null;
}

export interface Group {
  id: string;
  organizationId: string;
  venueId: string;
  sportTypeId: string;
  name: string;
  participantLimit: number | null;
  status: GroupStatus;
  venue?: Venue;
  sportType?: SportType;
  coaches?: { id: string; employeeId: string; employee: { user: { fullName: string } } }[];
  _count?: { athleteGroups: number };
}

export interface AthleteGroup {
  id: string;
  athleteId: string;
  groupId: string;
  startDate: string;
  endDate: string | null;
  status: string;
  group: Group;
  athleteTariffs?: AthleteTariff[];
}

export interface Tariff {
  id: string;
  name: string;
  price: number;
  isIndividual: boolean;
}

export interface AthleteTariff {
  id: string;
  tariffId: string;
  tariff: Tariff;
  overridePrice: number | null;
  discounts: { id: string; kind: string; value: number; startDate: string; endDate: string | null }[];
}

export interface Athlete {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  status: AthleteStatus;
  source: string | null;
  startDate: string | null;
  adminComment: string | null;
  coachComment: string | null;
  athleteGroups: AthleteGroup[];
  representatives?: { representative: { id: string; fullName: string; phone: string | null; email: string | null } }[];
  charges?: Charge[];
  attendances?: { id: string; status: AttendanceStatus; markedAt: string }[];
}

export interface Lead {
  id: string;
  childFullName: string;
  dateOfBirth: string | null;
  parentName: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  stage: LeadStage;
  comment: string | null;
  createdAt: string;
  responsibleEmployee?: { user: { fullName: string } } | null;
  athleteId: string | null;
}

export interface TrainingSession {
  id: string;
  groupId: string;
  venueId: string;
  coachEmployeeId: string | null;
  startsAt: string;
  endsAt: string;
  status: TrainingSessionStatus;
  cancelReason: string | null;
  attendanceCompletedAt: string | null;
  group: Group;
  venue: Venue;
  attendances?: AttendanceEntry[];
}

export interface AttendanceEntry {
  id: string | null;
  athleteId: string;
  status: AttendanceStatus | null; // null = not marked yet
  athlete: Athlete;
}

export interface ScheduleRule {
  id: string;
  groupId: string;
  venueId: string;
  zoneId: string | null;
  coachEmployeeId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface Charge {
  id: string;
  athleteId: string;
  period: string;
  baseAmount: number;
  discountAmount: number;
  totalAmount: number;
  dueDate: string;
  status: ChargeStatus;
}

export interface DebtRow {
  chargeId: string;
  athleteId: string;
  athlete: string;
  remaining: number;
  days: number;
  bucket: "1-7" | "8-30" | "30+";
}

export interface Payment {
  id: string;
  athleteId: string;
  amount: number;
  method: PaymentMethod;
  status: "CONFIRMED" | "REVERSED";
  createdAt: string;
}

export interface IndividualTraining {
  id: string;
  athleteId: string;
  coachEmployeeId: string | null;
  venueId: string | null;
  scheduledAt: string;
  status: TrainingSessionStatus;
  price: number;
  athlete?: Athlete;
  charge?: Charge | null;
}

export interface Employee {
  id: string;
  organizationId: string;
  userId: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  createdAt: string;
  user: { id: string; email: string; fullName: string; lastLoginAt: string | null };
  venueAccess: { venueId: string; venue: Venue }[];
  coachOf: { groupId: string; group: Group }[];
}

export interface MessageTemplate {
  id: string;
  name: string;
  kind: "SYSTEM" | "CUSTOM";
  subject: string | null;
  body: string;
  createdAt: string;
}

export interface CommunicationLog {
  id: string;
  athleteId: string | null;
  representativeId: string | null;
  channel: string;
  status: string;
  sentAt: string | null;
  athlete: Athlete | null;
  mailing: { template: MessageTemplate | null } | null;
}

export interface AthletesAnalytics {
  active: number;
  new: number;
  left: number;
  paused: number;
}

export interface AttendanceAnalytics {
  averageRate: number | null;
  unfilledSessions: number;
  bestGroups: { groupId: string; name: string; rate: number | null }[];
  worstGroups: { groupId: string; name: string; rate: number | null }[];
}

export interface FinanceAnalytics {
  accrued: number;
  paid: number;
  debt: number;
  collectabilityPct: number | null;
  aging: { "1-7": number; "8-30": number; "30+": number };
}

export interface FunnelAnalytics {
  total: number;
  byStage: Record<string, number>;
  bySource: Record<string, number>;
  conversionToEnrolledPct: number | null;
}

export interface CoachAnalyticsRow {
  employeeId: string;
  name: string;
  groupCount: number;
  athleteCount: number;
  sessionsHeld: number;
  sessionsCancelled: number;
  averageAttendancePct: number | null;
  attendanceTimelinessPct: number | null;
}
