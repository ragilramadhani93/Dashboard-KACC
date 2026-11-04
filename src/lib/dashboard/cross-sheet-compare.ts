/**
 * Cross-sheet comparison helpers.
 *
 * Logic: given the current active sheet's date range, derive the previous-month
 * equivalent date range (same day-of-month), and find a SheetSource that covers
 * that range. Then fetch & cache its records.
 *
 * Example:
 *   Active sheet = "Oktober 2026", filter = 8-14 Oct
 *   → previous range = 8-14 Sep
 *   → find SheetSource whose dataRange covers Sep (e.g. "September 2026")
 *   → fetch records from that source, filter to 8-14 Sep
 */
import { parseCsvToObjects } from "@/lib/csv-parser";
import {
  deriveItemCategory,
  normalizePayment,
  parseNumber,
  parseSheetDate,
} from "@/lib/format";
import type { DashboardData, TransactionRecord } from "@/lib/types";
import {
  ensureSeedSheet,
  getSheetSourceById,
  listSheetSources,
  type SheetSourceDTO,
} from "@/lib/sheet-sources";

/** In-memory cache for cross-sheet fetches. Keyed by sheetSourceId. */
const crossSheetCache: Map<string, { records: TransactionRecord[]; dataRange: { start: string; end: string }; fetchedAt: number }> = new Map();
const CROSS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min (longer than active sheet, since historical data doesn't change)

function toIso(d: Date | null): string {
  if (!d) return "";
  return d.toISOString();
}

function transformRecords(raw: Record<string, string>[]): TransactionRecord[] {
  const records: TransactionRecord[] = [];
  for (const r of raw) {
    const openedAt = parseSheetDate(r["Opened Date"] || "");
    const closedAt = parseSheetDate(r["Closed Date"] || "");
    const isoOpened = toIso(openedAt);
    const isoClosed = toIso(closedAt);
    const item = (r["Item Name"] || "").trim();
    const outlet = (r["Outlet Name"] || "").trim();

    records.push({
      txn: (r["Transaction Number"] || "").trim(),
      openedAt: isoOpened,
      closedAt: isoClosed,
      date: isoOpened.slice(0, 10),
      hour: openedAt ? openedAt.getUTCHours() : -1,
      outlet,
      payment: normalizePayment(r["Payment Method"] || ""),
      txnType: (r["Transaction Type"] || "").trim(),
      status: (r["Status"] || "").trim(),
      menuCode: (r["Menu Code"] || "").trim(),
      item,
      menuType: (r["Menu Type"] || "").trim(),
      qty: parseNumber(r["Qty"]),
      price: parseNumber(r["Price"]),
      subTotal: parseNumber(r["Sub Total"]),
      discountItem: parseNumber(r["Total Discount Item"]),
      discountTrans: parseNumber(r["Discount Trans"]),
      tax: parseNumber(r["Tax"]),
      rounding: parseNumber(r["Rounding"]),
      grandTotal: parseNumber(r["Grand Total Final"]),
      paymentDetail: (r["Payment Detail"] || "").trim(),
      itemCategory: deriveItemCategory(item),
    });
  }
  return records;
}

async function fetchSheetRecords(sheetId: string, gid: string): Promise<{ text: string }> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/csv,application/csv,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    throw new Error(`Cross-sheet fetch failed: HTTP ${res.status}`);
  }
  const text = await res.text();
  return { text };
}

/**
 * Parse a YYYY-MM-DD date string into a Date object (UTC).
 */
function parseDate(s: string): Date | null {
  if (!s) return null;
  const t = Date.parse(s + "T00:00:00Z");
  if (isNaN(t)) return null;
  return new Date(t);
}

/**
 * Shift a YYYY-MM-DD date by N months, clamping day to last day of target month.
 * E.g. 2026-03-31 shifted -1 month = 2026-02-28 (clamped, not 2026-03-03).
 */
export function shiftMonth(dateStr: string, months: number): string {
  const d = parseDate(dateStr);
  if (!d) return "";
  const targetYear = d.getUTCFullYear();
  const targetMonth = d.getUTCMonth() + months;
  const targetDay = d.getUTCDate();
  // Construct target month
  const target = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0));
  // Last day of target month
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const clampedDay = Math.min(targetDay, lastDay);
  target.setUTCDate(clampedDay);
  return target.toISOString().slice(0, 10);
}

/**
 * Given a date range in current sheet, compute the "previous month, same day range".
 *
 * E.g. 2026-10-08 → 2026-10-14 maps to 2026-09-08 → 2026-09-14.
 *
 * Edge case: if current range starts on day 31, prev month may not have day 31 - we clamp.
 */
export function computePrevMonthRange(
  currentStart: string,
  currentEnd: string,
): { start: string; end: string } {
  return {
    start: shiftMonth(currentStart, -1),
    end: shiftMonth(currentEnd, -1),
  };
}

/**
 * Find the SheetSource whose data range best covers the given target date range.
 * Returns null if no sheet covers any date in the target range.
 *
 * Strategy: pick the sheet whose [dataStart, dataEnd] intersects the target range,
 * preferring the one with the most overlap.
 */
export async function findSheetForRange(
  targetStart: string,
  targetEnd: string,
  excludeId?: string,
): Promise<SheetSourceDTO | null> {
  await ensureSeedSheet();
  const sources = await listSheetSources();
  let best: SheetSourceDTO | null = null;
  let bestOverlap = 0;

  const tStart = parseDate(targetStart);
  const tEnd = parseDate(targetEnd);
  if (!tStart || !tEnd) return null;
  const tStartMs = tStart.getTime();
  const tEndMs = tEnd.getTime() + 24 * 60 * 60 * 1000; // inclusive end

  for (const s of sources) {
    if (excludeId && s.id === excludeId) continue;
    if (!s.dataStart || !s.dataEnd) continue;
    const sStart = parseDate(s.dataStart);
    const sEnd = parseDate(s.dataEnd);
    if (!sStart || !sEnd) continue;
    const sStartMs = sStart.getTime();
    const sEndMs = sEnd.getTime() + 24 * 60 * 60 * 1000;
    const overlapMs = Math.max(0, Math.min(tEndMs, sEndMs) - Math.max(tStartMs, sStartMs));
    if (overlapMs > bestOverlap) {
      bestOverlap = overlapMs;
      best = s;
    }
  }
  return best;
}

/**
 * Fetch & cache all records from a sheet source by ID.
 * Used for cross-sheet comparison.
 */
export async function fetchSheetRecordsBySourceId(
  sourceId: string,
  forceRefresh = false,
): Promise<{ records: TransactionRecord[]; dataRange: { start: string; end: string } }> {
  // Check cache
  if (!forceRefresh) {
    const cached = crossSheetCache.get(sourceId);
    if (cached && Date.now() - cached.fetchedAt < CROSS_CACHE_TTL_MS) {
      return { records: cached.records, dataRange: cached.dataRange };
    }
  }

  const source = await getSheetSourceById(sourceId);
  if (!source) {
    throw new Error(`Sheet source ${sourceId} tidak ditemukan`);
  }

  const { text } = await fetchSheetRecords(source.sheetId, source.gid);
  const { records: rawRecords } = parseCsvToObjects(text);
  const records = transformRecords(rawRecords);

  // Compute date range
  let minDate = "9999-12-31";
  let maxDate = "0000-01-01";
  for (const r of records) {
    if (r.date && r.date < minDate) minDate = r.date;
    if (r.date && r.date > maxDate) maxDate = r.date;
  }
  const dataRange = {
    start: minDate === "9999-12-31" ? "" : minDate,
    end: maxDate === "0000-01-01" ? "" : maxDate,
  };

  crossSheetCache.set(sourceId, {
    records,
    dataRange,
    fetchedAt: Date.now(),
  });

  return { records, dataRange };
}

/**
 * Filter records to a specific date range (inclusive).
 */
export function filterRecordsByDateRange(
  records: TransactionRecord[],
  start: string,
  end: string,
): TransactionRecord[] {
  if (!start || !end) return [];
  return records.filter((r) => r.date >= start && r.date <= end);
}

export interface CrossSheetCompareResult {
  /** Source used for previous-month data, or null if not available */
  prevSource: SheetSourceDTO | null;
  /** Records from previous-month source, filtered to the prev-month range */
  prevRecords: TransactionRecord[];
  /** Date range in previous month (same day-of-month as current range) */
  prevDateRange: { start: string; end: string };
  /** Active sheet's source ID (for context) */
  activeSourceId: string;
  /** Active sheet's label (for display) */
  activeSourceLabel: string;
  /** Whether previous month data is fully available (true) or partial/missing (false) */
  available: boolean;
  /** Reason if not available */
  unavailableReason?: string;
}

/**
 * High-level: given the active sheet ID and current date range, fetch
 * previous-month same-day records from another sheet (if exists).
 *
 * Returns prevSource=null & available=false if no sheet covers the prev range.
 */
export async function fetchPrevMonthCompare(
  activeSourceId: string,
  currentDateRange: { start: string; end: string },
): Promise<CrossSheetCompareResult> {
  await ensureSeedSheet();
  const activeSource = await getSheetSourceById(activeSourceId);
  const activeLabel = activeSource?.label ?? "";

  // 1. Compute prev-month date range
  const prevDateRange = computePrevMonthRange(currentDateRange.start, currentDateRange.end);

  // 2. Find a sheet that covers that range
  const prevSource = await findSheetForRange(prevDateRange.start, prevDateRange.end, activeSourceId);

  if (!prevSource) {
    return {
      prevSource: null,
      prevRecords: [],
      prevDateRange,
      activeSourceId,
      activeSourceLabel: activeLabel,
      available: false,
      unavailableReason: `Tidak ada sheet yang mencakup periode ${prevDateRange.start} → ${prevDateRange.end}. Tambahkan sheet untuk bulan tersebut di Kelola Sheet.`,
    };
  }

  // 3. Fetch records from prev source
  let prevRecords: TransactionRecord[] = [];
  try {
    const { records } = await fetchSheetRecordsBySourceId(prevSource.id, false);
    prevRecords = filterRecordsByDateRange(records, prevDateRange.start, prevDateRange.end);
  } catch (e) {
    return {
      prevSource,
      prevRecords: [],
      prevDateRange,
      activeSourceId,
      activeSourceLabel: activeLabel,
      available: false,
      unavailableReason: `Gagal fetch sheet "${prevSource.label}": ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }

  return {
    prevSource,
    prevRecords,
    prevDateRange,
    activeSourceId,
    activeSourceLabel: activeLabel,
    available: prevRecords.length > 0,
    unavailableReason: prevRecords.length === 0
      ? `Sheet "${prevSource.label}" ditemukan tapi tidak ada data di range ${prevDateRange.start} → ${prevDateRange.end}.`
      : undefined,
  };
}
