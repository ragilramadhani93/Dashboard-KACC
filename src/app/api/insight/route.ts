import { NextResponse } from "next/server";
import { generateGeminiJson } from "@/lib/gemini";
import type { InsightRequest, InsightResponse } from "@/lib/types";
import { formatRupiah, formatNumber, formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Anda adalah analis data senior untuk jaringan kafe KACC (Kopi Aku Coffe Corner) di Indonesia. Tugas Anda menghasilkan insight bisnis dalam Bahasa Indonesia yang konkret, action-oriented, dan berbasis data dari ringkasan transaksi harian.

Aturan output WAJIB:
1. Semua narasi dan highlight dalam Bahasa Indonesia.
2. Angka disajikan dalam format Rupiah (contoh "Rp 23,5 juta") dan angka transaksi dengan pemisah ribuan.
3. Hindari penuh istilah marketing fluff. Fokus pada: tren, kontribusi, anomali, rekomendasi operasional.
4. Sebut nama outlet dan menu apa adanya (tanpa terjemahan).
5. Jika ada penurunan > 5% dibanding periode sebelumnya, sebutkan sebagai alert.
6. Jika ada outlet dengan revenue < 50% rata-rata, sebutkan sebagai alert.
7. Format JSON WAJIB:
{
  "narrative": "<paragraf 3-5 kalimat>",
  "highlights": ["<poin 1>", "<poin 2>", "<poin 3>", "<poin 4>"],
  "alerts": ["<alert 1>", "<alert 2>"]  // kosongkan jika tidak ada
}

JANGAN sertakan markdown code fence. Hanya JSON valid.`;

export async function POST(request: Request) {
  let body: InsightRequest;
  try {
    body = (await request.json()) as InsightRequest;
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON" },
      { status: 400 },
    );
  }

  const { kpi, prevKpi, topOutlets, topItems, paymentMix, dailyTrend, peakHour, filters } = body;

  // Build a data-rich user prompt
  const dateStart = filters.dateRange.start;
  const dateEnd = filters.dateRange.end;

  const revDelta = prevKpi
    ? ((kpi.revenue - prevKpi.revenue) / Math.max(prevKpi.revenue, 1)) * 100
    : null;
  const txnDelta = prevKpi
    ? ((kpi.transactions - prevKpi.transactions) / Math.max(prevKpi.transactions, 1)) * 100
    : null;
  const aovDelta = prevKpi
    ? ((kpi.aov - prevKpi.aov) / Math.max(prevKpi.aov, 1)) * 100
    : null;

  const topOutletsStr = topOutlets
    .slice(0, 5)
    .map(
      (o, i) =>
        `${i + 1}. ${o.outlet}: ${formatRupiah(o.revenue)} dari ${formatNumber(o.transactions)} transaksi (AOV ${formatRupiah(o.avgPerTxn)})`,
    )
    .join("\n");

  const topItemsStr = topItems
    .slice(0, 5)
    .map(
      (it, i) =>
        `${i + 1}. ${it.item} [${it.category}]: ${formatNumber(it.qty)} cup, revenue ${formatRupiah(it.revenue)}`,
    )
    .join("\n");

  const paymentStr = paymentMix
    .map(
      (p) =>
        `${p.payment}: ${formatRupiah(p.revenue)} (${formatPct(p.share)}) dari ${formatNumber(p.transactions)} transaksi`,
    )
    .join("\n");

  const trendStr = dailyTrend
    .map(
      (t) =>
        `${t.date}: ${formatRupiah(t.revenue)} / ${formatNumber(t.transactions)} txn / ${formatNumber(t.items)} items`,
    )
    .join("\n");

  const filterDesc = [
    `Periode: ${dateStart} s/d ${dateEnd}`,
    filters.outlets.length > 0
      ? `Outlet filter: ${filters.outlets.length} outlet`
      : "Outlet: semua",
    filters.payments.length > 0
      ? `Payment filter: ${filters.payments.join(", ")}`
      : "Payment: semua",
    filters.itemCategories.length > 0
      ? `Kategori menu: ${filters.itemCategories.join(", ")}`
      : "Kategori menu: semua",
  ].join(" | ");

  const userPrompt = `Berikut ringkasan transaksi KACC untuk dashboard monitoring harian.

${filterDesc}

=== KPI UTAMA (periode ini) ===
- Total Revenue: ${formatRupiah(kpi.revenue)}
- Total Transaksi: ${formatNumber(kpi.transactions)}
- Total Item terjual: ${formatNumber(kpi.items)}
- AOV (Average Order Value): ${formatRupiah(kpi.aov)}
- Rata-rata item per transaksi: ${(kpi.avgItemsPerTxn || 0).toFixed(2)}
- Jumlah outlet aktif: ${kpi.outlets}
- Jam puncak: ${String(peakHour).padStart(2, "0")}:00

=== PERIODE SEBELUMNYA (untuk komparasi) ===
${
  prevKpi
    ? `- Revenue: ${formatRupiah(prevKpi.revenue)} (delta ${revDelta !== null ? formatPct(revDelta) : "n/a"})
- Transaksi: ${formatNumber(prevKpi.transactions)} (delta ${txnDelta !== null ? formatPct(txnDelta) : "n/a"})
- AOV: ${formatRupiah(prevKpi.aov)} (delta ${aovDelta !== null ? formatPct(aovDelta) : "n/a"})`
    : "Tidak ada data periode sebelumnya (ini adalah periode pertama dalam filter)."
}

=== TREN HARIAN ===
${trendStr || "Tidak ada data harian."}

=== TOP OUTLET ===
${topOutletsStr || "Tidak ada data outlet."}

=== TOP ITEM ===
${topItemsStr || "Tidak ada data item."}

=== PAYMENT MIX ===
${paymentStr || "Tidak ada data payment."}

Tolong hasilkan:
1. Narrative: paragraf 3-5 kalimat meringkap performa periode ini vs periode sebelumnya, menyebut top contributor dan anomali.
2. Highlights: 4 poin bullet penting (revenue, transaksi, top outlet, top item, payment trend, peak hour).
3. Alerts: list outlet/insight yang perlu perhatian operasional (penurunan signifikan, outlet underperformer, dll). Kosongkan jika aman.

Kembalikan HANYA JSON valid sesuai format yang ditentukan.`;

  try {
    const { parsed } = await generateGeminiJson<Partial<Omit<InsightResponse, "generatedAt">>>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.4,
      maxOutputTokens: 2048,
    });

    const response: InsightResponse = {
      narrative: parsed.narrative || "Tidak ada narasi yang dihasilkan.",
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        narrative: `Gagal menghasilkan insight otomatis: ${message}. Silakan lihat KPI dan chart manual.`,
        highlights: [],
        alerts: [],
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
