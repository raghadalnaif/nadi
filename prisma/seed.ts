import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { issueInvoice } from "../src/lib/invoicing";
import { ensureChart, postExpense } from "../src/lib/ledger";

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
  await db.offer.deleteMany();
  await db.plan.deleteMany();
  await db.member.deleteMany();
  await db.platformInvoice.deleteMany();
  await db.auditLog.deleteMany();
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
  // المصروفات والرواتب متناسبة مع حجم النادي حتى تكون التقارير واقعية
  const scale = opts.memberCount / 120;

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

  await ensureChart(club.id);

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
      // باقات الحصص — للأندية التي تبيع بالزيارة لا بالمدة
      { name: "باقة ٨ حصص", kind: "sessions", sessionCount: 8, durationDays: 45, priceSAR: 450 },
      { name: "باقة ١٢ حصة", kind: "sessions", sessionCount: 12, durationDays: 60, priceSAR: 640 },
    ].map((p) => db.plan.create({ data: { ...p, clubId: club.id } }))
  );

  // عروض وخصومات تجريبية
  await db.offer.createMany({
    data: [
      { clubId: club.id, name: "عرض الصيف", code: "SUMMER25", kind: "percent", value: 25, startsAt: shift(-10), endsAt: shift(20), maxUses: 50 },
      { clubId: club.id, name: "خصم الطلاب", code: "STUDENT", kind: "percent", value: 15, startsAt: shift(-60), endsAt: shift(120), maxUses: 0 },
      { clubId: club.id, name: "خصم 100 ريال", code: "SAVE100", kind: "fixed", value: 100, startsAt: shift(-5), endsAt: shift(10), maxUses: 20 },
    ],
  });

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
        barcode: `M${memberNo}${opts.slug.slice(0, 2).toUpperCase()}${i}`,
        gender: i % 5 === 0 ? "female" : "male",
      },
    });
    members.push(member);

    const subStart = shift(daysLeft - plan.durationDays);
    const isSessions = plan.kind === "sessions";
    const sub = await db.subscription.create({
      data: {
        memberId: member.id,
        planId: plan.id,
        startsAt: subStart,
        endsAt: shift(daysLeft),
        paidSAR: plan.priceSAR,
        sessionsTotal: isSessions ? plan.sessionCount : 0,
        // بعض المشتركين استهلكوا جزءاً من حصصهم
        sessionsUsed: isSessions ? Math.min(plan.sessionCount, i % (plan.sessionCount + 1)) : 0,
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
      issuedAt: subStart > new Date() ? new Date() : subStart,
    });

    // تجديدات سابقة — تعكس دورة حياة العضو وتوزّع الإيراد على الأشهر
    for (let past = 1; past <= 5; past++) {
      if ((i + past) % 2 !== 0) continue; // ليس كل عضو يجدد كل شهر
      const when = new Date();
      when.setMonth(when.getMonth() - past);
      when.setDate(1 + ((i * 7 + past * 3) % 26));
      await issueInvoice({
        clubId: club.id,
        memberId: member.id,
        items: [{ description: `تجديد اشتراك ${plan.name}`, totalWithVat: plan.priceSAR }],
        method: pick(["cash", "mada", "visa", "tabby", "tamara"], i + past),
        issuedAt: when,
      });
    }

    // حضور خلال آخر أسبوعين
    if (daysLeft > 0) {
      for (let d = 0; d < 14; d++) {
        if ((i + d) % 4 !== 0) continue;
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

  const staffCount = opts.memberCount >= 100 ? staffDefs.length : opts.memberCount >= 50 ? 5 : 3;
  for (let i = 0; i < staffCount; i++) {
    const s = { ...staffDefs[i], salarySAR: Math.round(staffDefs[i].salarySAR * Math.min(1, 0.6 + scale * 0.4)) };
    const emp = await db.employee.create({
      data: {
        ...s,
        clubId: club.id,
        phone: `05${String(66000000 + i * 971).slice(0, 8)}`,
        iban: `SA${String(4400000000000000000000 + i)}`.slice(0, 24),
        barcode: `E${opts.slug.slice(0, 3).toUpperCase()}${i}`,
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

    for (let d = 1; d < 7; d++) {
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
    { category: "إيجار", description: "إيجار المقر الشهري", amountSAR: Math.round(14000 * scale) },
    { category: "رواتب", description: "رواتب الموظفين", amountSAR: Math.round(22000 * scale) },
    { category: "مرافق", description: "فاتورة كهرباء ومياه", amountSAR: Math.round(3800 * scale) },
    { category: "صيانة", description: "صيانة أجهزة رياضية", amountSAR: Math.round(1800 * scale) },
    { category: "تسويق", description: "حملة إعلانية", amountSAR: Math.round(2600 * scale) },
    { category: "أخرى", description: "مستلزمات نظافة", amountSAR: Math.round(800 * scale) },
  ];
  for (let m = 5; m >= 0; m--) {
    for (const e of expenseDefs) {
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      d.setDate(3 + expenseDefs.indexOf(e) * 4);
      const created = await db.expense.create({
        data: { ...e, clubId: club.id, spentAt: d, amountSAR: e.amountSAR * (1 + m * 0.02) },
      });
      await postExpense(created.id);
    }
  }

  return club;
}

async function main() {
  await reset();
  const pw = hashPassword("123456");

  const clubA = await buildClub({
    name: "نادي اللياقة الأول", slug: "fitness-one", vat: "300012345600003",
    plan: "pro", fee: 599, status: "active", memberCount: 120, staffEmails: true,
  });
  const clubB = await buildClub({
    name: "نادي القوة الرياضي", slug: "power-gym", vat: "300098765400003",
    plan: "basic", fee: 299, status: "active", memberCount: 55, staffEmails: false,
  });
  const clubC = await buildClub({
    name: "أكاديمية النخبة", slug: "elite-academy", vat: "300055566600003",
    plan: "enterprise", fee: 1299, status: "trial", memberCount: 28, staffEmails: false,
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

  // ───── فروع النادي الأول وتوزيع بياناته ─────
  const mainBranch = await db.branch.create({
    data: { clubId: clubA.id, name: "فرع الملقا (الرئيسي)", address: "الرياض، حي الملقا", phone: "0114567890", isMain: true },
  });
  const secondBranch = await db.branch.create({
    data: { clubId: clubA.id, name: "فرع النرجس", address: "الرياض، حي النرجس", phone: "0114567891" },
  });

  const allMembers = await db.member.findMany({ where: { clubId: clubA.id } });
  for (const [i, m] of allMembers.entries()) {
    await db.member.update({
      where: { id: m.id },
      data: { branchId: i % 3 === 0 ? secondBranch.id : mainBranch.id },
    });
  }

  const allEmployees = await db.employee.findMany({ where: { clubId: clubA.id } });
  for (const [i, e] of allEmployees.entries()) {
    await db.employee.update({
      where: { id: e.id },
      data: { branchId: i % 3 === 0 ? secondBranch.id : mainBranch.id },
    });
  }

  // الفواتير تتبع فرع صاحبها ليصح تقرير كل فرع
  const clubAInvoices = await db.invoice.findMany({ where: { clubId: clubA.id }, select: { id: true, memberId: true } });
  for (const inv of clubAInvoices) {
    const owner = inv.memberId ? await db.member.findUnique({ where: { id: inv.memberId }, select: { branchId: true } }) : null;
    await db.invoice.update({ where: { id: inv.id }, data: { branchId: owner?.branchId ?? mainBranch.id } });
  }
  await db.expense.updateMany({ where: { clubId: clubA.id }, data: { branchId: mainBranch.id } });
  await db.gymClass.updateMany({ where: { clubId: clubA.id }, data: { branchId: mainBranch.id } });

  // ───── حساب مدير الفرع ─────
  await db.user.create({
    data: {
      clubId: clubA.id, branchId: secondBranch.id, name: "سعود العتيبي",
      email: "branch@club.sa", role: "branch_manager", passwordHash: pw,
    },
  });

  // ───── حساب موظف مع طلب إجازة وتقييم ─────
  const coach = await db.employee.findFirst({ where: { clubId: clubA.id, department: "تدريب" } });
  if (coach) {
    await db.user.create({
      data: {
        clubId: clubA.id, branchId: coach.branchId, employeeId: coach.id,
        name: coach.name, email: "staff@club.sa", role: "employee", passwordHash: pw,
      },
    });
    await db.leave.create({
      data: {
        employeeId: coach.id, type: "سنوية", startsAt: shift(10), endsAt: shift(15),
        status: "pending", requestedBy: coach.name, note: "سفر عائلي",
      },
    });
    await db.evaluation.create({
      data: {
        employeeId: coach.id, year: new Date().getFullYear(),
        attendance: 4, performance: 5, teamwork: 4, discipline: 5, overall: 4.5,
        notes: "أداء ممتاز والتزام عالٍ بالمواعيد", byName: "منى الفارس",
      },
    });
  }

  // ───── حساب مشترك للبوابة ─────
  const firstMember = await db.member.findFirst({ where: { clubId: clubA.id } });
  if (firstMember) {
    await db.user.create({
      data: {
        clubId: clubA.id, branchId: firstMember.branchId, memberId: firstMember.id,
        name: firstMember.name, email: "member@club.sa", role: "member", passwordHash: pw,
      },
    });
  }

  // ───── إعلانات داخلية ─────
  const ownerUser = await db.user.findFirst({ where: { clubId: clubA.id, role: "owner" } });
  if (ownerUser) {
    await db.announcement.create({
      data: {
        clubId: clubA.id, title: "تعديل مواعيد الدوام في رمضان",
        body: "يبدأ الدوام الساعة ١٠ صباحاً وينتهي ٤ عصراً طوال الشهر الكريم.\n\nنرجو الالتزام وإبلاغ العملاء بالمواعيد الجديدة.",
        kind: "letter", audience: "all", authorId: ownerUser.id, authorName: ownerUser.name, pinned: true,
      },
    });
    await db.announcement.create({
      data: {
        clubId: clubA.id, title: "حملة تسويقية جديدة",
        body: "أطلقنا عرض الصيف بخصم ٢٥٪ — عرّفوا العملاء عليه عند الاستقبال.",
        kind: "announcement", audience: "all", authorId: ownerUser.id, authorName: ownerUser.name,
      },
    });
  }

  console.log("✓ تم إنشاء البيانات التجريبية");
  console.log("  مزود الحل: admin@nadi.sa / 123456");
  console.log("  فريق النادي: owner@club.sa | manager@club.sa | accountant@club.sa | hr@club.sa | reception@club.sa");
  console.log("  مدير فرع: branch@club.sa | موظف: staff@club.sa | مشترك: member@club.sa");
  console.log("  دخول المشترك بالجوال: " + (firstMember?.phone ?? "—") + " عبر /portal/login");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
