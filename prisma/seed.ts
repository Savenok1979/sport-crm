import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.create({
    data: { name: 'СШ «Вымпел»', timezone: "Europe/Moscow", currency: "RUB" },
  });

  const ownerUser = await prisma.user.create({
    data: {
      email: "owner@example.com",
      passwordHash: await bcrypt.hash("password123", 10),
      fullName: "Илья Владелец",
    },
  });
  await prisma.employee.create({
    data: { organizationId: org.id, userId: ownerUser.id, role: "OWNER" },
  });

  const coachUser = await prisma.user.create({
    data: {
      email: "coach@example.com",
      passwordHash: await bcrypt.hash("password123", 10),
      fullName: "Игорь Соколов",
    },
  });
  const coach = await prisma.employee.create({
    data: { organizationId: org.id, userId: coachUser.id, role: "TRAINER" },
  });

  const venue = await prisma.venue.create({ data: { organizationId: org.id, name: "Сокольники" } });
  const sport = await prisma.sportType.create({ data: { organizationId: org.id, name: "Волейбол" } });
  const group = await prisma.group.create({
    data: { organizationId: org.id, venueId: venue.id, sportTypeId: sport.id, name: "Волейбол 8–10 · А", participantLimit: 16 },
  });
  await prisma.groupCoach.create({ data: { groupId: group.id, employeeId: coach.id } });

  const rule = await prisma.scheduleRule.create({
    data: {
      groupId: group.id,
      venueId: venue.id,
      coachEmployeeId: coach.id,
      dayOfWeek: 0, // Monday
      startTime: "17:00",
      endTime: "18:00",
      effectiveFrom: new Date(),
    },
  });

  const tariff = await prisma.tariff.create({
    data: { organizationId: org.id, name: "Групповые занятия · 3 раза в неделю", price: 320000 }, // 3200.00 RUB in kopecks
  });
  await prisma.groupTariff.create({ data: { groupId: group.id, tariffId: tariff.id } });

  const athlete = await prisma.athlete.create({
    data: { organizationId: org.id, fullName: "Тимофеев Артём", status: "ACTIVE", startDate: new Date() },
  });
  const athleteGroup = await prisma.athleteGroup.create({
    data: { athleteId: athlete.id, groupId: group.id, startDate: new Date() },
  });
  await prisma.athleteTariff.create({
    data: { athleteId: athlete.id, athleteGroupId: athleteGroup.id, tariffId: tariff.id, startDate: new Date() },
  });

  console.log("Seed complete.");
  console.log("Owner login: owner@example.com / password123");
  console.log("Trainer login: coach@example.com / password123");
  console.log("Organization id:", org.id, " ScheduleRule id:", rule.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
