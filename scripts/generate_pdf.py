#!/usr/bin/env python3
"""Generate a clean PDF report from KACC dashboard aggregated data.

Usage:
    python generate_pdf.py <input_json> <output_pdf>

Input JSON schema (see PDFInput type in src/app/api/export-pdf/route.ts):
    - meta: { dateRange, lastUpdated, source }
    - filters: { dateRange, outlets, payments, itemCategories }
    - kpi: { revenue, transactions, items, outlets, aov, avgItemsPerTxn, peakHour, uniqueItemTypes }
    - prevKpi: KpiSummary | null
    - dailyTrend: [{ date, revenue, transactions, items }]
    - topOutlets: [{ outlet, revenue, transactions, items, avgPerTxn }] (top 10)
    - topItems: [{ item, category, qty, revenue, transactions }] (top 10)
    - paymentMix: [{ payment, revenue, transactions, share }]
    - hourly: [{ hour, revenue, transactions }]
    - insight: { narrative, highlights, alerts }
"""

import json
import sys
from pathlib import Path
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# ---------- Fonts: register DejaVu Sans for Latin + full glyph coverage ----------
FONT_PATHS = [
    ("NotoSerif", "/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf"),
    ("NotoSerifBold", "/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf"),
    ("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ("DejaVuBold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
]

_registered = False
def register_fonts():
    global _registered
    if _registered:
        return
    for name, path in FONT_PATHS:
        if Path(path).exists():
            try:
                pdfmetrics.registerFont(TTFont(name, path))
            except Exception:
                pass
    _registered = True


def fmt_rp(n, compact=True):
    n = float(n or 0)
    if compact:
        if abs(n) >= 1_000_000_000:
            return f"Rp {n/1_000_000_000:.2f} M".replace(".", ",")
        if abs(n) >= 1_000_000:
            return f"Rp {n/1_000_000:.1f} Jt".replace(".", ",")
        if abs(n) >= 1_000:
            return f"Rp {n/1_000:.0f} rb"
        return f"Rp {n:.0f}"
    return f"Rp {int(round(n)):,}".replace(",", ".")


def fmt_num(n):
    return f"{int(round(n or 0)):,}".replace(",", ".")


def fmt_pct(n, digits=1):
    return f"{(n or 0):.{digits}f}%".replace(".", ",")


def fmt_delta(curr, prev):
    if prev is None or prev == 0:
        return "-"
    delta = ((curr - prev) / prev) * 100
    sign = "+" if delta >= 0 else ""
    return f"{sign}{delta:.1f}%".replace(".", ",")


def fmt_date(iso):
    if not iso:
        return "-"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%d %b %Y, %H:%M WIB")
    except Exception:
        return iso


# ---------- Colors ----------
DARK_BG = colors.HexColor("#0B1220")
CARD_BG = colors.HexColor("#141E2E")
EMERALD = colors.HexColor("#10B981")
CYAN = colors.HexColor("#06B6D4")
AMBER = colors.HexColor("#F59E0B")
RED = colors.HexColor("#EF4444")
MUTED = colors.HexColor("#9CA3AF")
LIGHT = colors.HexColor("#F3F4F6")
WHITE = colors.white


# ---------- Build PDF ----------
def build_pdf(input_path: str, output_path: str):
    register_fonts()

    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Pick a font family - prefer DejaVu for full glyph coverage
    registered = pdfmetrics.getRegisteredFontNames()
    body_font = "DejaVu" if "DejaVu" in registered else "Helvetica"
    bold_font = "DejaVuBold" if "DejaVuBold" in registered else "Helvetica-Bold"

    styles = getSampleStyleSheet()
    style_h1 = ParagraphStyle("H1", parent=styles["Title"], fontName=bold_font,
                              fontSize=22, textColor=WHITE, alignment=TA_LEFT,
                              spaceAfter=4, leading=26)
    style_sub = ParagraphStyle("Sub", parent=styles["Normal"], fontName=body_font,
                               fontSize=9, textColor=MUTED, alignment=TA_LEFT,
                               spaceAfter=12, leading=12)
    style_h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName=bold_font,
                               fontSize=12, textColor=CYAN, alignment=TA_LEFT,
                               spaceBefore=10, spaceAfter=6, leading=14)
    style_body = ParagraphStyle("Body", parent=styles["Normal"], fontName=body_font,
                                fontSize=9, textColor=LIGHT, alignment=TA_LEFT,
                                spaceAfter=4, leading=12)
    style_kpi_label = ParagraphStyle("KpiLabel", parent=styles["Normal"], fontName=body_font,
                                      fontSize=7.5, textColor=MUTED, alignment=TA_LEFT,
                                      leading=9)
    style_kpi_value = ParagraphStyle("KpiValue", parent=styles["Normal"], fontName=bold_font,
                                      fontSize=13, textColor=WHITE, alignment=TA_LEFT,
                                      leading=15)
    style_kpi_delta = ParagraphStyle("KpiDelta", parent=styles["Normal"], fontName=body_font,
                                     fontSize=7.5, textColor=EMERALD, alignment=TA_LEFT,
                                     leading=9)
    style_alert = ParagraphStyle("Alert", parent=styles["Normal"], fontName=body_font,
                                  fontSize=8.5, textColor=AMBER, alignment=TA_LEFT,
                                  leading=11, leftIndent=8)
    style_foot = ParagraphStyle("Foot", parent=styles["Normal"], fontName=body_font,
                                fontSize=7, textColor=MUTED, alignment=TA_CENTER,
                                leading=9)

    meta = data.get("meta", {})
    filters = data.get("filters", {})
    kpi = data.get("kpi", {})
    prev_kpi = data.get("prevKpi")
    daily = data.get("dailyTrend", [])
    top_outlets = data.get("topOutlets", [])[:10]
    top_items = data.get("topItems", [])[:10]
    payments = data.get("paymentMix", [])
    hourly = data.get("hourly", [])
    insight = data.get("insight", {"narrative": "", "highlights": [], "alerts": []})

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title="Laporan Dashboard KACC",
        author="KACC Dashboard",
    )

    story = []

    # ---------- COVER-LIKE HEADER ----------
    story.append(Paragraph("Laporan Dashboard Transaksi KACC", style_h1))
    period = f"{filters.get('dateRange', {}).get('start', '-')} s/d {filters.get('dateRange', {}).get('end', '-')}"
    story.append(Paragraph(
        f"Periode laporan: {period} &nbsp;|&nbsp; Sumber: Google Sheets &nbsp;|&nbsp; "
        f"Generated: {fmt_date(datetime.utcnow().isoformat())}",
        style_sub,
    ))

    # ---------- KPI BLOCK (3 columns x 2 rows) ----------
    def kpi_cell(label, value, delta=None):
        delta_str = ""
        delta_color = EMERALD
        if delta is not None:
            delta_str = f"{'+'.join([d for d in [delta] if d.startswith('-') or d.startswith('+')]) or delta}"
            if delta.startswith("-"):
                delta_color = RED
        cells = [
            [Paragraph(label, style_kpi_label)],
            [Paragraph(value, style_kpi_value)],
        ]
        if delta is not None:
            cells.append([Paragraph(f"vs periode sebelumnya: {delta}", ParagraphStyle(
                "KpiDeltaD", parent=style_kpi_delta, textColor=delta_color,
            ))])
        t = Table(cells, colWidths=[55 * mm], rowHeights=[5*mm, 9*mm] + ([5*mm] if delta is not None else []))
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), CARD_BG),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#1F2937")),
            ("LINEAFTER", (0, 0), (-1, -1), 0.3, colors.HexColor("#1F2937")),
        ]))
        return t

    kpi_table = Table(
        [
            [
                kpi_cell("TOTAL REVENUE", fmt_rp(kpi.get("revenue", 0)),
                        fmt_delta(kpi.get("revenue"), prev_kpi.get("revenue") if prev_kpi else None) if prev_kpi else None),
                kpi_cell("TOTAL TRANSAKSI", fmt_num(kpi.get("transactions", 0)),
                        fmt_delta(kpi.get("transactions"), prev_kpi.get("transactions") if prev_kpi else None) if prev_kpi else None),
                kpi_cell("AOV", fmt_rp(kpi.get("aov", 0)),
                        fmt_delta(kpi.get("aov"), prev_kpi.get("aov") if prev_kpi else None) if prev_kpi else None),
            ],
            [
                kpi_cell("ITEM TERJUAL", fmt_num(kpi.get("items", 0)),
                        fmt_delta(kpi.get("items"), prev_kpi.get("items") if prev_kpi else None) if prev_kpi else None),
                kpi_cell("OUTLET AKTIF", fmt_num(kpi.get("outlets", 0)), None),
                kpi_cell("JAM PUNCAK", f"{(kpi.get('peakHour') or 0):02d}:00", None),
            ],
        ],
        colWidths=[55 * mm, 55 * mm, 55 * mm],
        rowHeights=[20 * mm, 20 * mm],
    )
    kpi_table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 6 * mm))

    # ---------- AI INSIGHT ----------
    if insight.get("narrative"):
        story.append(Paragraph("Insight Otomatis (AI)", style_h2))
        story.append(Paragraph(insight["narrative"], style_body))
        if insight.get("highlights"):
            story.append(Paragraph("Poin Penting:", ParagraphStyle(
                "IH", parent=style_body, fontName=bold_font, textColor=CYAN,
                spaceBefore=4, spaceAfter=2,
            )))
            for h in insight["highlights"]:
                story.append(Paragraph(f"&bull; {h}", ParagraphStyle(
                    "IHItem", parent=style_body, leftIndent=8, spaceAfter=2,
                )))
        if insight.get("alerts"):
            story.append(Paragraph("Alert Operasional:", ParagraphStyle(
                "IA", parent=style_body, fontName=bold_font, textColor=AMBER,
                spaceBefore=4, spaceAfter=2,
            )))
            for a in insight["alerts"]:
                story.append(Paragraph(f"! {a}", style_alert))
        story.append(Spacer(1, 6 * mm))

    # ---------- DAILY TREND TABLE ----------
    if daily:
        story.append(Paragraph("Tren Harian", style_h2))
        header = ["Tanggal", "Revenue", "Transaksi", "Item", "AOV"]
        rows = [header]
        for d in daily:
            aov = d["revenue"] / d["transactions"] if d.get("transactions") else 0
            rows.append([
                d.get("date", "-"),
                fmt_rp(d.get("revenue", 0), compact=False),
                fmt_num(d.get("transactions", 0)),
                fmt_num(d.get("items", 0)),
                fmt_rp(aov),
            ])
        # Total row
        total_rev = sum(r.get("revenue", 0) for r in daily)
        total_txn = sum(r.get("transactions", 0) for r in daily)
        total_items = sum(r.get("items", 0) for r in daily)
        rows.append([
            "TOTAL",
            fmt_rp(total_rev, compact=False),
            fmt_num(total_txn),
            fmt_num(total_items),
            fmt_rp(total_rev / total_txn if total_txn else 0),
        ])
        t = Table(rows, colWidths=[28 * mm, 38 * mm, 28 * mm, 28 * mm, 28 * mm], repeatRows=1)
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), bold_font),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("FONTNAME", (0, 1), (-1, -2), body_font),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("TEXTCOLOR", (0, 0), (-1, 0), CYAN),
            ("TEXTCOLOR", (0, 1), (-1, -1), LIGHT),
            ("TEXTCOLOR", (0, -1), (-1, -1), EMERALD),
            ("FONTNAME", (0, -1), (-1, -1), bold_font),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1A2433")),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#16292B")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [CARD_BG, colors.HexColor("#0F1825")]),
            ("LINEBELOW", (0, 0), (-1, -2), 0.2, colors.HexColor("#1F2937")),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(t)
        story.append(Spacer(1, 6 * mm))

    # ---------- TOP OUTLETS + TOP ITEMS (side-by-side) ----------
    def top_table(title, headers, data, col_widths):
        sub = []
        sub.append(Paragraph(title, style_h2))
        rows = [headers] + data
        t = Table(rows, colWidths=col_widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), bold_font),
            ("FONTSIZE", (0, 0), (-1, 0), 7.5),
            ("FONTNAME", (0, 1), (-1, -1), body_font),
            ("FONTSIZE", (0, 1), (-1, -1), 7.5),
            ("TEXTCOLOR", (0, 0), (-1, 0), CYAN),
            ("TEXTCOLOR", (0, 1), (-1, -1), LIGHT),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1A2433")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [CARD_BG, colors.HexColor("#0F1825")]),
            ("LINEBELOW", (0, 0), (-1, -1), 0.2, colors.HexColor("#1F2937")),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        return t

    outlet_data = []
    for o in top_outlets:
        outlet_data.append([
            o.get("outlet", "-")[:34],
            fmt_rp(o.get("revenue", 0), compact=False),
            fmt_num(o.get("transactions", 0)),
            fmt_rp(o.get("avgPerTxn", 0)),
        ])

    item_data = []
    for it in top_items:
        item_data.append([
            it.get("item", "-")[:30],
            it.get("category", "-"),
            fmt_num(it.get("qty", 0)),
            fmt_rp(it.get("revenue", 0)),
        ])

    if outlet_data and item_data:
        out_t = top_table("Top 10 Outlet",
                          ["Outlet", "Revenue", "Txn", "AOV"],
                          outlet_data,
                          [40 * mm, 25 * mm, 15 * mm, 22 * mm])
        item_t = top_table("Top 10 Item",
                           ["Item", "Kategori", "Qty", "Revenue"],
                           item_data,
                           [40 * mm, 18 * mm, 15 * mm, 29 * mm])
        side_table = Table([[out_t, item_t]], colWidths=[102 * mm, 102 * mm])
        side_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(side_table)
        story.append(Spacer(1, 6 * mm))

    # ---------- PAYMENT + HOURLY ----------
    pay_data = [["Payment", "Revenue", "Txn", "Share"]]
    for p in payments:
        pay_data.append([
            p.get("payment", "-"),
            fmt_rp(p.get("revenue", 0)),
            fmt_num(p.get("transactions", 0)),
            fmt_pct(p.get("share", 0)),
        ])

    hour_data = [["Jam", "Revenue", "Txn"]]
    for h in hourly:
        hour_data.append([
            f"{(h.get('hour', 0)):02d}:00",
            fmt_rp(h.get("revenue", 0)),
            fmt_num(h.get("transactions", 0)),
        ])

    pay_t = top_table("Mix Payment", pay_data[0], pay_data[1:],
                      [30 * mm, 30 * mm, 18 * mm, 24 * mm])
    hour_t = top_table("Distribusi Jam", hour_data[0], hour_data[1:],
                       [22 * mm, 40 * mm, 40 * mm])
    side2 = Table([[pay_t, hour_t]], colWidths=[102 * mm, 102 * mm])
    side2.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(side2)

    # ---------- FOOTER ----------
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(
        f"Dokumen dihasilkan otomatis oleh KACC Dashboard. "
        f"Data sumber: Google Sheets (auto-update harian). "
        f"Generated at {fmt_date(datetime.utcnow().isoformat())}.",
        style_foot,
    ))

    # ---------- Page background color ----------
    def on_page(canv, doc_):
        canv.saveState()
        canv.setFillColor(DARK_BG)
        canv.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
        canv.restoreState()

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: generate_pdf.py <input_json> <output_pdf>", file=sys.stderr)
        sys.exit(1)
    build_pdf(sys.argv[1], sys.argv[2])
