// ═══════════════════════════════════════════════════════════
// محرك الموارد البشرية — وفق نظام العمل والتأمينات السعودي
// ═══════════════════════════════════════════════════════════

const round = (n: number) => Math.round(n * 100) / 100;

// ───────── التأمينات الاجتماعية (GOSI) ─────────
// السعودي: 9.75% على الموظف (9% معاشات + 0.75% ساند)
//          11.75% على المنشأة (9% معاشات + 0.75% ساند + 2% أخطار مهنية)
// غير السعودي: 2% أخطار مهنية على المنشأة فقط
export const GOSI = {
  saudiEmployee: 0.0975,
  saudiEmployer: 0.1175,
  expatEmployer: 0.02,
  ceiling: 45000, // الحد الأعلى للأجر الخاضع
};

export function gosiFor(opts: {
  basicSAR: number;
  housingSAR: number;
  isSaudi: boolean;
  subject: boolean;
}) {
  if (!opts.subject) return { employee: 0, employer: 0, base: 0 };

  // الأجر الخاضع = الأساسي + بدل السكن، بحد أقصى 45,000
  const base = Math.min(GOSI.ceiling, opts.basicSAR + opts.housingSAR);

  return {
    base: round(base),
    employee: round(opts.isSaudi ? base * GOSI.saudiEmployee : 0),
    employer: round(base * (opts.isSaudi ? GOSI.saudiEmployer : GOSI.expatEmployer)),
  };
}

// ───────── مكافأة نهاية الخدمة ─────────
// نصف شهر عن كل سنة من أول 5 سنوات، وشهر كامل عن كل سنة بعدها
export function endOfService(opts: { totalMonthlySAR: number; hireDate: Date; endDate?: Date }) {
  const end = opts.endDate ?? new Date();
  const years = (end.getTime() - opts.hireDate.getTime()) / (365.25 * 86400000);
  if (years < 1) return { years: round(years), amountSAR: 0 };

  const firstFive = Math.min(years, 5);
  const beyond = Math.max(0, years - 5);
  const amount = opts.totalMonthlySAR * (firstFive * 0.5 + beyond * 1);

  return { years: round(years), amountSAR: round(amount) };
}

// ───────── رصيد الإجازات ─────────
// 21 يوماً سنوياً حتى 5 سنوات، و30 يوماً بعدها (نظام العمل)
export function leaveEntitlement(hireDate: Date, configuredDays: number) {
  const years = (Date.now() - hireDate.getTime()) / (365.25 * 86400000);
  const statutory = years >= 5 ? 30 : 21;
  const annual = Math.max(configuredDays, statutory);
  // الرصيد المستحق حتى اليوم من السنة الحالية
  const accrued = Math.min(annual, (annual / 12) * ((new Date().getMonth() + 1)));
  return { annualDays: annual, accruedDays: Math.round(accrued), serviceYears: round(years) };
}

// ───────── المسافة الجغرافية (Haversine) ─────────
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}

// ───────── الانضباط: تأخير وخروج مبكر وإضافي ─────────
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function shiftMetrics(opts: {
  checkIn?: Date | null;
  checkOut?: Date | null;
  shiftStart: string;
  shiftEnd: string;
  graceMinutes?: number;
}) {
  const grace = opts.graceMinutes ?? 10;
  const startMin = toMinutes(opts.shiftStart);
  const endMin = toMinutes(opts.shiftEnd);

  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let overtimeMinutes = 0;

  if (opts.checkIn) {
    const inMin = opts.checkIn.getHours() * 60 + opts.checkIn.getMinutes();
    lateMinutes = Math.max(0, inMin - startMin - grace);
  }
  if (opts.checkOut) {
    const outMin = opts.checkOut.getHours() * 60 + opts.checkOut.getMinutes();
    earlyLeaveMinutes = Math.max(0, endMin - outMin);
    overtimeMinutes = Math.max(0, outMin - endMin);
  }

  const workedMinutes =
    opts.checkIn && opts.checkOut
      ? Math.max(0, (opts.checkOut.getTime() - opts.checkIn.getTime()) / 60000)
      : 0;

  return {
    lateMinutes: Math.round(lateMinutes),
    earlyLeaveMinutes: Math.round(earlyLeaveMinutes),
    overtimeMinutes: Math.round(overtimeMinutes),
    workedHours: round(workedMinutes / 60),
  };
}

// ───────── احتساب الراتب الشهري ─────────
// الأجر اليومي = إجمالي الراتب ÷ 30 (المتعارف عليه في النظام)
// الساعة الإضافية = أجر الساعة × 1.5
export function computePayroll(opts: {
  basicSAR: number;
  housingSAR: number;
  transportSAR: number;
  otherAllowSAR: number;
  isSaudi: boolean;
  gosiSubject: boolean;
  absentDays: number;
  overtimeMinutes: number;
  bonusSAR?: number;
  otherDeductionsSAR?: number;
}) {
  const gross = opts.basicSAR + opts.housingSAR + opts.transportSAR + opts.otherAllowSAR;
  const dailyRate = gross / 30;
  const hourlyRate = gross / 30 / 8;

  const absenceSAR = round(dailyRate * opts.absentDays);
  const overtimeSAR = round((opts.overtimeMinutes / 60) * hourlyRate * 1.5);

  const gosi = gosiFor({
    basicSAR: opts.basicSAR,
    housingSAR: opts.housingSAR,
    isSaudi: opts.isSaudi,
    subject: opts.gosiSubject,
  });

  const bonus = opts.bonusSAR ?? 0;
  const otherDed = opts.otherDeductionsSAR ?? 0;
  const net = round(gross + overtimeSAR + bonus - absenceSAR - gosi.employee - otherDed);

  return {
    grossSAR: round(gross),
    absenceSAR,
    overtimeSAR,
    bonusSAR: bonus,
    gosiEmpSAR: gosi.employee,
    gosiClubSAR: gosi.employer,
    otherDeductionsSAR: otherDed,
    netSAR: net,
    // التكلفة الفعلية على النادي = الإجمالي + حصة المنشأة
    clubCostSAR: round(gross + overtimeSAR + bonus - absenceSAR + gosi.employer),
  };
}

// تنبيهات انتهاء المستندات
export function expiryAlerts(emp: { idExpiresAt?: Date | null; contractEndsAt?: Date | null }) {
  const alerts: { label: string; daysLeft: number; tone: "amber" | "red" }[] = [];
  const check = (d: Date | null | undefined, label: string) => {
    if (!d) return;
    const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
    if (days <= 60) alerts.push({ label, daysLeft: days, tone: days <= 14 ? "red" : "amber" });
  };
  check(emp.idExpiresAt, "الهوية / الإقامة");
  check(emp.contractEndsAt, "العقد");
  return alerts;
}
