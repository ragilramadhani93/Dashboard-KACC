import { NextResponse } from "next/server";
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
  getActiveSheetSource,
  updateSheetSourceMetadata,
} from "@/lib/sheet-sources";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// In-memory cache per sheet source ID, with TTL (5 min).
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  data: DashboardData;
  fetchedAt: number;
  sheetSourceId: string;
}

const cache: Map<string, CacheEntry> = new Map();

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

function buildMeta(
  records: TransactionRecord[],
  fetchedAt: number,
  sheetSourceId: string | null,
  sourceUrl: string,
): DashboardData["meta"] {
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
    source: sourceUrl,
    cachedAt: new Date(fetchedAt).toISOString(),
    sheetSourceId,
  };
}

async function fetchSheetData(
  sheetId: string,
  gid: string,
): Promise<{ text: string; url: string }> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "KACC-Dashboard/1.0" },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Google Sheets fetch gagal: HTTP ${res.status}. Pastikan URL benar dan sheet ada.`);
  }
  const text = await res.text();

  // Detect Google login page (private sheet) - response is HTML, not CSV
  if (text.startsWith("<") || text.toLowerCase().includes("<!doctype html")) {
    throw new Error(
      "Sheet ini PRIVATE / tidak public. Set sharing ke 'Anyone with link can view' di Google Sheets (tombol Share kanan atas).",
    );
  }

  // Detect empty sheet (no rows at all, only headers)
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new Error("Sheet kosong (tidak ada baris data). Pastikan sheet sudah diisi data transaksi.");
  }
  if (lines.length < 2) {
    throw new Error("Sheet hanya berisi header, tidak ada data. Pastikan sheet sudah diisi data transaksi.");
  }

  // Check that headers look right
  const firstLine = lines[0].toLowerCase();
  const requiredHeaders = ["transaction number", "opened date", "outlet name", "item name", "grand total final"];
  const missing = requiredHeaders.filter((h) => !firstLine.includes(h));
  if (missing.length > 0) {
    throw new Error(
      `Header kolom tidak cocok. Kolom wajib yang hilang: ${missing.join(", ")}. Pastikan struktur sheet sama dengan sheet Oktober (header: Transaction Number, Opened Date, Outlet Name, Item Name, Grand Total Final, dll).`,
    );
  }

  return { text, url };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  // Ensure DB seeded
  await ensureSeedSheet();

  const active = await getActiveSheetSource();

  if (!active) {
    return NextResponse.json(
      {
        error: "Tidak ada sheet source yang aktif. Tambahkan sheet via /api/sheet-sources.",
      },
      { status: 503 },
    );
  }

  const cacheKey = active.id;

  // Serve from cache if fresh
  if (!forceRefresh) {
    const entry = cache.get(cacheKey);
    if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        ...entry.data,
        meta: { ...entry.data.meta, cachedAt: new Date().toISOString() },
      });
    }
  }

  try {
    const { text, url: sourceUrl } = await fetchSheetData(active.sheetId, active.gid);
    const { records: rawRecords } = parseCsvToObjects(text);
    const records = transformRecords(rawRecords);
    const fetchedAt = Date.now();

    const data: DashboardData = {
      meta: buildMeta(records, fetchedAt, active.id, sourceUrl),
      records,
    };

    cache.set(cacheKey, { data, fetchedAt, sheetSourceId: active.id });

    // Update DB metadata (date range, row count, last fetched) - non-blocking
    updateSheetSourceMetadata(active.id, {
      dataStart: data.meta.dateRange.start,
      dataEnd: data.meta.dateRange.end,
      rowCount: records.length,
      lastFetchedAt: new Date(fetchedAt),
    }).catch((e) => {
      console.error("[sheets] Failed to update metadata:", e);
    });

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Serve stale cache if available
    const entry = cache.get(cacheKey);
    if (entry) {
      return NextResponse.json(
        {
          ...entry.data,
          meta: { ...entry.data.meta, cachedAt: new Date().toISOString() },
          warning: `Stale cache served due to fetch error: ${message}`,
        },
        { status: 200, headers: { "X-Stale-Cache": "1" } },
      );
    }
    return NextResponse.json(
      {
        error: message,
        sheetSourceId: active.id,
        sheetLabel: active.label,
      },
      { status: 502 },
    );
  }
}

/**
 * Export the cache-clearing function so admin actions can reset cache
 * after switching/deleting sheets.
 */
export function clearSheetCache(sheetSourceId?: string): void {
  if (sheetSourceId) {
    cache.delete(sheetSourceId);
  } else {
    cache.clear();
  }
}
