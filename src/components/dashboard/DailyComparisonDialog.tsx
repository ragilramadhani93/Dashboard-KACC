"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
  Coffee,
  Store,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  X,
  Lightbulb,
  CheckCircle2,
  PackageX,
  BarChart2,
  Layers,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatRupiah, formatNumber, formatPct, cleanOutletName } from "@/lib/format";
import { formatDateLong } from "@/lib/dashboard/aggregate";
import type { TransactionRecord } from "@/lib/types";
import {
  computeDailyComparison,
  type DailyComparisonResult,
} from "@/lib/dashboard/daily-comparison";

interface DailyComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: TransactionRecord[];
  availableDates: string[]; // sorted ascending e.g. ["2026-11-01", ..., "2026-11-12"]
}

type TabKey = "declining_items" | "growing_items" | "outlets" | "hourly" | "summary";
type ItemSortKey = "diffRevenue" | "diffQty";

export function DailyComparisonDialog({
  open,
  onOpenChange,
  records,
  availableDates,
}: DailyComparisonDialogProps) {
  // Default target date: latest date in availableDates
  const defaultTargetDate = availableDates.length > 0 ? availableDates[availableDates.length - 1] : "";
  // Default compare date: 1 day before target date, or 2nd latest
  const defaultCompareDate = availableDates.length > 1 ? availableDates[availableDates.length - 2] : "";

  const [targetDate, setTargetDate] = useState<string>(defaultTargetDate);
  const [compareDate, setCompareDate] = useState<string>(defaultCompareDate);
  const [activeTab, setActiveTab] = useState<TabKey>("declining_items");
  const [itemQuery, setItemQuery] = useState("");
  const [itemSortKey, setItemSortKey] = useState<ItemSortKey>("diffRevenue");

  // Keep targetDate in sync with latest date if available
  const effectiveTargetDate = targetDate && availableDates.includes(targetDate)
    ? targetDate
    : defaultTargetDate;

  const effectiveCompareDate = compareDate && availableDates.includes(compareDate)
    ? compareDate
    : defaultCompareDate;

  // Compute daily comparison
  const comparison: DailyComparisonResult | null = useMemo(() => {
    if (!effectiveTargetDate || !effectiveCompareDate || records.length === 0) return null;
    return computeDailyComparison(records, effectiveTargetDate, effectiveCompareDate);
  }, [records, effectiveTargetDate, effectiveCompareDate]);

  // Quick helper to select target date and automatically set compare date to yesterday (T-1)
  const handleSelectTargetDate = (newTarget: string) => {
    setTargetDate(newTarget);
    const idx = availableDates.indexOf(newTarget);
    if (idx > 0) {
      setCompareDate(availableDates[idx - 1]);
    }
  };

  // Quick helper to set compare date to same day of week last week (T-7) if exists
  const handleSelectSameDowLastWeek = () => {
    const idx = availableDates.indexOf(effectiveTargetDate);
    if (idx >= 7) {
      setCompareDate(availableDates[idx - 7]);
    }
  };

  // Filtered declining items
  const filteredDecliningItems = useMemo(() => {
    if (!comparison) return [];
    const q = itemQuery.trim().toLowerCase();
    let list = q
      ? comparison.items.declining.filter(
          (i) =>
            i.item.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q),
        )
      : [...comparison.items.declining];

    list.sort((a, b) => {
      if (itemSortKey === "diffRevenue") {
        return a.diffRevenue - b.diffRevenue; // most negative first
      }
      return a.diffQty - b.diffQty; // most negative first
    });
    return list;
  }, [comparison, itemQuery, itemSortKey]);

  const maxItemDrop = useMemo(() => {
    if (!comparison || comparison.items.declining.length === 0) return 1;
    return Math.max(...comparison.items.declining.map((i) => Math.abs(i.diffRevenue)), 1);
  }, [comparison]);

  const maxHourlyVal = useMemo(() => {
    if (!comparison) return 1;
    return Math.max(
      ...comparison.hourly.map((h) => Math.max(h.targetRevenue, h.compareRevenue)),
      1,
    );
  }, [comparison]);

  if (!comparison) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl bg-card">
          <DialogHeader>
            <DialogTitle>Analisa Penjualan Harian</DialogTitle>
            <DialogDescription>Data tidak mencukupi untuk membandingkan penjualan harian.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const { targetKpi, compareKpi, deltas, rootCause } = comparison;
  const isDown = deltas.revenue < 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-6xl overflow-y-auto bg-card p-4 sm:p-6 text-foreground">
        <DialogHeader className="space-y-1.5 border-b border-border/70 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg",
                  isDown ? "bg-status-danger/15 text-status-danger" : "bg-status-success/15 text-status-success",
                )}
              >
                {isDown ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Analisa Penjualan Harian (Day-over-Day)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Bandingkan transaksi hari ini vs kemarin, diagnosa penyebab penurunan omzet, dan evaluasi menu yang terdampak.
                </DialogDescription>
              </div>
            </div>

            {/* Date Pickers & Quick Toggles */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
                <span className="text-muted-foreground font-medium">Hari Analisa:</span>
                <select
                  value={effectiveTargetDate}
                  onChange={(e) => handleSelectTargetDate(e.target.value)}
                  className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer"
                >
                  {availableDates.map((d) => (
                    <option key={d} value={d} className="bg-popover text-popover-foreground">
                      {d} {d === defaultTargetDate ? "(Terbaru)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ArrowRight className="h-3.5 w-3.5" />
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
                <span className="text-muted-foreground font-medium">Pembanding:</span>
                <select
                  value={effectiveCompareDate}
                  onChange={(e) => setCompareDate(e.target.value)}
                  className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer"
                >
                  {availableDates.map((d) => (
                    <option key={d} value={d} className="bg-popover text-popover-foreground">
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {availableDates.indexOf(effectiveTargetDate) >= 7 && (
                <button
                  type="button"
                  onClick={handleSelectSameDowLastWeek}
                  className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
                  title="Bandingkan dengan hari yang sama di minggu lalu (T-7)"
                >
                  Bandingkan vs Minggu Lalu (T-7)
                </button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Section 1: KPI Comparison Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 pt-2">
          {/* Revenue Card */}
          <div className="rounded-xl border border-border bg-card/60 p-3 shadow-2xs">
            <span className="text-[11px] font-medium text-muted-foreground">Omzet Penjualan</span>
            <div className="mt-1 flex items-baseline justify-between gap-1">
              <span className="text-base sm:text-lg font-bold tabular-nums text-foreground">
                {formatRupiah(targetKpi.revenue)}
              </span>
              <span
                className={cn(
                  "inline-flex items-center text-xs font-semibold tabular-nums",
                  deltas.revenue < 0 ? "text-status-danger" : "text-status-success",
                )}
              >
                {deltas.revenue < 0 ? (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                )}
                {formatPct(Math.abs(deltas.revenuePct))}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Kemarin: {formatRupiah(compareKpi.revenue)}</span>
              <span className={deltas.revenue < 0 ? "text-status-danger font-medium" : "text-status-success font-medium"}>
                {deltas.revenue < 0 ? "-" : "+"}{formatRupiah(Math.abs(deltas.revenue))}
              </span>
            </div>
          </div>

          {/* Transactions Card */}
          <div className="rounded-xl border border-border bg-card/60 p-3 shadow-2xs">
            <span className="text-[11px] font-medium text-muted-foreground">Total Transaksi</span>
            <div className="mt-1 flex items-baseline justify-between gap-1">
              <span className="text-base sm:text-lg font-bold tabular-nums text-foreground">
                {formatNumber(targetKpi.transactions)}
              </span>
              <span
                className={cn(
                  "inline-flex items-center text-xs font-semibold tabular-nums",
                  deltas.transactions < 0 ? "text-status-danger" : "text-status-success",
                )}
              >
                {deltas.transactions < 0 ? (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                )}
                {formatPct(Math.abs(deltas.transactionsPct))}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Kemarin: {formatNumber(compareKpi.transactions)}</span>
              <span className={deltas.transactions < 0 ? "text-status-danger font-medium" : "text-status-success font-medium"}>
                {deltas.transactions < 0 ? "" : "+"}{deltas.transactions} txn
              </span>
            </div>
          </div>

          {/* AOV Card */}
          <div className="rounded-xl border border-border bg-card/60 p-3 shadow-2xs">
            <span className="text-[11px] font-medium text-muted-foreground">AOV (Rata-rata/Struk)</span>
            <div className="mt-1 flex items-baseline justify-between gap-1">
              <span className="text-base sm:text-lg font-bold tabular-nums text-foreground">
                {formatRupiah(targetKpi.aov)}
              </span>
              <span
                className={cn(
                  "inline-flex items-center text-xs font-semibold tabular-nums",
                  deltas.aov < 0 ? "text-status-danger" : "text-status-success",
                )}
              >
                {deltas.aov < 0 ? (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                )}
                {formatPct(Math.abs(deltas.aovPct))}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Kemarin: {formatRupiah(compareKpi.aov)}</span>
              <span className={deltas.aov < 0 ? "text-status-danger font-medium" : "text-status-success font-medium"}>
                {deltas.aov < 0 ? "-" : "+"}{formatRupiah(Math.abs(deltas.aov))}
              </span>
            </div>
          </div>

          {/* Items & Outlets Card */}
          <div className="rounded-xl border border-border bg-card/60 p-3 shadow-2xs">
            <span className="text-[11px] font-medium text-muted-foreground">Item Terjual &amp; Outlet</span>
            <div className="mt-1 flex items-baseline justify-between gap-1">
              <span className="text-base sm:text-lg font-bold tabular-nums text-foreground">
                {formatNumber(targetKpi.items)} <span className="text-xs font-normal text-muted-foreground">cup</span>
              </span>
              <Badge variant="outline" className="text-[10px] font-semibold">
                {targetKpi.outlets} Outlet
              </Badge>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Kemarin: {formatNumber(compareKpi.items)} cup</span>
              <span className={deltas.items < 0 ? "text-status-danger font-medium" : "text-status-success font-medium"}>
                {deltas.items < 0 ? "" : "+"}{deltas.items} cup
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Diagnosa "Kenapa Turun / Naik?" (Root Cause Decomposition) */}
        <div
          className={cn(
            "rounded-xl border p-4 text-xs transition-colors space-y-3",
            isDown
              ? "border-destructive/30 bg-destructive/[0.04]"
              : "border-status-success/30 bg-status-success/[0.04]",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md font-bold",
                  isDown ? "bg-destructive text-destructive-foreground" : "bg-status-success text-white",
                )}
              >
                ?
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                Diagnosa Kinerja: {isDown ? "Kenapa Penjualan Turun Hari Ini?" : "Faktor Pendorong Kenaikan Hari Ini"}
              </h4>
            </div>

            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-semibold px-2 py-0.5",
                  rootCause.primaryDriver === "traffic"
                    ? "border-status-warning/40 bg-status-warning/10 text-status-warning"
                    : rootCause.primaryDriver === "basket_size"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-muted/40 text-foreground",
                )}
              >
                Faktor Utama: {rootCause.primaryDriver === "traffic" ? "Volume Transaksi (Traffic)" : rootCause.primaryDriver === "basket_size" ? "Nilai Belanja (AOV)" : rootCause.primaryDriver === "closed_outlets" ? "Outlet Tutup" : "Kombinasi Seimbang"}
              </Badge>

              {rootCause.topDropHour && (
                <Badge variant="outline" className="text-xs font-medium border-destructive/30 bg-destructive/10 text-status-danger">
                  <Clock className="mr-1 h-3 w-3" />
                  Jam Drop Terdalam: {rootCause.topDropHour.label} (-{formatRupiah(Math.abs(rootCause.topDropHour.diffRevenue))})
                </Badge>
              )}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-foreground font-medium">
            {rootCause.explanation}
          </p>

          {/* Mathematical Decomposition Breakdown */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1 border-t border-border/50 text-[11px]">
            <div className="flex items-center justify-between rounded-lg bg-card/60 px-3 py-2 border border-border/50">
              <span className="text-muted-foreground">
                Kontribusi Perubahan Traffic ({deltas.transactions} txn):
              </span>
              <span
                className={cn(
                  "font-bold tabular-nums",
                  rootCause.trafficEffect < 0 ? "text-status-danger" : "text-status-success",
                )}
              >
                {rootCause.trafficEffect < 0 ? "-" : "+"}{formatRupiah(Math.abs(rootCause.trafficEffect))}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-card/60 px-3 py-2 border border-border/50">
              <span className="text-muted-foreground">
                Kontribusi Perubahan AOV ({formatRupiah(deltas.aov)}):
              </span>
              <span
                className={cn(
                  "font-bold tabular-nums",
                  rootCause.basketEffect < 0 ? "text-status-danger" : "text-status-success",
                )}
              >
                {rootCause.basketEffect < 0 ? "-" : "+"}{formatRupiah(Math.abs(rootCause.basketEffect))}
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Deep-Dive Tabs */}
        <div className="space-y-3 pt-2">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("declining_items")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                activeTab === "declining_items"
                  ? "bg-destructive text-destructive-foreground font-semibold"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground",
              )}
            >
              <TrendingDown className="h-3.5 w-3.5" />
              <span>Menu yang Turun ({comparison.items.declining.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("growing_items")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                activeTab === "growing_items"
                  ? "bg-status-success text-white font-semibold"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground",
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Menu yang Naik ({comparison.items.growing.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("outlets")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                activeTab === "outlets"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground",
              )}
            >
              <Store className="h-3.5 w-3.5" />
              <span>Outlet yang Drop ({comparison.outlets.declining.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("hourly")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                activeTab === "hourly"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground",
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Perbandingan Jam per Jam</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                activeTab === "summary"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground",
              )}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              <span>Rangkuman &amp; Aksi Operasional</span>
            </button>
          </div>

          {/* TAB 1: Declining Items */}
          {activeTab === "declining_items" && (
            <div className="space-y-3">
              {/* Alert for zero sales items */}
              {comparison.items.zeroToday.length > 0 && (
                <div className="flex items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs">
                  <PackageX className="h-4 w-4 text-status-danger shrink-0" />
                  <span className="text-foreground">
                    <strong className="text-status-danger">{comparison.items.zeroToday.length} menu</strong> mencatat penjualan kemarin namun <strong>0 penjualan hari ini</strong> (indikasi stock-out):{" "}
                    {comparison.items.zeroToday.slice(0, 4).map((i) => i.item).join(", ")}
                    {comparison.items.zeroToday.length > 4 ? ` dan ${comparison.items.zeroToday.length - 4} lainnya` : ""}.
                  </span>
                </div>
              )}

              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1 max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={itemQuery}
                    onChange={(e) => setItemQuery(e.target.value)}
                    placeholder="Cari menu yang turun..."
                    className="h-8 pl-8 pr-8 text-xs"
                  />
                  {itemQuery && (
                    <button
                      type="button"
                      onClick={() => setItemQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">Urutkan:</span>
                  <button
                    type="button"
                    onClick={() => setItemSortKey("diffRevenue")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                      itemSortKey === "diffRevenue"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Nominal Drop (Rp)
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemSortKey("diffQty")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                      itemSortKey === "diffQty"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Volume Drop (Qty)
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="max-h-[380px] overflow-auto rounded-lg border border-border">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-center w-8">#</th>
                      <th className="px-3 py-2">Nama Menu</th>
                      <th className="px-3 py-2">Kategori</th>
                      <th className="px-3 py-2 text-right">Hari Ini</th>
                      <th className="px-3 py-2 text-right">Kemarin</th>
                      <th className="px-3 py-2 text-right">Selisih Qty</th>
                      <th className="px-3 py-2 text-right">Selisih Omzet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredDecliningItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                          {itemQuery
                            ? `Tidak ada menu yang cocok dengan pencarian "${itemQuery}".`
                            : "Tidak ada menu yang mengalami penurunan penjualan."}
                        </td>
                      </tr>
                    ) : (
                      filteredDecliningItems.map((item, idx) => {
                        const absDrop = Math.abs(item.diffRevenue);
                        const barWidth = Math.min((absDrop / maxItemDrop) * 100, 100);

                        return (
                          <tr
                            key={item.item}
                            className={cn(
                              "transition-colors hover:bg-muted/40",
                              item.isZeroToday && "bg-destructive/[0.04]",
                            )}
                          >
                            <td className="px-3 py-2 text-center font-mono text-muted-foreground">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground">{item.item}</span>
                                {item.isZeroToday && (
                                  <Badge
                                    variant="outline"
                                    className="h-4.5 px-1.5 text-[10px] font-semibold border-destructive/40 bg-destructive/10 text-status-danger"
                                  >
                                    0 Penjualan Hari Ini
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-status-danger"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              <Badge variant="outline" className="text-[10px] font-normal">
                                {item.category}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">
                              {item.targetQty} cup
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {item.compareQty} cup
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              <span className="font-semibold text-status-danger">
                                {item.diffQty} cup ({formatPct(item.pctQtyChange)})
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums text-status-danger">
                              -{formatRupiah(absDrop)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Growing Items */}
          {activeTab === "growing_items" && (
            <div className="space-y-3">
              <div className="max-h-[380px] overflow-auto rounded-lg border border-border">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-center w-8">#</th>
                      <th className="px-3 py-2">Nama Menu</th>
                      <th className="px-3 py-2">Kategori</th>
                      <th className="px-3 py-2 text-right">Hari Ini</th>
                      <th className="px-3 py-2 text-right">Kemarin</th>
                      <th className="px-3 py-2 text-right">Pertumbuhan Qty</th>
                      <th className="px-3 py-2 text-right">Kenaikan Omzet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {comparison.items.growing.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                          Tidak ada menu yang mengalami kenaikan penjualan hari ini.
                        </td>
                      </tr>
                    ) : (
                      comparison.items.growing.map((item, idx) => (
                        <tr key={item.item} className="transition-colors hover:bg-muted/40">
                          <td className="px-3 py-2 text-center font-mono text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 font-semibold text-foreground">
                            {item.item}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {item.category}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">
                            {item.targetQty} cup
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {item.compareQty} cup
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-status-success">
                            +{item.diffQty} cup (+{formatPct(item.pctQtyChange)})
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-status-success">
                            +{formatRupiah(item.diffRevenue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Declining Outlets */}
          {activeTab === "outlets" && (
            <div className="space-y-3">
              <div className="max-h-[380px] overflow-auto rounded-lg border border-border">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-center w-8">#</th>
                      <th className="px-3 py-2">Outlet</th>
                      <th className="px-3 py-2 text-right">Hari Ini</th>
                      <th className="px-3 py-2 text-right">Kemarin</th>
                      <th className="px-3 py-2 text-right">Penurunan Omzet</th>
                      <th className="px-3 py-2 text-right">% Perubahan</th>
                      <th className="px-3 py-2 text-right">Selisih Transaksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {comparison.outlets.declining.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                          Seluruh outlet mencatat omzet bertumbuh atau stabil dibanding kemarin.
                        </td>
                      </tr>
                    ) : (
                      comparison.outlets.declining.map((o, idx) => (
                        <tr
                          key={o.outlet}
                          className={cn(
                            "transition-colors hover:bg-muted/40",
                            o.isZeroToday && "bg-destructive/[0.04]",
                          )}
                        >
                          <td className="px-3 py-2 text-center font-mono text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">
                                {cleanOutletName(o.outlet)}
                              </span>
                              {o.isZeroToday && (
                                <Badge
                                  variant="outline"
                                  className="h-4.5 px-1.5 text-[10px] font-semibold border-destructive/40 bg-destructive/10 text-status-danger"
                                >
                                  Tutup / 0 Transaksi
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">
                            {formatRupiah(o.targetRevenue)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {formatRupiah(o.compareRevenue)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-status-danger">
                            -{formatRupiah(Math.abs(o.diffRevenue))}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-status-danger">
                            {formatPct(o.pctChange)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-status-danger">
                            {o.diffTxn} txn
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Hourly Comparison Chart */}
          {activeTab === "hourly" && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3 text-xs bg-muted/20">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                  <span>Grafik Perbandingan Omzet per Jam Operasional (06:00 - 22:00)</span>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-xs bg-primary" />
                      <span>Hari Ini ({targetDate})</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-xs bg-muted-foreground/40" />
                      <span>Kemarin ({compareDate})</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                  {comparison.hourly.map((h) => {
                    const tWidth = (h.targetRevenue / maxHourlyVal) * 100;
                    const cWidth = (h.compareRevenue / maxHourlyVal) * 100;
                    const isDrop = h.diffRevenue < -1000;

                    return (
                      <div key={h.hour} className="space-y-0.5 rounded-md p-1.5 hover:bg-muted/40 transition-colors">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-medium text-foreground w-12">{h.label}</span>
                          <span className="text-muted-foreground">
                            Hari ini: <strong className="text-foreground">{formatRupiah(h.targetRevenue)}</strong> ({h.targetTxn} txn) | Kemarin: {formatRupiah(h.compareRevenue)} ({h.compareTxn} txn)
                          </span>
                          <span className={cn("font-bold tabular-nums w-24 text-right", isDrop ? "text-status-danger" : "text-status-success")}>
                            {h.diffRevenue < 0 ? "-" : "+"}{formatRupiah(Math.abs(h.diffRevenue))}
                          </span>
                        </div>
                        {/* Comparison bars */}
                        <div className="space-y-0.5">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${tWidth}%` }} />
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
                            <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${cWidth}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Executive Summary & Recommendations */}
          {activeTab === "summary" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">
                    Temuan Kunci Penjualan Harian
                  </h4>
                </div>
                <ul className="space-y-2 text-xs text-foreground">
                  {comparison.summaryPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-status-warning/30 bg-status-warning/[0.04] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-status-warning" />
                  <h4 className="text-sm font-semibold text-status-warning">
                    Rekomendasi Tindakan Operasional
                  </h4>
                </div>
                <ul className="space-y-2 text-xs text-foreground">
                  {comparison.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-status-warning shrink-0" />
                      <span className="leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
