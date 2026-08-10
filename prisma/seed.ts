import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { issueInvoice } from "../src/lib/invoicing";

const db = new PrismaClient();

const day = 24 * 60 * 60 * 1000;
const shift = (d: number) => new Date(Date.now() + d * day);
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

async function reset() {
  await db.staffAttendance.deleteMany();
  await db.payroll.deleteMany();
  await db.leave.deleteMany();
  await db.employee.deleteMany();
  await db.payment.deleteMany();
  await db.invoiceItem.deleteMany();
  await db.invoice.deleteMany();
  await db.expense.deleteMany();
  await db.booking.deleteMany();
  await db.classSession.deleteMany();
  await db.gymClass.deleteMany();
  await db.attendance.deleteMany();
  await db.subscription.deleteMany();
  await db.plan.deleteMany();
  await db.member.deleteMany();
  await db.platformInvoice.deleteMany();
  await db.user.deleteMany();
  await db.club.deleteMany();
}

async function buildClub(opts: {
  name: string;
  slug: string;
  vat: string;
  plan: string;
  fee: number;
  status: string;
  memberCount: number;
  staffEmails: boolean;
}) {
  const club = await db.club.create({
    data: {
      name: opts.name,
      slug: opts.slug,
      phone: "0114567890",
      address: "الرياض، حي الملقا",
      vatNumber: opts.vat,
      crNumber: "1010" + Math.floor(Math.random() * 900000 + 100000),
      platformPlan: opts.plan,
      platformFeeSAR: opts.fee,
      platformStatus: opts.status,
      platformEndsAt: shift(opts.status === "trial" ? 9 : 21),
    },
  });

  // فواتير اشتراك النادي في المنصة (إيرادنا)
  for (let m = 5; m >= 0; m--) {
    const d = new Date();
    d.setMonth(d.getMonth() - m);
    await db.platformInvoice.create({
      data: {
        clubId: club.id,
        month: monthKey(d),
        amountSAR: opts.fee,
        status: m === 0 && opts.status !== "active" ? "unpaid" : "paid",
        issuedAt: d,
        paidAt: m === 0 && opts.status !== "active" ? null : d,
      },
    });
  }

  const plans = await Promise.all(
    [
      { name: "شهري", durationDays: 30, priceSAR: 299 },
      { name: "3 شهور", durationDays: 90, priceSAR: 749 },
      { name: "6 شهور", durationDays: 180, priceSAR: 1349 },
      { name: "سنوي ذهبي", durationDays: 365, priceSAR: 2199 },
    ].map((p) => db.plan.create({ data: { ...p, clubId: club.id } }))
  );

  const firstNames = ["محمد", "عبدالله", "فهد", "سلطان", "خالد", "ناصر", "سعود", "تركي", "بندر", "ماجد", "عمر", "ياسر", "راكان", "فيصل", "زياد"];
  const lastNames = ["العتيبي", "القحطاني", "الشهري", "الدوسري", "الغامدي", "الحربي", "المطيري", "الزهراني", "العنزي", "السبيعي"];
  const daysLeftPool = [45, 3, -8, 60, 12, 200, -2, 30, 1, 25, -15, 90, 6, 120, -30, 150, 5, 75, -1, 40];

  const members = [];
  let memberNo = 1000;
  for (let i = 0; i < opts.memberCount; i++) {
    const plan = pick(plans, i);
    const daysLeft = pick(daysLeftPool, i);
    const member = await db.member.create({
      data: {
        clubId: club.id,
        name: `${pick(firstNames, i)} ${pick(lastNames, Math.floor(i / 3) + i)}`,
        phone: `05${String(50000000 + i * 137 + opts.memberCount).slice(0, 8)}`,
        memberNo: ++memberNo,
        gender: i % 5 === 0 ? "female" : "male",
      },
    });
    members.push(member);

    const sub = await db.subscription.create({
      data: {
        memberId: member.id,
        planId: plan.id,
        startsAt: shift(daysLeft - plan.durationDays),
        endsAt: shift(daysLeft),
        paidSAR: plan.priceSAR,
        status: i % 11 === 0 ? "frozen" : "active",
        frozenAt: i % 11 === 0 ? shift(-5) : null,
        source: i % 7 === 0 ? "app" : i % 5 === 0 ? "urpass" : "reception",
      },
    });

    // فاتورة ضريبية لكل اشتراك — عبر المُصدِر المركزي (سلسلة ZATCA)
    await issueInvoice({
      clubId: club.id,
      memberId: member.id,
      subscriptionId: sub.id,
      items: [{ description: `اشتراك ${plan.name}`, totalWithVat: plan.priceSAR }],
      status: i % 9 === 0 ? "unpaid" : "paid",
      method: pick(["cash", "mada", "visa", "tabby", "tamara", "transfer"], i),
    });

    // حضور خلال آخر أسبوعين
    if (daysLeft > 0) {
      for (let d = 0; d < 14; d++) {
        if ((i + d) % 3 !== 0) continue;
        const at = shift(-d);
        at.setHours(7 + ((i + d) % 14), 30, 0, 0);
        await db.attendance.create({
          data: {
            memberId: member.id,
            checkedAt: at,
            source: pick(["reception", "fingerprint", "wristband", "gate"], i + d),
          },
        });
      }
    }
  }

  // الحصص
  const classDefs = [
    { name: "كروس فت", coach: "المدرب فهد", durationMin: 45, capacity: 20 },
    { name: "لياقة وحرق", coach: "المدرب سامي", durationMin: 60, capacity: 15 },
    { name: "يوغا مسائية", coach: "المدرب ياسر", durationMin: 60, capacity: 12 },
    { name: "ملاكمة", coach: "المدرب أحمد", durationMin: 50, capacity: 10 },
  ];
  const classes = await Promise.all(
    classDefs.map((c) => db.gymClass.create({ data: { ...c, clubId: club.id } }))
  );

  for (let d = 0; d < 7; d++) {
    for (let c = 0; c < classes.length; c++) {
      const startsAt = shift(d);
      startsAt.setHours(17 + c, c % 2 ? 30 : 0, 0, 0);
      const session = await db.classSession.create({
        data: { classId: classes[c].id, startsAt, capacity: classes[c].capacity },
      });
      const fill = Math.max(0, classes[c].capacity - ((d + c * 3) % 8));
      for (let b = 0; b < fill && b < members.length; b++) {
        await db.booking
          .create({
            data: {
              sessionId: session.id,
              memberId: members[(b + d) % members.length].id,
              status: b < classes[c].capacity ? "booked" : "waitlist",
              source: pick(["reception", "app", "app", "urpass"], b),
            },
          })
          .catch(() => {});
      }
    }
  }

  // الموظفون
  const staffDefs = [
    { name: "أحمد الشمري", jobTitle: "مدير النادي", department: "إدارة", salarySAR: 12000 },
    { name: "سارة الحمد", jobTitle: "محاسبة", department: "محاسبة", salarySAR: 8500 },
    { name: "فهد المالكي", jobTitle: "مدرب أول", department: "تدريب", salarySAR: 7500 },
    { name: "نورة السالم", jobTitle: "موظفة استقبال", department: "استقبال", salarySAR: 5000 },
    { name: "سامي العمري", jobTitle: "مدرب", department: "تدريب", salarySAR: 6500 },
    { name: "منى الفارس", jobTitle: "أخصائية موارد بشرية", department: "إدارة", salarySAR: 7000 },
    { name: "علي الرشيد", jobTitle: "فني صيانة", department: "صيانة", salarySAR: 4200 },
  ];

  for (let i = 0; i < staffDefs.length; i++) {
    const s = staffDefs[i];
    const emp = await db.employee.create({
      data: {
        ...s,
        clubId: club.id,
        phone: `05${String(66000000 + i * 971).slice(0, 8)}`,
        iban: `SA${String(4400000000000000000000 + i)}`.slice(0, 24),
        hireDate: shift(-400 - i * 90),
        status: i === 6 ? "on_leave" : "active",
      },
    });

    for (let m = 2; m >= 0; m--) {
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      const bonus = i % 3 === 0 ? 500 : 0;
      const ded = i % 4 === 0 ? 200 : 0;
      await db.payroll.create({
        data: {
          employeeId: emp.id,
          month: monthKey(d),
          baseSAR: s.salarySAR,
          bonusSAR: bonus,
          deductionsSAR: ded,
          netSAR: s.salarySAR + bonus - ded,
          status: m === 0 ? "pending" : "paid",
          paidAt: m === 0 ? null : d,
        },
      });
    }

    if (i % 3 === 0) {
      await db.leave.create({
        data: {
          employeeId: emp.id,
          type: pick(["سنوية", "مرضية", "اضطرارية"], i),
          startsAt: shift(3 + i),
          endsAt: shift(8 + i),
          status: i === 0 ? "pending" : "approved",
          note: i === 0 ? "سفر عائلي" : null,
        },
      });
    }

    for (let d = 0; d < 7; d++) {
      const dayDate = shift(-d);
      dayDate.setHours(0, 0, 0, 0);
      const checkIn = new Date(dayDate);
      checkIn.setHours(8, (i * 7) % 40, 0, 0);
      const checkOut = new Date(dayDate);
      checkOut.setHours(17, (i * 3) % 30, 0, 0);
      const absent = (i + d) % 9 === 0;
      await db.staffAttendance.create({
        data: {
          employeeId: emp.id,
          day: dayDate,
          checkIn: absent ? null : checkIn,
          checkOut: absent ? null : checkOut,
          status: absent ? "absent" : "present",
        },
      });
    }
  }

  // المصروفات
  const expenseDefs = [
    { category: "إيجار", description: "إيجار المقر الشهري", amountSAR: 25000 },
    { category: "رواتب", description: "رواتب الموظفين", amountSAR: 50700 },
    { category: "مرافق", description: "فاتورة كهرباء ومياه", amountSAR: 6800 },
    { category: "صيانة", description: "صيانة أجهزة رياضية", amountSAR: 3400 },
    { category: "تسويق", description: "حملة إعلانية سناب شات", amountSAR: 9000 },
    { category: "أخرى", description: "مستلزمات نظافة", amountSAR: 1200 },
  ];
  for (let m = 3; m >= 0; m--) {
    for (const e of expenseDefs) {
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      d.setDate(3 + expenseDefs.indexOf(e) * 4);
      await db.expense.create({
        data: { ...e, clubId: club.id, spentAt: d, amountSAR: e.amountSAR * (1 + m * 0.02) },
      });
    }
  }

  return club;
}

async function main() {
  await reset();
  const pw = hashPassword("123456");

  const clubA = await buildClub({
    name: "نادي اللياقة الأول", slug: "fitness-one", vat: "300012345600003",
    plan: "pro", fee: 599, status: "active", memberCount: 20, staffEmails: true,
  });
  const clubB = await buildClub({
    name: "نادي القوة الرياضي", slug: "power-gym", vat: "300098765400003",
    plan: "basic", fee: 299, status: "active", memberCount: 12, staffEmails: false,
  });
  const clubC = await buildClub({
    name: "أكاديمية النخبة", slug: "elite-academy", vat: "300055566600003",
    plan: "enterprise", fee: 1299, status: "trial", memberCount: 8, staffEmails: false,
  });

  // مزود الحل (أنت)
  await db.user.create({
    data: { name: "راغد النايف", email: "admin@nadi.sa", passwordHash: pw, role: "super_admin" },
  });

  // فريق النادي الأول — حساب لكل دور
  const teamA = [
    { name: "أحمد الشمري", email: "owner@club.sa", role: "owner" },
    { name: "خالد المدير", email: "manager@club.sa", role: "manager" },
    { name: "سارة الحمد", email: "accountant@club.sa", role: "accountant" },
    { name: "منى الفارس", email: "hr@club.sa", role: "hr" },
    { name: "نورة السالم", email: "reception@club.sa", role: "reception" },
  ];
  for (const t of teamA) {
    await db.user.create({ data: { ...t, passwordHash: pw, clubId: clubA.id } });
  }

  await db.user.create({
    data: { name: "مالك نادي القوة", email: "owner@power.sa", passwordHash: pw, role: "owner", clubId: clubB.id },
  });
  await db.user.create({
    data: { name: "مالك أكاديمية النخبة", email: "owner@elite.sa", passwordHash: pw, role: "owner", clubId: clubC.id },
  });

  console.log("✓ تم إنشاء البيانات التجريبية");
  console.log("  مزود الحل: admin@nadi.sa / 123456");
  console.log("  فريق النادي: owner@club.sa | manager@club.sa | accountant@club.sa | hr@club.sa | reception@club.sa");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
