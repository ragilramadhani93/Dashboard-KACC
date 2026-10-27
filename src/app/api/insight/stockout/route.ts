import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import {
  fetchPrevMonthCompare,
  computePrevMonthRange,
} from "@/lib/dashboard/cross-sheet-compare";
import {
  applyFilter,
  type FilterState,
} from "@/lib/dashboard/aggregate";
import { formatRupiah, formatNumber, formatPct } from "@/lib/format";
import type { TransactionRecord } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

interface StockoutRequest {
  activeSourceId: string;
  currentDateRange: { start: string; end: string };
  filters?: Partial<FilterState>;
}

interface DayBreakdown {
  date: string;
  dayOfWeek: string; // "Sen", "Sel", etc.
  qty: number;
  revenue: number;
  prevSameDowAvg: number; // avg qty on same day-of-week in prev period
  isZeroAnomaly: boolean; // qty=0 in current but prevSameDowAvg >= 5
}

interface ItemAnalysis {
  item: string;
  category: string;
  prevQty: number;
  currQty: number;
  deltaPct: number | null;
  prevRevenue: number;
  currRevenue: number;
  revenueLoss: number; // prev - curr (positive = loss)
  prevDaysWithSales: number;
  currDaysWithSales: number;
  currPeriodDays: number;
  prevPeriodDays: number;
  severity: "severe" | "high" | "moderate" | "normal";
  severityReason: string;
  zeroAnomalyDays: string[]; // dates where qty=0 but prev dow avg >= 5
  dailyBreakdown: DayBreakdown[];
}

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function getDayOfWeek(dateStr: string): string {
  const t = Date.parse(dateStr + "T00:00:00Z");
  if (isNaN(t)) return "?";
  return DAY_NAMES[new Date(t).getUTCDay()];
}

/**
 * Aggregate item-level daily sales for a set of records.
 * Returns: Map<item, Map<date, { qty, revenue }>>
 */
function aggregateItemDaily(records: TransactionRecord[]): Map<string, Map<string, { qty: number; revenue: number }>> {
  const map = new Map<string, Map<string, { qty: number; revenue: number }>>();
  for (const r of records) {
    if (r.status !== "Close") continue;
    if (!map.has(r.item)) map.set(r.item, new Map());
    const dayMap = map.get(r.item)!;
    if (!dayMap.has(r.date)) dayMap.set(r.date, { qty: 0, revenue: 0 });
    const e = dayMap.get(r.date)!;
    e.qty += r.qty;
    e.revenue += r.grandTotal;
  }
  return map;
}

/**
 * Compute average qty sold on each day-of-week for an item, from prev period data.
 * Returns: Map<dayOfWeek (0-6), avgQty>
 */
function computeDowAverages(
  itemDaily: Map<string, { qty: number; revenue: number }>,
  dateList: string[],
): Map<number, { avgQty: number; count: number }> {
  const sums = new Map<number, { totalQty: number; days: number }>();
  for (const d of dateList) {
    const t = Date.parse(d + "T00:00:00Z");
    if (isNaN(t)) continue;
    const dow = new Date(t).getUTCDay();
    const e = itemDaily.get(d);
    const qty = e?.qty ?? 0;
    if (!sums.has(dow)) sums.set(dow, { totalQty: 0, days: 0 });
    const s = sums.get(dow)!;
    s.totalQty += qty;
    s.days += 1;
  }
  const result = new Map<number, { avgQty: number; count: number }>();
  for (const [dow, s] of sums) {
    result.set(dow, {
      avgQty: s.days > 0 ? s.totalQty / s.days : 0,
      count: s.days,
    });
  }
  return result;
}

function buildDateList(start: string, end: string): string[] {
  const result: string[] = [];
  if (!start || !end) return result;
  const startT = Date.parse(start + "T00:00:00Z");
  const endT = Date.parse(end + "T00:00:00Z");
  if (isNaN(startT) || isNaN(endT)) return result;
  for (let t = startT; t <= endT; t += 24 * 60 * 60 * 1000) {
    result.push(new Date(t).toISOString().slice(0, 10));
  }
  return result;
}

function classifySeverity(
  prevQty: number,
  currQty: number,
  zeroAnomalyDaysCount: number,
): { severity: ItemAnalysis["severity"]; reason: string } {
  if (prevQty < 20) {
    return { severity: "normal", reason: "Prev qty < 20, terlalu kecil untuk dianalisa" };
  }
  const deltaPct = prevQty > 0 ? ((currQty - prevQty) / prevQty) * 100 : 0;

  // SEVERE: prevQty >= 50, currQty = 0 (definite stock out)
  if (prevQty >= 50 && currQty === 0) {
    return {
      severity: "severe",
      reason: `Penjualan 0 di periode ini padahal bulan lalu terjual ${prevQty} cup - indikasi strong stock-out`,
    };
  }
  // SEVERE: multiple zero-anomaly days
  if (zeroAnomalyDaysCount >= 2 && currQty < prevQty * 0.3) {
    return {
      severity: "severe",
      reason: `${zeroAnomalyDaysCount} hari dengan penjualan 0 padahal hari yang sama bulan lalu laris - indikasi stock-out berhari-hari`,
    };
  }
  // HIGH: drop > 75%
  if (deltaPct < -75) {
    return {
      severity: "high",
      reason: `Penurunan ekstrem ${formatPct(deltaPct)} - kemungkinan stock-out atau menu dihapus`,
    };
  }
  // HIGH: 1 zero-anomaly day with significant drop
  if (zeroAnomalyDaysCount >= 1 && deltaPct < -50) {
    return {
      severity: "high",
      reason: `Penurunan ${formatPct(deltaPct)} dengan ${zeroAnomalyDaysCount} hari penjualan 0 - kemungkinan stock-out parsial`,
    };
  }
  // MODERATE: drop 50-75%
  if (deltaPct < -50) {
    return {
      severity: "moderate",
      reason: `Penurunan signifikan ${formatPct(deltaPct)} - perlu investigasi (stock-out atau tren menurun)`,
    };
  }
  return { severity: "normal", reason: "Penurunan normal / dalam batas wajar" };
}

const SYSTEM_PROMPT = `Anda adalah analis operasional senior untuk jaringan kafe KACC (Kopi Aku Coffe Corner). Tugas Anda menganalisa data penjualan menu untuk mengidentifikasi indikasi stock-out (kehabisan stok) dengan membandingkan periode saat ini vs periode yang sama di bulan lalu. Anda juga menganalisa perubahan metode pembayaran.

Aturan output WAJIB:
1. Bahasa Indonesia.
2. Angka: gunakan format Rupiah (Rp X Jt) dan qty dengan pemisah ribuan.
3. Fokus pada: identifikasi item yang kemungkinan out-of-stock, hari kapan stock-out terjadi, estimasi revenue loss, prioritas restock, DAN analisa perubahan metode pembayaran.
4. Bedakan antara:
   - STOCK-OUT (penjualan 0 di hari tertentu padahal hari yang sama bulan lalu laris) - pastikan ini disebut
   - TREND DECLINE (penjualan turun konsisten, bukan 0) - ini bukan stock-out
   - MENU CHANGED (item tidak lagi dijual - qty 0 di semua hari) - berbeda dari stock-out
5. Sebut nama item dan tanggal spesifik.
6. Untuk analisa payment method: sebutkan metode yang turun/naik signifikan dengan persen dan estimasi rupiah, kemungkinan penyebab.
7. Format JSON WAJIB (jangan tambahkan field lain, jangan pakai markdown fence):
{
  "narrative": "<paragraf 4-6 kalimat meringkas temuan utama - stock-out + payment method>",
  "suspectedStockout": ["<item 1 dengan alasan>", "<item 2 dengan alasan>"],
  "revenueLossEstimate": "<estimasi total revenue loss dari stock-out dalam Rupiah>",
  "restockPriority": [
    {"item": "<nama>", "priority": "KRITIS|TINGGI|SEDANG", "reason": "<alasan>"}
  ],
  "recommendations": ["<rekomendasi 1>", "<rekomendasi 2>", "<rekomendasi 3>"],
  "paymentMethodAnalysis": "<paragraf 3-4 kalimat menganalisa perubahan metode pembayaran - mana yang turun/naik, persen perubahan, estimasi rupiah, kemungkinan penyebab, dan dampak bisnis>"
}

PENTING: 
- Output HANYA JSON valid, tanpa markdown code fence, tanpa teks tambahan sebelum/sesudah JSON.
- JANGAN TRUNCATE output di tengah. Pastikan JSON lengkap dan valid.
- Untuk suspectedStockout: list SEMUA item yang terindikasi stock-out (bisa 10-15 item), jangan dibatasi 5.
- Untuk restockPriority: list TOP 10 item, bukan hanya 5.
- Kalau token mulai menipis, prioritaskan kelengkapan JSON: tutup semua array dan object dengan benar.
- Format alasan singkat: "ITEM - 1 kalimat alasan" supaya efficient tokens.`;

export async function POST(request: Request) {
  let body: StockoutRequest;
  try {
    body = (await request.json()) as StockoutRequest;
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  if (!body.activeSourceId || !body.currentDateRange?.start || !body.currentDateRange?.end) {
    return NextResponse.json(
      { error: "activeSourceId dan currentDateRange wajib" },
      { status: 400 },
    );
  }

  // 1. Compute prev month range
  const prevDateRange = computePrevMonthRange(
    body.currentDateRange.start,
    body.currentDateRange.end,
  );

  // 2. Fetch prev month compare data
  const prevCompare = await fetchPrevMonthCompare(
    body.activeSourceId,
    body.currentDateRange,
  );

  if (!prevCompare.available) {
    return NextResponse.json({
      available: false,
      unavailableReason: prevCompare.unavailableReason,
      prevDateRange,
    });
  }

  // 3. Need to also fetch CURRENT period records. We don't have direct access here,
  // but the API caller should pass them. As fallback, we re-fetch from /api/sheets.
  // For simplicity, accept currentRecords in body OR fetch from active sheet.
  let currentRecords: TransactionRecord[] = [];
  try {
    const sheetsRes = await fetch(
      `http://localhost:3000/api/sheets?_t=${Date.now()}`,
      { cache: "no-store" },
    );
    if (sheetsRes.ok) {
      const sheetsData = await sheetsRes.json();
      currentRecords = sheetsData.records || [];
    }
  } catch {
    // ignore
  }

  // Filter current records to current date range
  const filterState: FilterState = {
    dateStart: body.currentDateRange.start,
    dateEnd: body.currentDateRange.end,
    outlets: body.filters?.outlets ?? [],
    payments: body.filters?.payments ?? [],
    itemCategories: body.filters?.itemCategories ?? [],
    menuTypes: body.filters?.menuTypes ?? [],
  };
  const filteredCurrent = applyFilter(currentRecords, filterState);

  // Filter prev records to prev date range
  const filterStatePrev: FilterState = {
    dateStart: prevDateRange.start,
    dateEnd: prevDateRange.end,
    outlets: body.filters?.outlets ?? [],
    payments: body.filters?.payments ?? [],
    itemCategories: body.filters?.itemCategories ?? [],
    menuTypes: body.filters?.menuTypes ?? [],
  };
  const filteredPrev = applyFilter(prevCompare.prevRecords, filterStatePrev);

  // 4. Build date lists
  const currDateList = buildDateList(body.currentDateRange.start, body.currentDateRange.end);
  const prevDateList = buildDateList(prevDateRange.start, prevDateRange.end);

  // 5. Aggregate item-daily for both periods
  const currItemDaily = aggregateItemDaily(filteredCurrent);
  const prevItemDaily = aggregateItemDaily(filteredPrev);

  // 6. Get all unique items (union)
  const allItems = new Set<string>([...currItemDaily.keys(), ...prevItemDaily.keys()]);

  // 7. Analyze each item
  const analyses: ItemAnalysis[] = [];
  for (const item of allItems) {
    const currDayMap = currItemDaily.get(item) ?? new Map();
    const prevDayMap = prevItemDaily.get(item) ?? new Map();

    let prevQty = 0;
    let currQty = 0;
    let prevRevenue = 0;
    let currRevenue = 0;
    let prevDaysWithSales = 0;
    let currDaysWithSales = 0;

    for (const [, e] of prevDayMap) {
      prevQty += e.qty;
      prevRevenue += e.revenue;
      if (e.qty > 0) prevDaysWithSales += 1;
    }
    for (const [, e] of currDayMap) {
      currQty += e.qty;
      currRevenue += e.revenue;
      if (e.qty > 0) currDaysWithSales += 1;
    }

    // Skip items with no sales in either period (irrelevant)
    if (prevQty === 0 && currQty === 0) continue;
    // Skip items with very low prev sales (noise)
    if (prevQty < 10 && currQty < 10) continue;

    // Compute DoW averages from prev period
    const dowAverages = computeDowAverages(prevDayMap, prevDateList);

    // Build daily breakdown for current period
    const dailyBreakdown: DayBreakdown[] = [];
    const zeroAnomalyDays: string[] = [];
    for (const d of currDateList) {
      const e = currDayMap.get(d);
      const qty = e?.qty ?? 0;
      const revenue = e?.revenue ?? 0;
      const t = Date.parse(d + "T00:00:00Z");
      const dow = isNaN(t) ? 0 : new Date(t).getUTCDay();
      const dowAvg = dowAverages.get(dow)?.avgQty ?? 0;
      const isZeroAnomaly = qty === 0 && dowAvg >= 5;
      if (isZeroAnomaly) zeroAnomalyDays.push(d);
      dailyBreakdown.push({
        date: d,
        dayOfWeek: getDayOfWeek(d),
        qty,
        revenue,
        prevSameDowAvg: dowAvg,
        isZeroAnomaly,
      });
    }

    const { severity, reason } = classifySeverity(
      prevQty,
      currQty,
      zeroAnomalyDays.length,
    );

    // Skip normal items (we only want to flag suspected stock-outs)
    if (severity === "normal") continue;

    const deltaPct = prevQty > 0 ? ((currQty - prevQty) / prevQty) * 100 : null;

    analyses.push({
      item,
      category: filteredCurrent.find((r) => r.item === item)?.itemCategory
        ?? filteredPrev.find((r) => r.item === item)?.itemCategory
        ?? "Other",
      prevQty,
      currQty,
      deltaPct,
      prevRevenue,
      currRevenue,
      revenueLoss: Math.max(0, prevRevenue - currRevenue),
      prevDaysWithSales,
      currDaysWithSales,
      currPeriodDays: currDateList.length,
      prevPeriodDays: prevDateList.length,
      severity,
      severityReason: reason,
      zeroAnomalyDays,
      dailyBreakdown,
    });
  }

  // 8. Sort: severe first, then by revenueLoss desc
  analyses.sort((a, b) => {
    const sevOrder = { severe: 0, high: 1, moderate: 2, normal: 3 };
    if (sevOrder[a.severity] !== sevOrder[b.severity]) {
      return sevOrder[a.severity] - sevOrder[b.severity];
    }
    return b.revenueLoss - a.revenueLoss;
  });

  // Top 20 suspected items (to keep AI prompt manageable)
  const topSuspected = analyses.slice(0, 20);

  if (topSuspected.length === 0) {
    return NextResponse.json({
      available: true,
      noIssues: true,
      message:
        "Tidak ada item dengan indikasi stock-out. Semua menu memiliki penjualan yang konsisten dengan bulan lalu.",
      prevDateRange,
      currentDateRange: body.currentDateRange,
      analyzedItems: allItems.size,
      generatedAt: new Date().toISOString(),
    });
  }

  // 9. Build prompt for AI
  const itemsStr = topSuspected
    .map((a, i) => {
      const zeroDaysStr =
        a.zeroAnomalyDays.length > 0
          ? ` Hari dengan qty=0 (padahal hari yang sama bulan lalu avg ≥5 cup): ${a.zeroAnomalyDays
              .map((d) => `${d} (${getDayOfWeek(d)})`)
              .join(", ")}`
          : "";
      const dailyStr = a.dailyBreakdown
        .filter((d) => d.qty > 0 || d.isZeroAnomaly)
        .map(
          (d) =>
            `${d.date}(${d.dayOfWeek}): ${d.qty} cup [prev same-day avg: ${d.prevSameDowAvg.toFixed(0)}]${d.isZeroAnomaly ? " ⚠️ZERO" : ""}`,
        )
        .join(", ");
      return `${i + 1}. ${a.item} [${a.category}]
   - Periode ini: ${formatNumber(a.currQty)} cup, revenue ${formatRupiah(a.currRevenue)}
   - Bulan lalu: ${formatNumber(a.prevQty)} cup, revenue ${formatRupiah(a.prevRevenue)}
   - Delta: ${a.deltaPct !== null ? formatPct(a.deltaPct) : "n/a"}
   - Curr days with sales: ${a.currDaysWithSales}/${a.currPeriodDays}, Prev: ${a.prevDaysWithSales}/${a.prevPeriodDays}
   - Severity: ${a.severity.toUpperCase()} - ${a.severityReason}
   - Revenue loss estimate: ${formatRupiah(a.revenueLoss)}${zeroDaysStr}
   - Daily: ${dailyStr || "(tidak ada hari signifikan)"}`;
    })
    .join("\n\n");

  const totalRevenueLoss = topSuspected.reduce((s, a) => s + a.revenueLoss, 0);

  // ===== PAYMENT METHOD COMPARISON (curr vs prev) =====
  interface PaymentAgg {
    payment: string;
    prevRevenue: number;
    currRevenue: number;
    prevTransactions: number;
    currTransactions: number;
    revenueDeltaPct: number | null;
    txnDeltaPct: number | null;
    prevShare: number; // % of total prev revenue
    currShare: number; // % of total curr revenue
    revenueChange: number; // curr - prev (negative = loss)
  }

  function aggregatePayment(records: TransactionRecord[]): Map<string, { revenue: number; txns: Set<string> }> {
    const map = new Map<string, { revenue: number; txns: Set<string> }>();
    for (const r of records) {
      if (r.status !== "Close") continue;
      const p = r.payment || "Unknown";
      if (!map.has(p)) map.set(p, { revenue: 0, txns: new Set() });
      const e = map.get(p)!;
      e.revenue += r.grandTotal;
      e.txns.add(r.txn);
    }
    return map;
  }

  const currPayAgg = aggregatePayment(filteredCurrent);
  const prevPayAgg = aggregatePayment(filteredPrev);
  const totalCurrRev = [...currPayAgg.values()].reduce((s, e) => s + e.revenue, 0);
  const totalPrevRev = [...prevPayAgg.values()].reduce((s, e) => s + e.revenue, 0);

  const allPayments = new Set<string>([...currPayAgg.keys(), ...prevPayAgg.keys()]);
  const paymentAnalyses: PaymentAgg[] = [];
  for (const p of allPayments) {
    const c = currPayAgg.get(p);
    const pr = prevPayAgg.get(p);
    const currRevenue = c?.revenue ?? 0;
    const prevRevenue = pr?.revenue ?? 0;
    const currTxns = c?.txns.size ?? 0;
    const prevTxns = pr?.txns.size ?? 0;
    paymentAnalyses.push({
      payment: p,
      prevRevenue,
      currRevenue,
      prevTransactions: prevTxns,
      currTransactions: currTxns,
      revenueDeltaPct: prevRevenue > 0 ? ((currRevenue - prevRevenue) / prevRevenue) * 100 : null,
      txnDeltaPct: prevTxns > 0 ? ((currTxns - prevTxns) / prevTxns) * 100 : null,
      prevShare: totalPrevRev > 0 ? (prevRevenue / totalPrevRev) * 100 : 0,
      currShare: totalCurrRev > 0 ? (currRevenue / totalCurrRev) * 100 : 0,
      revenueChange: currRevenue - prevRevenue,
    });
  }
  // Sort by revenue change ascending (biggest losses first)
  paymentAnalyses.sort((a, b) => a.revenueChange - b.revenueChange);

  const paymentStr = paymentAnalyses
    .map((p) => {
      const revDelta = p.revenueDeltaPct !== null ? formatPct(p.revenueDeltaPct) : "n/a";
      const txnDelta = p.txnDeltaPct !== null ? formatPct(p.txnDeltaPct) : "n/a";
      const sign = p.revenueChange < 0 ? "↓" : p.revenueChange > 0 ? "↑" : "=";
      return `${p.payment}: revenue ${formatRupiah(p.currRevenue)} (${revDelta} vs prev ${formatRupiah(p.prevRevenue)}) | txn ${formatNumber(p.currTransactions)} (${txnDelta}) | share ${formatPct(p.currShare)} (prev ${formatPct(p.prevShare)}) ${sign}`;
    })
    .join("\n");

  const userPrompt = `Analisa data penjualan KACC untuk deteksi stock-out.

PERIODE:
- Current: ${body.currentDateRange.start} → ${body.currentDateRange.end} (${currDateList.length} hari)
- Previous (bulan lalu, tanggal sama): ${prevDateRange.start} → ${prevDateRange.end} (${prevDateList.length} hari)

TOTAL ITEM DIANALISA: ${allItems.size}
ITEM TERINDIKASI STOCK-OUT (top ${topSuspected.length}, sorted by severity):
${itemsStr}

TOTAL ESTIMASI REVENUE LOSS dari item-item di atas: ${formatRupiah(totalRevenueLoss)}

=== PERBANDINGAN METODE PEMBAYARAN (curr vs prev) ===
${paymentStr}

Tolong analisa dan hasilkan:
1. narrative: paragraf 4-6 kalimat meringkas temuan utama - berapa item terindikasi stock-out, total revenue loss, pola yang terlihat, DAN ringkasan perubahan metode pembayaran (mana yang naik/turun signifikan).
2. suspectedStockout: list SEMUA item yang MENURUT ANDA likely out-of-stock (bukan trend decline) - jangan dibatasi 5, sebutkan semua yang relevant. Format: "ITEM - alasan singkat (qty X di Y hari padahal biasanya Z cup/hari)".
3. revenueLossEstimate: estimasi total rupiah hilang dari stock-out (bukan dari trend decline).
4. restockPriority: TOP 10 item yang perlu diprioritaskan restock, dengan priority KRITIS/TINGGI/SEDANG dan reason singkat.
5. recommendations: 3-5 rekomendasi operasional, termasuk terkait metode pembayaran yang turun (mis. "Investigasi penurunan SHOPEEFOOD - cek kerjasama merchant", "Promosi Cash untuk boost share").
6. paymentMethodAnalysis: paragraf 3-4 kalimat menganalisa perubahan metode pembayaran - mana yang turun/naik, kemungkinan penyebab, dan dampaknya ke bisnis.

PENTING: 
- Bedakan STOCK-OUT (qty 0 di hari tertentu padahal biasanya laris) dari TREND DECLINE (penjualan turun tapi masih ada). Hanya masukkan ke suspectedStockout kalau benar-benar indikasi stock-out.
- JANGAN TRUNCATE output. Pastikan semua field terisi lengkap. Kalau perlu, pakai kalimat lebih singkat per item tapi tetap sebutkan SEMUA item.
- Output HARUS JSON valid lengkap, jangan terpotong di tengah.`;

  try {
    const ai = await ZAI.create();
    const completion = await ai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 4000,
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const finishReason = completion.choices?.[0]?.finish_reason;
    const wasTruncated = finishReason === "length";

    // Try multiple JSON extraction strategies since model may truncate or add prose
    let parsed: {
      narrative?: string;
      suspectedStockout?: string[];
      revenueLossEstimate?: string;
      restockPriority?: Array<{ item: string; priority: string; reason: string }>;
      recommendations?: string[];
      paymentMethodAnalysis?: string;
    } = {};

    // Helper: aggressive JSON repair
    function repairJson(s: string): string {
      let repaired = s;
      // Remove markdown code fences if any
      repaired = repaired.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
      // Remove trailing comma before ] or }
      repaired = repaired.replace(/,\s*([\]}])/g, "$1");
      // Close unclosed string literals (if truncated mid-string)
      // Find last complete key-value pair
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/\]/g) || []).length;
      // If there's an unclosed string (odd number of unescaped quotes), close it
      const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        repaired += '"';
      }
      // Close unclosed arrays
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
      // Close unclosed objects
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";
      return repaired;
    }

    // Strategy 1: try to find complete JSON object via regex
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        // Strategy 2: try repaired version
        const repaired = repairJson(jsonMatch[0]);
        try {
          parsed = JSON.parse(repaired);
        } catch {
          // Strategy 3: try to extract partial - find the last complete key
          // and truncate there, then close braces
          const partialRaw = raw.includes("{") ? raw.slice(raw.indexOf("{")) : raw;
          const repairedPartial = repairJson(partialRaw);
          try {
            parsed = JSON.parse(repairedPartial);
          } catch {
            // Strategy 4: fallback - treat whole output as narrative
            parsed = {
              narrative: wasTruncated
                ? raw + "\n\n[Catatan: output AI terpotong karena limit token. Data item tetap tersedia di tabel di bawah.]"
                : raw,
            };
          }
        }
      }
    } else {
      parsed = { narrative: raw };
    }

    return NextResponse.json({
      available: true,
      noIssues: false,
      narrative: parsed.narrative || "Tidak ada narasi yang dihasilkan.",
      suspectedStockout: Array.isArray(parsed.suspectedStockout) ? parsed.suspectedStockout : [],
      revenueLossEstimate: parsed.revenueLossEstimate || formatRupiah(totalRevenueLoss),
      restockPriority: Array.isArray(parsed.restockPriority) ? parsed.restockPriority : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      paymentMethodAnalysis: parsed.paymentMethodAnalysis || "",
      // Also return raw item analyses for UI table
      itemAnalyses: topSuspected.map((a) => ({
        item: a.item,
        category: a.category,
        prevQty: a.prevQty,
        currQty: a.currQty,
        deltaPct: a.deltaPct,
        prevRevenue: a.prevRevenue,
        currRevenue: a.currRevenue,
        revenueLoss: a.revenueLoss,
        severity: a.severity,
        severityReason: a.severityReason,
        zeroAnomalyDays: a.zeroAnomalyDays,
        currDaysWithSales: a.currDaysWithSales,
        currPeriodDays: a.currPeriodDays,
        prevDaysWithSales: a.prevDaysWithSales,
        prevPeriodDays: a.prevPeriodDays,
        dailyBreakdown: a.dailyBreakdown,
      })),
      // Payment method comparison data
      paymentAnalyses,
      meta: {
        currentDateRange: body.currentDateRange,
        prevDateRange,
        totalItemsAnalyzed: allItems.size,
        suspectedItemsCount: topSuspected.length,
        totalRevenueLossRaw: totalRevenueLoss,
        totalCurrRevenue: totalCurrRev,
        totalPrevRevenue: totalPrevRev,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({
      available: true,
      noIssues: false,
      narrative: `Gagal menghasilkan analisa AI: ${message}. Namun data item terindikasi stock-out sudah disiapkan di field itemAnalyses.`,
      suspectedStockout: [],
      revenueLossEstimate: formatRupiah(totalRevenueLoss),
      restockPriority: [],
      recommendations: [],
      paymentMethodAnalysis: "",
      itemAnalyses: topSuspected.map((a) => ({
        item: a.item,
        category: a.category,
        prevQty: a.prevQty,
        currQty: a.currQty,
        deltaPct: a.deltaPct,
        prevRevenue: a.prevRevenue,
        currRevenue: a.currRevenue,
        revenueLoss: a.revenueLoss,
        severity: a.severity,
        severityReason: a.severityReason,
        zeroAnomalyDays: a.zeroAnomalyDays,
        currDaysWithSales: a.currDaysWithSales,
        currPeriodDays: a.currPeriodDays,
        prevDaysWithSales: a.prevDaysWithSales,
        prevPeriodDays: a.prevPeriodDays,
        dailyBreakdown: a.dailyBreakdown,
      })),
      paymentAnalyses,
      meta: {
        currentDateRange: body.currentDateRange,
        prevDateRange,
        totalItemsAnalyzed: allItems.size,
        suspectedItemsCount: topSuspected.length,
        totalRevenueLossRaw: totalRevenueLoss,
        totalCurrRevenue: totalCurrRev,
        totalPrevRevenue: totalPrevRev,
      },
      generatedAt: new Date().toISOString(),
      error: message,
    });
  }
}
