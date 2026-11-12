import {
  cleanOutletName,
  formatNumber,
  formatPct,
  formatRupiahFull,
} from "./format";
import type {
  HourAgg,
  ItemAgg,
  KpiSummary,
  OutletAgg,
  PaymentAgg,
  TrendPoint,
} from "./types";

export interface PdfReportPayload {
  meta?: { lastUpdated?: string; dateRange?: { start?: string; end?: string } };
  filters?: {
    dateRange?: { start?: string; end?: string };
    outlets?: string[];
    payments?: string[];
    itemCategories?: string[];
  };
  kpi?: Partial<KpiSummary>;
  prevKpi?: Partial<KpiSummary> | null;
  dailyTrend?: TrendPoint[];
  topOutlets?: OutletAgg[];
  topItems?: ItemAgg[];
  paymentMix?: PaymentAgg[];
  hourly?: HourAgg[];
  insight?: {
    narrative?: string;
    highlights?: string[];
    alerts?: string[];
  } | null;
}

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 44;
const TOP_Y = 796;
const BOTTOM_Y = 50;

function sanitizeAscii(text: string): string {
  return String(text ?? "")
    .replace(/[→➔]/g, "->")
    .replace(/[•●]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[\r\t]+/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .trim();
}

function pdfEscape(text: string): string {
  return sanitizeAscii(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(text: string, maxChars: number): string[] {
  const clean = sanitizeAscii(text);
  if (!clean) return [];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!current) {
      current = w;
    } else if (current.length + 1 + w.length <= maxChars) {
      current += ` ${w}`;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Build a valid multi-page A4 PDF report buffer without native/Python dependencies.
 * shortcut: uses Helvetica WinAnsi text layout instead of rich chart bitmaps so it runs in any Node.js serverless function.
 */
export function buildPdfReport(payload: PdfReportPayload): Buffer {
  const pages: string[][] = [[]];
  let y = TOP_Y;

  const ensureSpace = (needed: number) => {
    if (y - needed < BOTTOM_Y) {
      pages.push([]);
      y = TOP_Y;
    }
  };

  const drawLine = (text: string, size: number, bold = false, indent = 0) => {
    const leading = Math.round(size * 1.45);
    ensureSpace(leading);
    const font = bold ? "F2" : "F1";
    pages[pages.length - 1].push(
      `BT /${font} ${size} Tf ${MARGIN_X + indent} ${y} Td (${pdfEscape(text)}) Tj ET`,
    );
    y -= leading;
  };

  const drawHeading = (title: string) => {
    y -= 6;
    ensureSpace(24);
    drawLine(title, 12, true);
    pages[pages.length - 1].push(
      `0.8 w ${MARGIN_X} ${y + 4} m ${PAGE_W - MARGIN_X} ${y + 4} l S`,
    );
    y -= 6;
  };

  const drawWrapped = (text: string, size = 9.5, indent = 0, maxChars = 92) => {
    for (const line of wrapText(text, maxChars)) {
      drawLine(line, size, false, indent);
    }
  };

  const start = payload.filters?.dateRange?.start || payload.meta?.dateRange?.start || "-";
  const end = payload.filters?.dateRange?.end || payload.meta?.dateRange?.end || "-";
  drawLine("KACC Dashboard - Laporan Transaksi Outlet", 16, true);
  drawLine(`Periode: ${start} s/d ${end} | Dicetak: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, 9);

  const f = payload.filters;
  const activeFilters = [
    f?.outlets?.length ? `Outlet: ${f.outlets.length} dipilih` : "Outlet: Semua",
    f?.payments?.length ? `Payment: ${f.payments.join(", ")}` : "Payment: Semua",
    f?.itemCategories?.length ? `Kategori: ${f.itemCategories.join(", ")}` : "Kategori: Semua",
  ].join(" | ");
  drawWrapped(activeFilters, 8.5, 0, 100);

  // KPI Summary
  const kpi = payload.kpi ?? {};
  const prev = payload.prevKpi;
  drawHeading("Ringkasan KPI");
  const kpiLines = [
    `Revenue: ${formatRupiahFull(kpi.revenue ?? 0)}${prev?.revenue ? ` (Prev: ${formatRupiahFull(prev.revenue)})` : ""}`,
    `Transaksi: ${formatNumber(kpi.transactions ?? 0)}${prev?.transactions ? ` (Prev: ${formatNumber(prev.transactions)})` : ""}`,
    `Total Item: ${formatNumber(kpi.items ?? 0)} | Outlet Aktif: ${formatNumber(kpi.outlets ?? 0)}`,
    `AOV: ${formatRupiahFull(kpi.aov ?? 0)} | Avg Item/Txn: ${(kpi.avgItemsPerTxn ?? 0).toFixed(2)} | Peak Hour: ${String(kpi.peakHour ?? 0).padStart(2, "0")}:00`,
  ];
  for (const l of kpiLines) drawLine(l, 9.5);

  // AI Insight
  if (payload.insight?.narrative || payload.insight?.highlights?.length || payload.insight?.alerts?.length) {
    drawHeading("Ringkasan Insight");
    if (payload.insight.narrative) drawWrapped(payload.insight.narrative, 9.5);
    for (const h of payload.insight.highlights ?? []) drawWrapped(`- ${h}`, 9, 8, 88);
    for (const a of payload.insight.alerts ?? []) drawWrapped(`! ALERT: ${a}`, 9, 8, 88);
  }

  // Top Outlets
  if (payload.topOutlets?.length) {
    drawHeading(`Top Outlet (${Math.min(payload.topOutlets.length, 10)})`);
    payload.topOutlets.slice(0, 10).forEach((o, i) => {
      drawLine(
        `${i + 1}. ${cleanOutletName(o.outlet)} - ${formatRupiahFull(o.revenue)} (${formatNumber(o.transactions)} txn, AOV ${formatRupiahFull(o.avgPerTxn)})`,
        9,
      );
    });
  }

  // Top Items
  if (payload.topItems?.length) {
    drawHeading(`Top Menu (${Math.min(payload.topItems.length, 10)})`);
    payload.topItems.slice(0, 10).forEach((it, i) => {
      drawLine(
        `${i + 1}. ${it.item} [${it.category}] - ${formatNumber(it.qty)} pcs, ${formatRupiahFull(it.revenue)}`,
        9,
      );
    });
  }

  // Payment Mix
  if (payload.paymentMix?.length) {
    drawHeading("Metode Pembayaran");
    for (const p of payload.paymentMix) {
      drawLine(
        `- ${p.payment}: ${formatRupiahFull(p.revenue)} (${formatPct(p.share)}, ${formatNumber(p.transactions)} txn)`,
        9,
      );
    }
  }

  // Daily Trend
  if (payload.dailyTrend?.length) {
    drawHeading("Tren Harian");
    for (const d of payload.dailyTrend) {
      drawLine(
        `${d.date}: ${formatRupiahFull(d.revenue)} | ${formatNumber(d.transactions)} txn | ${formatNumber(d.items)} item`,
        8.5,
      );
    }
  }

  // Assemble PDF objects with exact byte offsets
  const objects: string[] = [];
  const pageObjNums: number[] = [];
  // Obj 1: Catalog, Obj 2: Pages, Obj 3: Helvetica, Obj 4: Helvetica-Bold
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push(""); // placeholder for Pages (obj 2)
  objects.push("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n");
  objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n");

  for (const cmds of pages) {
    const contentStream = cmds.join("\n");
    const contentLen = Buffer.byteLength(contentStream, "latin1");
    const contentObjNum = objects.length + 1;
    objects.push(
      `${contentObjNum} 0 obj\n<< /Length ${contentLen} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    );
    const pageObjNum = objects.length + 1;
    pageObjNums.push(pageObjNum);
    objects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj\n`,
    );
  }

  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageObjNums.length} >>\nendobj\n`;

  const chunks: string[] = ["%PDF-1.4\n"];
  const offsets: number[] = [0];
  let byteOffset = Buffer.byteLength(chunks[0], "latin1");

  for (const obj of objects) {
    offsets.push(byteOffset);
    chunks.push(obj);
    byteOffset += Buffer.byteLength(obj, "latin1");
  }

  const xrefOffset = byteOffset;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= objects.length; i++) {
    chunks.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  return Buffer.from(chunks.join(""), "latin1");
}
