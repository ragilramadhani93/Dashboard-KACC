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

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculates Month-End Sales Forecast based on actual daily trend data.
 * Applies Day-of-Week seasonality weighting (e.g. weekends vs weekdays)
 * to estimate remaining days through the last calendar day of the active month.
 */
export function calculateSalesForecast(
  dailyTrend: TrendPoint[],
  prevMonthRevenue: number | null = null,
): SalesForecastResult | null {
  if (!dailyTrend || dailyTrend.length === 0) return null;

  // Use the latest transaction date in the trend
  const sorted = [...dailyTrend].sort((a, b) => a.date.localeCompare(b.date));
  const lastPoint = sorted[sorted.length - 1];
  const lastDate = new Date(`${lastPoint.date}T00:00:00`);
  if (isNaN(lastDate.getTime())) return null;

  const year = lastDate.getFullYear();
  const month = lastDate.getMonth() + 1; // 1-12
  const totalDaysInMonth = getDaysInMonth(year, month);
  const elapsedDayNumber = lastDate.getDate();

  const actualRevenue = sorted.reduce((sum, d) => sum + d.revenue, 0);
  const actualTxn = sorted.reduce((sum, d) => sum + d.transactions, 0);

  const monthName = lastDate.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  // If the month is already complete
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
      overallDailyAvg: Math.round(actualRevenue / totalDaysInMonth),
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

  // Calculate Day-of-Week (DoW) averages (0 = Sunday, 1 = Monday, ... 6 = Saturday)
  const dowTotals = [0, 0, 0, 0, 0, 0, 0];
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];

  for (const d of sorted) {
    const dt = new Date(`${d.date}T00:00:00`);
    const dow = dt.getDay();
    dowTotals[dow] += d.revenue;
    dowCounts[dow] += 1;
  }

  const overallDailyAvg = actualRevenue / sorted.length;
  const dowAverages = dowTotals.map((tot, idx) =>
    dowCounts[idx] > 0 ? tot / dowCounts[idx] : overallDailyAvg,
  );

  // Project remaining days from (elapsedDayNumber + 1) to totalDaysInMonth
  const remainingDays = totalDaysInMonth - elapsedDayNumber;
  const projectedDays: ForecastDay[] = [];
  let remainingProjectedRevenue = 0;

  for (let day = elapsedDayNumber + 1; day <= totalDaysInMonth; day++) {
    const dt = new Date(year, month - 1, day);
    const dow = dt.getDay();
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // Blend: 85% DoW average + 15% overall average to prevent over-skewing
    const dayForecast =
      dowCounts[dow] > 0
        ? dowAverages[dow] * 0.85 + overallDailyAvg * 0.15
        : overallDailyAvg;

    remainingProjectedRevenue += dayForecast;
    projectedDays.push({
      date: dateStr,
      revenue: Math.round(dayForecast),
      isForecast: true,
      dayOfWeek: dt.toLocaleDateString("id-ID", { weekday: "short" }),
    });
  }

  const projectedTotalRevenue = Math.round(actualRevenue + remainingProjectedRevenue);
  const runRateRequired = Math.round(remainingProjectedRevenue / remainingDays);
  const percentElapsed = Math.round((elapsedDayNumber / totalDaysInMonth) * 100);
  const currentPacing = Math.round((actualRevenue / projectedTotalRevenue) * 100);

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
}
