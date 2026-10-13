import { NextResponse } from "next/server";
import { buildCsvUrl } from "@/lib/sheet-config";
import { parseCsvToObjects } from "@/lib/csv-parser";
import {
  deriveItemCategory,
  normalizePayment,
  parseNumber,
  parseSheetDate,
} from "@/lib/format";
import type { DashboardData, TransactionRecord } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// In-memory cache with TTL (5 min). The user wants auto-fetch on page load,
// so this keeps the dashboard responsive while still re-checking the sheet.
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  data: DashboardData;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

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

function buildMeta(records: TransactionRecord[], fetchedAt: number): DashboardData["meta"] {
  const outlets = new Set<string>();
  const paymentMethods = new Set<string>();
  const menuTypes = new Set<string>();
  const items = new Set<string>();
  const itemCategories = new Set<string>();
  let minDate = "9999-12-31";
  let maxDate = "0000-01-01";

  for (const r of records) {
    if (r.outlet) outlets.add(r.outlet);
    if (r.payment) paymentMethods.add(r.payment);
    if (r.menuType) menuTypes.add(r.menuType);
    if (r.item) items.add(r.item);
    if (r.itemCategory) itemCategories.add(r.itemCategory);
    if (r.date && r.date < minDate) minDate = r.date;
    if (r.date && r.date > maxDate) maxDate = r.date;
  }

  const sortedOutlets = [...outlets].sort((a, b) => a.localeCompare(b, "id"));

  return {
    lastUpdated: new Date(fetchedAt).toISOString(),
    rowCount: records.length,
    dateRange: {
      start: minDate === "9999-12-31" ? "" : minDate,
      end: maxDate === "0000-01-01" ? "" : maxDate,
    },
    outlets: sortedOutlets,
    paymentMethods: [...paymentMethods].sort((a, b) => a.localeCompare(b, "id")),
    menuTypes: [...menuTypes].sort(),
    items: [...items].sort((a, b) => a.localeCompare(b, "id")),
    itemCategories: [...itemCategories].sort(),
    source: buildCsvUrl(),
    cachedAt: new Date(fetchedAt).toISOString(),
  };
}

async function fetchSheet(): Promise<DashboardData> {
  const url = buildCsvUrl();
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "KACC-Dashboard/1.0",
    },
  });
  if (!res.ok) {
    throw new Error(`Google Sheets fetch failed: HTTP ${res.status}`);
  }
  const text = await res.text();
  const { records: rawRecords } = parseCsvToObjects(text);
  const records = transformRecords(rawRecords);
  const fetchedAt = Date.now();
  return {
    meta: buildMeta(records, fetchedAt),
    records,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  // Serve from cache if fresh
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cache.data,
      meta: { ...cache.data.meta, cachedAt: new Date().toISOString() },
    });
  }

  try {
    const data = await fetchSheet();
    cache = { data, fetchedAt: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (cache) {
      return NextResponse.json(
        {
          ...cache.data,
          meta: {
            ...cache.data.meta,
            cachedAt: new Date().toISOString(),
          },
          warning: `Stale cache served due to fetch error: ${message}`,
        },
        { status: 200, headers: { "X-Stale-Cache": "1" } },
      );
    }
    return NextResponse.json(
      { error: message },
      { status: 502 },
    );
  }
}
