/**
 * Client-side aggregation utilities for KACC dashboard.
 * All functions are pure and operate on TransactionRecord arrays.
 */
import type {
  TransactionRecord,
  KpiSummary,
  TrendPoint,
  OutletAgg,
  ItemAgg,
  PaymentAgg,
  HourAgg,
  HeatmapCell,
} from "@/lib/types";

export interface FilterState {
  dateStart: string;
  dateEnd: string;
  outlets: string[];
  payments: string[];
  itemCategories: string[];
  menuTypes: string[];
}

export interface CompareState {
  enabled: boolean;
  prevDateStart: string;
  prevDateEnd: string;
}

export function applyFilter(records: TransactionRecord[], f: FilterState): TransactionRecord[] {
  return records.filter((r) => {
    if (f.dateStart && r.date < f.dateStart) return false;
    if (f.dateEnd && r.date > f.dateEnd) return false;
    if (f.outlets.length > 0 && !f.outlets.includes(r.outlet)) return false;
    if (f.payments.length > 0 && !f.payments.includes(r.payment)) return false;
    if (f.itemCategories.length > 0 && !f.itemCategories.includes(r.itemCategory))
      return false;
    if (f.menuTypes.length > 0 && !f.menuTypes.includes(r.menuType)) return false;
    return true;
  });
}

/**
 * Outlet consistency helpers - untuk handle outlet yang buka tidak dari tanggal 1.
 * Banyak outlet KACC jadwalnya partial (weekend-only, hari kerja saja, dll).
 * Saat compare periode ini vs bulan lalu, outlet yang baru buka/tutup bisa bias trend.
 */

export interface OutletActivity {
  outlet: string;
  firstSaleDate: string;
  lastSaleDate: string;
  activeDates: Set<string>;
  activeDaysCount: number;
  totalRevenue: number;
}

export function computeOutletActivity(
  records: TransactionRecord[],
): Map<string, OutletActivity> {
  const map = new Map<string, OutletActivity>();
  for (const r of records) {
    if (r.status !== "Close") continue;
    const o = r.outlet;
    if (!o) continue;
    if (!map.has(o)) {
      map.set(o, {
        outlet: o,
        firstSaleDate: r.date,
        lastSaleDate: r.date,
        activeDates: new Set(),
        activeDaysCount: 0,
        totalRevenue: 0,
      });
    }
    const e = map.get(o)!;
    if (r.date && (!e.firstSaleDate || r.date < e.firstSaleDate)) e.firstSaleDate = r.date;
    if (r.date && (!e.lastSaleDate || r.date > e.lastSaleDate)) e.lastSaleDate = r.date;
    if (r.date) e.activeDates.add(r.date);
    e.totalRevenue += r.grandTotal;
  }
  for (const e of map.values()) {
    e.activeDaysCount = e.activeDates.size;
  }
  return map;
}

/**
 * Tentukan outlet mana yang "konsisten" - aktif di SEMUA tanggal dari dateStart → dateEnd.
 * Kalau dateStart/dateEnd kosong, fallback ke range data sebenarnya.
 */
export function findConsistentOutlets(
  records: TransactionRecord[],
  dateStart: string,
  dateEnd: string,
): Set<string> {
  let effectiveStart = dateStart;
  let effectiveEnd = dateEnd;
  if (!effectiveStart || !effectiveEnd) {
    let minDate = "9999-12-31";
    let maxDate = "0000-01-01";
    for (const r of records) {
      if (r.date && r.date < minDate) minDate = r.date;
      if (r.date && r.date > maxDate) maxDate = r.date;
    }
    if (!effectiveStart) effectiveStart = minDate === "9999-12-31" ? "" : minDate;
    if (!effectiveEnd) effectiveEnd = maxDate === "0000-01-01" ? "" : maxDate;
  }
  if (!effectiveStart || !effectiveEnd) return new Set();

  const dateList = buildDateList(effectiveStart, effectiveEnd);
  if (dateList.length === 0) return new Set();
  const fullDateSet = new Set(dateList);

  const activity = computeOutletActivity(records);
  const consistent = new Set<string>();
  for (const [outlet, act] of activity) {
    let allActive = true;
    for (const d of fullDateSet) {
      if (!act.activeDates.has(d)) {
        allActive = false;
        break;
      }
    }
    if (allActive) consistent.add(outlet);
  }
  return consistent;
}

/**
 * Versi permisif: outlet dianggap konsisten kalau aktif di minimal `minActivePct` (default 80%)
 * dari tanggal di periode. Berguna kalau strict 100% terlalu ketat (mis. hari libur nasional).
 */
export function findConsistentOutletsByPct(
  records: TransactionRecord[],
  dateStart: string,
  dateEnd: string,
  minActivePct = 0.8,
): Set<string> {
  let effectiveStart = dateStart;
  let effectiveEnd = dateEnd;
  if (!effectiveStart || !effectiveEnd) {
    let minDate = "9999-12-31";
    let maxDate = "0000-01-01";
    for (const r of records) {
      if (r.date && r.date < minDate) minDate = r.date;
      if (r.date && r.date > maxDate) maxDate = r.date;
    }
    if (!effectiveStart) effectiveStart = minDate === "9999-12-31" ? "" : minDate;
    if (!effectiveEnd) effectiveEnd = maxDate === "0000-01-01" ? "" : maxDate;
  }
  if (!effectiveStart || !effectiveEnd) return new Set();

  const dateList = buildDateList(effectiveStart, effectiveEnd);
  if (dateList.length === 0) return new Set();
  const minDaysRequired = Math.ceil(dateList.length * minActivePct);

  const activity = computeOutletActivity(records);
  const consistent = new Set<string>();
  for (const [outlet, act] of activity) {
    if (act.activeDaysCount >= minDaysRequired) {
      consistent.add(outlet);
    }
  }
  return consistent;
}

/**
 * Filter records hanya dari outlet yang konsisten.
 * Dipakai untuk trend harian supaya perbandingan apple-to-apple.
 */
export function filterToConsistentOutlets(
  records: TransactionRecord[],
  consistentOutlets: Set<string>,
): TransactionRecord[] {
  if (consistentOutlets.size === 0) return records;
  return records.filter((r) => consistentOutlets.has(r.outlet));
}

export function computeKpi(records: TransactionRecord[]): KpiSummary {
  let revenue = 0;
  let items = 0;
  const txnSet = new Set<string>();
  const outletSet = new Set<string>();
  const itemSet = new Set<string>();
  const hourBuckets: Record<number, number> = {};

  for (const r of records) {
    if (r.status !== "Close") continue;
    revenue += r.grandTotal;
    items += r.qty;
    txnSet.add(r.txn);
    outletSet.add(r.outlet);
    itemSet.add(r.item);
    if (r.hour >= 0) hourBuckets[r.hour] = (hourBuckets[r.hour] || 0) + r.grandTotal;
  }

  const transactions = txnSet.size;
  const aov = transactions > 0 ? revenue / transactions : 0;
  const avgItemsPerTxn = transactions > 0 ? items / transactions : 0;

  let peakHour = 0;
  let peakVal = -1;
  for (const h of Object.keys(hourBuckets)) {
    const v = hourBuckets[Number(h)];
    if (v > peakVal) {
      peakVal = v;
      peakHour = Number(h);
    }
  }

  return {
    revenue,
    transactions,
    items,
    outlets: outletSet.size,
    aov,
    avgItemsPerTxn,
    uniqueItemTypes: itemSet.size,
    peakHour,
  };
}

export function computeDailyTrend(records: TransactionRecord[]): TrendPoint[] {
  const map = new Map<string, { revenue: number; transactions: Set<string>; items: number }>();
  for (const r of records) {
    if (r.status !== "Close") continue;
    const d = r.date;
    if (!d) continue;
    if (!map.has(d)) map.set(d, { revenue: 0, transactions: new Set(), items: 0 });
    const e = map.get(d)!;
    e.revenue += r.grandTotal;
    e.transactions.add(r.txn);
    e.items += r.qty;
  }
  return [...map.entries()]
    .map(([date, e]) => ({
      date,
      revenue: e.revenue,
      transactions: e.transactions.size,
      items: e.items,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeOutletAgg(records: TransactionRecord[], limit?: number): OutletAgg[] {
  const map = new Map<string, { revenue: number; transactions: Set<string>; items: number }>();
  for (const r of records) {
    if (r.status !== "Close") continue;
    if (!map.has(r.outlet)) map.set(r.outlet, { revenue: 0, transactions: new Set(), items: 0 });
    const e = map.get(r.outlet)!;
    e.revenue += r.grandTotal;
    e.transactions.add(r.txn);
    e.items += r.qty;
  }
  const result = [...map.entries()].map(([outlet, e]) => ({
    outlet,
    revenue: e.revenue,
    transactions: e.transactions.size,
    items: e.items,
    avgPerTxn: e.transactions.size > 0 ? e.revenue / e.transactions.size : 0,
  }));
  result.sort((a, b) => b.revenue - a.revenue);
  return limit ? result.slice(0, limit) : result;
}

export function computeItemAgg(records: TransactionRecord[], limit?: number): ItemAgg[] {
  const map = new Map<string, { qty: number; revenue: number; transactions: Set<string>; category: string }>();
  for (const r of records) {
    if (r.status !== "Close") continue;
    if (!map.has(r.item)) map.set(r.item, { qty: 0, revenue: 0, transactions: new Set(), category: r.itemCategory });
    const e = map.get(r.item)!;
    e.qty += r.qty;
    e.revenue += r.grandTotal;
    e.transactions.add(r.txn);
  }
  const result = [...map.entries()].map(([item, e]) => ({
    item,
    category: e.category,
    qty: e.qty,
    revenue: e.revenue,
    transactions: e.transactions.size,
  }));
  result.sort((a, b) => b.revenue - a.revenue);
  return limit ? result.slice(0, limit) : result;
}

export function computePaymentAgg(records: TransactionRecord[]): PaymentAgg[] {
  const map = new Map<string, { revenue: number; transactions: Set<string> }>();
  let totalRev = 0;
  for (const r of records) {
    if (r.status !== "Close") continue;
    if (!map.has(r.payment)) map.set(r.payment, { revenue: 0, transactions: new Set() });
    const e = map.get(r.payment)!;
    e.revenue += r.grandTotal;
    e.transactions.add(r.txn);
    totalRev += r.grandTotal;
  }
  const result = [...map.entries()].map(([payment, e]) => ({
    payment,
    revenue: e.revenue,
    transactions: e.transactions.size,
    share: totalRev > 0 ? (e.revenue / totalRev) * 100 : 0,
  }));
  result.sort((a, b) => b.revenue - a.revenue);
  return result;
}

export function computeHourAgg(records: TransactionRecord[]): HourAgg[] {
  const map = new Map<number, { revenue: number; transactions: Set<string> }>();
  for (const r of records) {
    if (r.status !== "Close") continue;
    if (r.hour < 0) continue;
    if (!map.has(r.hour)) map.set(r.hour, { revenue: 0, transactions: new Set() });
    const e = map.get(r.hour)!;
    e.revenue += r.grandTotal;
    e.transactions.add(r.txn);
  }
  // Fill in 0..23 hours
  const allHours: HourAgg[] = [];
  for (let h = 0; h < 24; h++) {
    const e = map.get(h);
    allHours.push({
      hour: h,
      revenue: e?.revenue || 0,
      transactions: e?.transactions.size || 0,
    });
  }
  return allHours;
}

export function computeHeatmap(
  records: TransactionRecord[],
  topOutlets: string[],
  dateList: string[],
): HeatmapCell[][] {
  // rows = topOutlets, columns = dateList
  const map = new Map<string, { revenue: number; transactions: Set<string> }>();
  for (const r of records) {
    if (r.status !== "Close") continue;
    const key = `${r.outlet}|${r.date}`;
    if (!map.has(key)) map.set(key, { revenue: 0, transactions: new Set() });
    const e = map.get(key)!;
    e.revenue += r.grandTotal;
    e.transactions.add(r.txn);
  }
  return topOutlets.map((outlet) =>
    dateList.map((date) => {
      const e = map.get(`${outlet}|${date}`);
      return {
        outlet,
        date,
        revenue: e?.revenue || 0,
        transactions: e?.transactions.size || 0,
      };
    }),
  );
}

/**
 * Build a list of dates from start to end inclusive (YYYY-MM-DD).
 */
export function buildDateList(start: string, end: string): string[] {
  const result: string[] = [];
  if (!start || !end) return result;
  const startT = Date.parse(start + "T00:00:00Z");
  const endT = Date.parse(end + "T00:00:00Z");
  if (isNaN(startT) || isNaN(endT)) return result;
  for (let t = startT; t <= endT; t += 24 * 60 * 60 * 1000) {
    const d = new Date(t);
    const s = d.toISOString().slice(0, 10);
    result.push(s);
  }
  return result;
}

/**
 * Subtract N days from a YYYY-MM-DD date string.
 */
export function shiftDate(dateStr: string, days: number): string {
  if (!dateStr) return "";
  const t = Date.parse(dateStr + "T00:00:00Z");
  if (isNaN(t)) return "";
  const shifted = t + days * 24 * 60 * 60 * 1000;
  return new Date(shifted).toISOString().slice(0, 10);
}

/**
 * Format a YYYY-MM-DD date string to "DD Mon" (e.g. "12 Okt").
 */
export function formatDateShort(dateStr: string): string {
  if (!dateStr) return "-";
  const t = Date.parse(dateStr + "T00:00:00Z");
  if (isNaN(t)) return dateStr;
  const d = new Date(t);
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

/**
 * Format YYYY-MM-DD to "Sen, 12 Okt 2026" (Indonesian day-of-week).
 */
export function formatDateLong(dateStr: string): string {
  if (!dateStr) return "-";
  const t = Date.parse(dateStr + "T00:00:00Z");
  if (isNaN(t)) return dateStr;
  const d = new Date(t);
  const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  return `${days[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Compute outlet alert status based on revenue threshold.
 * If outlet revenue < thresholdPct * averageRevenue, it's an alert.
 */
export function getOutletAlerts(outlets: OutletAgg[], thresholdPct = 0.5): string[] {
  if (outlets.length === 0) return [];
  const avgRev = outlets.reduce((s, o) => s + o.revenue, 0) / outlets.length;
  const threshold = avgRev * thresholdPct;
  return outlets.filter((o) => o.revenue < threshold).map((o) => o.outlet);
}
