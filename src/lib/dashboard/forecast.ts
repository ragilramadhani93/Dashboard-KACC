import type { TrendPoint } from "@/lib/types";

export interface ForecastDay {
  date: string;
  revenue: number;
  isForecast: true;
  dayOfWeek: string;
}

export interface SalesForecastResult {
  isCompleteMonth: boolean;
  actualRevenue: number;
  actualTxn: number;
  projectedTotalRevenue: number;
  remainingProjectedRevenue: number;
  remainingDays: number;
  elapsedDays: number;
  totalDaysInMonth: number;
  runRateRequired: number;
  overallDailyAvg: number;
  percentElapsed: number;
  currentPacing: number;
  projectedDays: ForecastDay[];
  monthName: string;
  conservative: number;
  optimistic: number;
  growthVsPrevMonthPct: number | null;
  prevMonthRevenue: number | null;
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DOW_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculates Month-End Sales Forecast based on actual daily trend data.
 * Pure and deterministic (no Intl locale hydration discrepancies).
 */
export function calculateSalesForecast(
  dailyTrend: TrendPoint[] | null | undefined,
  prevMonthRevenue: number | null = null,
): SalesForecastResult | null {
  try {
    if (!dailyTrend || !Array.isArray(dailyTrend) || dailyTrend.length === 0) {
      return null;
    }

    // Filter to valid points with YYYY-MM-DD date strings
    const valid = dailyTrend.filter(
      (d) =>
        d &&
        typeof d.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(d.date) &&
        typeof d.revenue === "number",
    );
    if (valid.length === 0) return null;

    const sorted = [...valid].sort((a, b) => a.date.localeCompare(b.date));
    const lastPoint = sorted[sorted.length - 1];

    const [yStr, mStr, dStr] = lastPoint.date.split("-");
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10); // 1-12
    const elapsedDayNumber = parseInt(dStr, 10);

    if (isNaN(year) || isNaN(month) || isNaN(elapsedDayNumber)) return null;

    const totalDaysInMonth = getDaysInMonth(year, month);
    const actualRevenue = sorted.reduce((sum, d) => sum + (d.revenue || 0), 0);
    const actualTxn = sorted.reduce((sum, d) => sum + (d.transactions || 0), 0);

    const monthName = `${MONTH_NAMES[month - 1] ?? ""} ${year}`.trim();

    // If month is already completed
    if (elapsedDayNumber >= totalDaysInMonth) {
      const growth =
        prevMonthRevenue && prevMonthRevenue > 0
          ? ((actualRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
          : null;

      return {
        isCompleteMonth: true,
        actualRevenue,
        actualTxn,
        projectedTotalRevenue: actualRevenue,
        remainingProjectedRevenue: 0,
        remainingDays: 0,
        elapsedDays: totalDaysInMonth,
        totalDaysInMonth,
        runRateRequired: 0,
        overallDailyAvg: Math.round(actualRevenue / (totalDaysInMonth || 1)),
        percentElapsed: 100,
        currentPacing: 100,
        projectedDays: [],
        monthName,
        conservative: actualRevenue,
        optimistic: actualRevenue,
        growthVsPrevMonthPct: growth,
        prevMonthRevenue,
      };
    }

    // Day-of-Week averages
    const dowTotals = [0, 0, 0, 0, 0, 0, 0];
    const dowCounts = [0, 0, 0, 0, 0, 0, 0];

    for (const d of sorted) {
      const dt = new Date(year, month - 1, parseInt(d.date.split("-")[2], 10));
      const dow = dt.getDay();
      dowTotals[dow] += d.revenue || 0;
      dowCounts[dow] += 1;
    }

    const overallDailyAvg = sorted.length > 0 ? actualRevenue / sorted.length : 0;
    const dowAverages = dowTotals.map((tot, idx) =>
      dowCounts[idx] > 0 ? tot / dowCounts[idx] : overallDailyAvg,
    );

    const remainingDays = Math.max(0, totalDaysInMonth - elapsedDayNumber);
    const projectedDays: ForecastDay[] = [];
    let remainingProjectedRevenue = 0;

    for (let day = elapsedDayNumber + 1; day <= totalDaysInMonth; day++) {
      const dt = new Date(year, month - 1, day);
      const dow = dt.getDay();
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const dayForecast =
        dowCounts[dow] > 0
          ? dowAverages[dow] * 0.85 + overallDailyAvg * 0.15
          : overallDailyAvg;

      remainingProjectedRevenue += dayForecast;
      projectedDays.push({
        date: dateStr,
        revenue: Math.round(dayForecast),
        isForecast: true,
        dayOfWeek: DOW_NAMES[dow] ?? "",
      });
    }

    const projectedTotalRevenue = Math.round(actualRevenue + remainingProjectedRevenue);
    const runRateRequired =
      remainingDays > 0 ? Math.round(remainingProjectedRevenue / remainingDays) : 0;
    const percentElapsed = Math.min(
      100,
      Math.round((elapsedDayNumber / totalDaysInMonth) * 100),
    );
    const currentPacing =
      projectedTotalRevenue > 0
        ? Math.min(100, Math.round((actualRevenue / projectedTotalRevenue) * 100))
        : 0;

    const growthVsPrevMonthPct =
      prevMonthRevenue && prevMonthRevenue > 0
        ? ((projectedTotalRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
        : null;

    return {
      isCompleteMonth: false,
      actualRevenue,
      actualTxn,
      projectedTotalRevenue,
      remainingProjectedRevenue: Math.round(remainingProjectedRevenue),
      remainingDays,
      elapsedDays: elapsedDayNumber,
      totalDaysInMonth,
      runRateRequired,
      overallDailyAvg: Math.round(overallDailyAvg),
      percentElapsed,
      currentPacing,
      projectedDays,
      monthName,
      conservative: Math.round(actualRevenue + remainingProjectedRevenue * 0.9),
      optimistic: Math.round(actualRevenue + remainingProjectedRevenue * 1.1),
      growthVsPrevMonthPct,
      prevMonthRevenue,
    };
  } catch (err) {
    console.error("calculateSalesForecast error:", err);
    return null;
  }
}
