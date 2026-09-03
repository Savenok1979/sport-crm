import { EmployeeRole } from "./domain-types";
import { prisma } from "./prisma";

type ScopedEmployee = { employeeId: string; role: EmployeeRole };

// Which venues an employee may operate on (section 3 scope rules).
// null = unrestricted (OWNER sees the whole organization).
export async function resolveVenueScope(employee: ScopedEmployee): Promise<string[] | null> {
  if (employee.role === "OWNER") return null;

  if (employee.role === "ADMINISTRATOR") {
    const access = await prisma.employeeVenueAccess.findMany({
      where: { employeeId: employee.employeeId },
      select: { venueId: true },
    });
    return access.map((a) => a.venueId);
  }

  // TRAINER: venues of the groups they coach.
  const coached = await prisma.groupCoach.findMany({
    where: { employeeId: employee.employeeId },
    select: { group: { select: { venueId: true } } },
  });
  return [...new Set(coached.map((c) => c.group.venueId))];
}

// Which groups an employee may operate on. Used wherever the natural filter
// is by group rather than venue (athletes, attendance, finance).
// null = unrestricted (OWNER).
export async function resolveGroupScope(employee: ScopedEmployee): Promise<string[] | null> {
  if (employee.role === "OWNER") return null;

  if (employee.role === "TRAINER") {
    const coached = await prisma.groupCoach.findMany({
      where: { employeeId: employee.employeeId },
      select: { groupId: true },
    });
    return coached.map((c) => c.groupId);
  }

  // ADMINISTRATOR: every group inside their assigned venues.
  const venueIds = await resolveVenueScope(employee);
  if (venueIds === null) return null;
  if (venueIds.length === 0) return [];
  const groups = await prisma.group.findMany({ where: { venueId: { in: venueIds } }, select: { id: true } });
  return groups.map((g) => g.id);
}

// Section 16 acceptance test: an administrator/trainer must never reach an
// athlete outside their scope, even by guessing the id directly.
export async function assertAthleteInScope(employee: ScopedEmployee, athleteId: string): Promise<boolean> {
  if (employee.role === "OWNER") return true;
  const groupScope = await resolveGroupScope(employee);
  if (groupScope === null) return true;
  if (groupScope.length === 0) return false;
  const match = await prisma.athleteGroup.findFirst({
    where: { athleteId, status: "ACTIVE", groupId: { in: groupScope } },
  });
  return !!match;
}
