import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function daysFromNow(d: number) {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t;
}

function todayAt(hour: number, minute = 0) {
  const t = new Date();
  t.setHours(hour, minute, 0, 0);
  return t;
}

async function main() {
  const club = await db.club.create({
    data: { name: "نادي اللياقة الأول", phone: "0509999999" },
  });

  const monthly = await db.plan.create({
    data: { clubId: club.id, name: "شهري", durationDays: 30, priceSAR: 299 },
  });
  const quarterly = await db.plan.create({
    data: { clubId: club.id, name: "3 شهور", durationDays: 90, priceSAR: 749 },
  });
  const yearly = await db.plan.create({
    data: { clubId: club.id, name: "سنوي ذهبي", durationDays: 365, priceSAR: 2199 },
  });

  const membersData: [string, string, typeof monthly, number][] = [
    ["محمد العتيبي", "0551000001", yearly, 45],
    ["محمد القحطاني", "0551000002", monthly, 3],
    ["محمد الشهري", "0551000003", monthly, -8],
    ["فهد الدوسري", "0551000004", quarterly, 60],
    ["عبدالله الغامدي", "0551000005", monthly, 12],
    ["سلطان الحربي", "0551000006", yearly, 200],
    ["خالد المطيري", "0551000007", monthly, -2],
    ["ناصر الزهراني", "0551000008", quarterly, 30],
    ["سعود العنزي", "0551000009", monthly, 1],
    ["تركي السبيعي", "0551000010", monthly, 25],
  ];

  let memberNo = 1000;
  for (const [name, phone, plan, daysLeft] of membersData) {
    const member = await db.member.create({
      data: { clubId: club.id, name, phone, memberNo: ++memberNo },
    });
    await db.subscription.create({
      data: {
        memberId: member.id,
        planId: plan.id,
        startsAt: daysFromNow(daysLeft - plan.durationDays),
        endsAt: daysFromNow(daysLeft),
        paidSAR: plan.priceSAR,
      },
    });
    if (daysLeft > 0 && Math.random() > 0.4) {
      await db.attendance.create({
        data: { memberId: member.id, checkedAt: todayAt(8 + (memberNo % 10)) },
      });
    }
  }

  const crossfit = await db.gymClass.create({
    data: { clubId: club.id, name: "كروس فت", coach: "المدرب فهد", durationMin: 45, capacity: 20 },
  });
  const burn = await db.gymClass.create({
    data: { clubId: club.id, name: "لياقة وحرق", coach: "المدرب سامي", durationMin: 60, capacity: 15 },
  });
  const yoga = await db.gymClass.create({
    data: { clubId: club.id, name: "يوغا مسائية", coach: "المدرب ياسر", durationMin: 60, capacity: 12 },
  });

  for (let day = 0; day < 7; day++) {
    const base = new Date();
    base.setDate(base.getDate() + day);
    for (const [cls, hour] of [
      [crossfit, 18],
      [burn, 19],
      [yoga, 21],
    ] as const) {
      const startsAt = new Date(base);
      startsAt.setHours(hour, hour === 19 ? 30 : 0, 0, 0);
      await db.classSession.create({
        data: { classId: cls.id, startsAt, capacity: cls.capacity },
      });
    }
  }

  const members = await db.member.findMany();
  const sessions = await db.classSession.findMany({ orderBy: { startsAt: "asc" } });
  const fills = [12, 13, 12, 8, 10, 5];
  for (let s = 0; s < Math.min(sessions.length, fills.length); s++) {
    for (let i = 0; i < fills[s]; i++) {
      const member = members[i % members.length];
      await db.booking
        .create({
          data: {
            sessionId: sessions[s].id,
            memberId: member.id,
            source: i % 4 === 0 ? "urpass" : i % 3 === 0 ? "app" : "reception",
          },
        })
        .catch(() => {});
    }
  }

  console.log("Seed done");
}

main().finally(() => db.$disconnect());
