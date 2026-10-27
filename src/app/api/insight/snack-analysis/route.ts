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

interface SnackAnalysisRequest {
  activeSourceId: string;
  currentDateRange: { start: string; end: string };
  filters?: Partial<FilterState>;
}

interface SnackItemAgg {
  item: string;
  category: string; // "Snack" | "Pastry" | "RTD"
  prevQty: number;
  currQty: number;
  deltaPct: number | null;
  prevRevenue: number;
  currRevenue: number;
  revenueChange: number;
  prevTransactions: number;
  currTransactions: number;
  trend: "growing" | "declining" | "stable" | "new" | "discontinued";
}

const SYSTEM_PROMPT = `Anda adalah analis bisnis senior untuk jaringan kafe KACC (Kopi Aku Coffe Corner). Tugas Anda menganalisa performa penjualan SNACK, PASTRY, dan RTD (Ready-to-Drink packaged) - kategori makanan/minuman selain kopi utama - dengan membandingkan periode saat ini vs periode yang sama di bulan lalu.

Aturan output WAJIB:
1. Bahasa Indonesia.
2. Angka: gunakan format Rupiah (Rp X Jt) dan qty dengan pemisah ribuan.
3. Fokus pada: item snack/pastry/RTD yang best-seller, yang naik/turun signifikan, peluang upsell/cross-sell, dan rekomendasi strategi menu.
4. Bedakan kategori:
   - SNACK: ice cream, wingko, cookies, cream cheese, kue kering (light snack)
   - PASTRY: cake, croissant, pie, roll, puff, cinnamon (bakery items)
   - RTD: ready-to-drink packaged beverages (GD series, ABC, LOVY, dll)
5. Sebut nama item dan angka spesifik.
6. Format JSON WAJIB (jangan tambahkan field lain, jangan pakai markdown fence):
{
  "narrative": "<paragraf 4-6 kalimat meringkas performa snack/pastry/RTD + perubahan vs bulan lalu>",
  "topPerformers": ["<item 1 dengan alasan>", "<item 2 dengan alasan>", "<item 3 dengan alasan>"],
  "decliningItems": ["<item yang turun dengan alasan>", "<item yang turun dengan alasan>"],
  "revenueSummary": "<total revenue snack/pastry/RTD + delta vs bulan lalu dalam Rupiah>",
  "opportunities": ["<peluang 1 - mis. 'Cross-sell ICE CREAM dengan coffee latte untuk boost AOV'>", "<peluang 2>", "<peluang 3>"],
  "recommendations": ["<rekomendasi 1>", "<rekomendasi 2>", "<rekomendasi 3>", "<rekomendasi 4>"]
}

PENTING: 
- Output HANYA JSON valid, tanpa markdown code fence, tanpa teks tambahan sebelum/sesudah JSON.
- JANGAN TRUNCATE output di tengah. Pastikan JSON lengkap dan valid.
- Untuk topPerformers dan decliningItems: list 3-5 item masing-masing, jangan dibatasi 2.
- Untuk opportunities dan recommendations: list 3-5 item masing-masing.
- Kalau token mulai menipis, prioritaskan kelengkapan JSON: tutup semua array dan object dengan benar.
- Format alasan singkat: "ITEM - 1 kalimat alasan" supaya efficient tokens.`;

function aggregateSnackItems(records: TransactionRecord[]): Map<string, {
  qty: number;
  revenue: number;
  txns: Set<string>;
  category: string;
}> {
  const map = new Map<string, { qty: number; revenue: number; txns: Set<string>; category: string }>();
  for (const r of records) {
    if (r.status !== "Close") continue;
    // Hanya kategori makanan + RTD
    if (!["Snack", "Pastry", "RTD"].includes(r.itemCategory)) continue;
    if (!map.has(r.item)) {
      map.set(r.item, { qty: 0, revenue: 0, txns: new Set(), category: r.itemCategory });
    }
    const e = map.get(r.item)!;
    e.qty += r.qty;
    e.revenue += r.grandTotal;
    e.txns.add(r.txn);
  }
  return map;
}

function classifyTrend(
  prevQty: number,
  currQty: number,
  prevRevenue: number,
  currRevenue: number,
): SnackItemAgg["trend"] {
  if (prevQty === 0 && currQty > 0) return "new";
  if (currQty === 0 && prevQty > 0) return "discontinued";
  if (prevQty === 0) return "stable";
  const deltaPct = ((currQty - prevQty) / prevQty) * 100;
  if (deltaPct > 15) return "growing";
  if (deltaPct < -15) return "declining";
  return "stable";
}

// Helper: aggressive JSON repair
function repairJson(s: string): string {
  let repaired = s;
  repaired = repaired.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  repaired = repaired.replace(/,\s*([\]}])/g, "$1");
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;
  const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) repaired += '"';
  for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
  for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";
  return repaired;
}

export async function POST(request: Request) {
  let body: SnackAnalysisRequest;
  try {
    body = (await request.json()) as SnackAnalysisRequest;
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  if (!body.activeSourceId || !body.currentDateRange?.start || !body.currentDateRange?.end) {
    return NextResponse.json(
      { error: "activeSourceId dan currentDateRange wajib" },
      { status: 400 },
    );
  }

  const prevDateRange = computePrevMonthRange(
    body.currentDateRange.start,
    body.currentDateRange.end,
  );

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

  // Fetch current period records
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

  const filterState: FilterState = {
    dateStart: body.currentDateRange.start,
    dateEnd: body.currentDateRange.end,
    outlets: body.filters?.outlets ?? [],
    payments: body.filters?.payments ?? [],
    itemCategories: body.filters?.itemCategories ?? [],
    menuTypes: body.filters?.menuTypes ?? [],
  };
  const filteredCurrent = applyFilter(currentRecords, filterState);

  const filterStatePrev: FilterState = {
    dateStart: prevDateRange.start,
    dateEnd: prevDateRange.end,
    outlets: body.filters?.outlets ?? [],
    payments: body.filters?.payments ?? [],
    itemCategories: body.filters?.itemCategories ?? [],
    menuTypes: body.filters?.menuTypes ?? [],
  };
  const filteredPrev = applyFilter(prevCompare.prevRecords, filterStatePrev);

  // Aggregate snack items for both periods
  const currAgg = aggregateSnackItems(filteredCurrent);
  const prevAgg = aggregateSnackItems(filteredPrev);

  // Union of all snack items
  const allSnackItems = new Set<string>([...currAgg.keys(), ...prevAgg.keys()]);

  const itemAnalyses: SnackItemAgg[] = [];
  for (const item of allSnackItems) {
    const c = currAgg.get(item);
    const p = prevAgg.get(item);
    const currQty = c?.qty ?? 0;
    const prevQty = p?.qty ?? 0;
    const currRevenue = c?.revenue ?? 0;
    const prevRevenue = p?.revenue ?? 0;
    const currTxns = c?.txns.size ?? 0;
    const prevTxns = p?.txns.size ?? 0;
    const category = c?.category ?? p?.category ?? "Snack";

    itemAnalyses.push({
      item,
      category,
      prevQty,
      currQty,
      deltaPct: prevQty > 0 ? ((currQty - prevQty) / prevQty) * 100 : null,
      prevRevenue,
      currRevenue,
      revenueChange: currRevenue - prevRevenue,
      prevTransactions: prevTxns,
      currTransactions: currTxns,
      trend: classifyTrend(prevQty, currQty, prevRevenue, currRevenue),
    });
  }

  // Sort by current revenue desc
  itemAnalyses.sort((a, b) => b.currRevenue - a.currRevenue);

  // Compute category totals
  const categoryTotals: Record<string, { currRev: number; prevRev: number; currQty: number; prevQty: number }> = {};
  for (const a of itemAnalyses) {
    if (!categoryTotals[a.category]) {
      categoryTotals[a.category] = { currRev: 0, prevRev: 0, currQty: 0, prevQty: 0 };
    }
    categoryTotals[a.category].currRev += a.currRevenue;
    categoryTotals[a.category].prevRev += a.prevRevenue;
    categoryTotals[a.category].currQty += a.currQty;
    categoryTotals[a.category].prevQty += a.prevQty;
  }

  const totalCurrRevenue = itemAnalyses.reduce((s, a) => s + a.currRevenue, 0);
  const totalPrevRevenue = itemAnalyses.reduce((s, a) => s + a.prevRevenue, 0);
  const totalCurrQty = itemAnalyses.reduce((s, a) => s + a.currQty, 0);
  const totalPrevQty = itemAnalyses.reduce((s, a) => s + a.prevQty, 0);
  const totalDeltaPct = totalPrevRevenue > 0 ? ((totalCurrRevenue - totalPrevRevenue) / totalPrevRevenue) * 100 : null;

  if (itemAnalyses.length === 0) {
    return NextResponse.json({
      available: true,
      noIssues: true,
      message: "Tidak ada item snack/pastry/RTD di periode ini.",
      prevDateRange,
      currentDateRange: body.currentDateRange,
      generatedAt: new Date().toISOString(),
    });
  }

  // Build prompt for AI - top 15 items to keep manageable
  const topItems = itemAnalyses.slice(0, 15);
  const itemsStr = topItems
    .map((a, i) => {
      const deltaStr = a.deltaPct !== null ? formatPct(a.deltaPct) : "n/a";
      const trendIcon =
        a.trend === "growing" ? "↑" :
        a.trend === "declining" ? "↓" :
        a.trend === "new" ? "★ NEW" :
        a.trend === "discontinued" ? "✗ DISCONTINUED" : "=";
      return `${i + 1}. ${a.item} [${a.category}]
   - Curr: ${formatNumber(a.currQty)} cup, revenue ${formatRupiah(a.currRevenue)}, ${formatNumber(a.currTransactions)} txn
   - Prev: ${formatNumber(a.prevQty)} cup, revenue ${formatRupiah(a.prevRevenue)}
   - Delta: ${deltaStr} ${trendIcon}`;
    })
    .join("\n\n");

  const categoryStr = Object.entries(categoryTotals)
    .map(([cat, t]) => {
      const deltaPct = t.prevRev > 0 ? ((t.currRev - t.prevRev) / t.prevRev) * 100 : null;
      const deltaStr = deltaPct !== null ? formatPct(deltaPct) : "n/a";
      return `${cat}: curr ${formatRupiah(t.currRev)} (${formatNumber(t.currQty)} cup) vs prev ${formatRupiah(t.prevRev)} (${formatNumber(t.prevQty)} cup) - delta ${deltaStr}`;
    })
    .join("\n");

  const userPrompt = `Analisa penjualan SNACK, PASTRY, dan RTD KACC.

PERIODE:
- Current: ${body.currentDateRange.start} → ${body.currentDateRange.end}
- Previous (bulan lalu, tanggal sama): ${prevDateRange.start} → ${prevDateRange.end}

TOTAL SNACK/PASTRY/RTD:
- Revenue periode ini: ${formatRupiah(totalCurrRevenue)} (${formatNumber(totalCurrQty)} cup)
- Revenue bulan lalu: ${formatRupiah(totalPrevRevenue)} (${formatNumber(totalPrevQty)} cup)
- Delta revenue: ${totalDeltaPct !== null ? formatPct(totalDeltaPct) : "n/a"}

=== RINGKASAN PER KATEGORI ===
${categoryStr}

=== DETAIL ITEM (top ${topItems.length}) ===
${itemsStr}

Tolong analisa dan hasilkan:
1. narrative: paragraf 4-6 kalimat meringkas performa snack/pastry/RTD - total revenue, perubahan vs bulan lalu, item yang standout, tren per kategori.
2. topPerformers: list 3-5 item best-seller atau yang paling naik, dengan alasan (mis. "ICE CREAM - 327 cup terjual, naik X% karena cross-sell dengan coffee").
3. decliningItems: list 3-5 item yang turun signifikan, dengan alasan dan estimasi loss.
4. revenueSummary: ringkasan total revenue + delta dalam Rupiah.
5. opportunities: list 3-5 peluang bisnis (mis. "Cross-sell ICE CREAM dengan coffee latte", "Promo bundle PASTRY + Coffee untuk boost AOV", "Tambah varian rasa ICE CREAM karena best-seller").
6. recommendations: list 3-5 rekomendasi operasional (mis. "Restok ICE CREAM 2x lipat karena permintaan tinggi", "Evaluasi pastry yang turun - cek kualitas atau ganti supplier", "Promosi RTD untuk take-away customer").

PENTING: 
- JANGAN TRUNCATE output. Pastikan JSON lengkap.
- Format alasan singkat: "ITEM - 1 kalimat alasan" supaya efficient tokens.`;

  try {
    const ai = await ZAI.create();
    const completion = await ai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 3000,
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";

    let parsed: {
      narrative?: string;
      topPerformers?: string[];
      decliningItems?: string[];
      revenueSummary?: string;
      opportunities?: string[];
      recommendations?: string[];
    } = {};

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        const repaired = repairJson(jsonMatch[0]);
        try {
          parsed = JSON.parse(repaired);
        } catch {
          const partialRaw = raw.includes("{") ? raw.slice(raw.indexOf("{")) : raw;
          try {
            parsed = JSON.parse(repairJson(partialRaw));
          } catch {
            parsed = { narrative: raw };
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
      topPerformers: Array.isArray(parsed.topPerformers) ? parsed.topPerformers : [],
      decliningItems: Array.isArray(parsed.decliningItems) ? parsed.decliningItems : [],
      revenueSummary: parsed.revenueSummary || `Total Rp ${formatRupiah(totalCurrRevenue)} (${totalDeltaPct !== null ? formatPct(totalDeltaPct) : "n/a"} vs prev)`,
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      itemAnalyses,
      categoryTotals: Object.fromEntries(
        Object.entries(categoryTotals).map(([k, v]) => [k, {
          currRevenue: v.currRev,
          prevRevenue: v.prevRev,
          currQty: v.currQty,
          prevQty: v.prevQty,
          deltaPct: v.prevRev > 0 ? ((v.currRev - v.prevRev) / v.prevRev) * 100 : null,
        }]),
      ),
      meta: {
        currentDateRange: body.currentDateRange,
        prevDateRange,
        totalItems: itemAnalyses.length,
        totalCurrRevenue,
        totalPrevRevenue,
        totalCurrQty,
        totalPrevQty,
        totalDeltaPct,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({
      available: true,
      noIssues: false,
      narrative: `Gagal menghasilkan analisa AI: ${message}. Namun data item sudah disiapkan di field itemAnalyses.`,
      topPerformers: [],
      decliningItems: [],
      revenueSummary: formatRupiah(totalCurrRevenue),
      opportunities: [],
      recommendations: [],
      itemAnalyses,
      categoryTotals: Object.fromEntries(
        Object.entries(categoryTotals).map(([k, v]) => [k, {
          currRevenue: v.currRev,
          prevRevenue: v.prevRev,
          currQty: v.currQty,
          prevQty: v.prevQty,
          deltaPct: v.prevRev > 0 ? ((v.currRev - v.prevRev) / v.prevRev) * 100 : null,
        }]),
      ),
      meta: {
        currentDateRange: body.currentDateRange,
        prevDateRange,
        totalItems: itemAnalyses.length,
        totalCurrRevenue,
        totalPrevRevenue,
        totalCurrQty,
        totalPrevQty,
        totalDeltaPct,
      },
      generatedAt: new Date().toISOString(),
      error: message,
    });
  }
}
