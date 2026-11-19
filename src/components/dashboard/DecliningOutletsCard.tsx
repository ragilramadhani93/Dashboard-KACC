"use client";

import { useMemo, useState } from "react";
import {
  TrendingDown,
  AlertTriangle,
  ArrowDownRight,
  Search,
  X,
  GitCompareArrows,
  Store,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatRupiah, formatNumber, formatPct, cleanOutletName } from "@/lib/format";
import type { OutletComparisonSummary, OutletComparisonItem } from "@/lib/dashboard/outlet-compare";

interface DecliningOutletsCardProps {
  comparison: OutletComparisonSummary;
  isCompareActive: boolean;
  isLoading?: boolean;
  prevMonthLabel?: string;
  currentDateRange?: { start: string; end: string };
  prevDateRange?: { start: string; end: string };
  onEnableCompare?: () => void;
}

type SortBy = "diffRevenue" | "pctChange" | "diffTransactions";

export function DecliningOutletsCard({
  comparison,
  isCompareActive,
  isLoading = false,
  prevMonthLabel,
  currentDateRange,
  prevDateRange,
  onEnableCompare,
}: DecliningOutletsCardProps) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("diffRevenue");
  const [showAll, setShowAll] = useState(false);

  const { declining, totalDecliningRevenue, totalDecliningTxn, totalOutlets } = comparison;

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? declining.filter(
          (d) =>
            d.outlet.toLowerCase().includes(q) ||
            cleanOutletName(d.outlet).toLowerCase().includes(q),
        )
      : [...declining];

    list.sort((a, b) => {
      if (sortBy === "diffRevenue") {
        return a.diffRevenue - b.diffRevenue; // most negative first
      }
      if (sortBy === "pctChange") {
        return a.pctChange - b.pctChange; // most negative first
      }
      return a.diffTransactions - b.diffTransactions; // most negative first
    });

    return list;
  }, [declining, query, sortBy]);

  const maxDrop = useMemo(() => {
    if (declining.length === 0) return 1;
    return Math.max(...declining.map((d) => Math.abs(d.diffRevenue)), 1);
  }, [declining]);

  const displayList = showAll ? filteredAndSorted : filteredAndSorted.slice(0, 10);

  // If compare mode is not active, prompt user with clear explanation & CTA button
  if (!isCompareActive) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-danger/10 text-status-danger">
                <TrendingDown className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Daftar Outlet yang Turun (vs Bulan Lalu)
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Bandingkan omzet tiap outlet dengan tanggal yang sama di bulan lalu untuk mendeteksi penurunan penjualan dan resiko operasional.
            </p>
          </div>

          {onEnableCompare && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onEnableCompare}
              disabled={isLoading}
              className="gap-2 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memuat Data...</span>
                </>
              ) : (
                <>
                  <GitCompareArrows className="h-4 w-4" />
                  <span>Bandingkan vs Bulan Lalu</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-destructive/25 bg-card p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/15 text-status-danger">
              <TrendingDown className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Daftar Outlet yang Turun vs Bulan Lalu
            </h3>
            <Badge
              variant="outline"
              className={cn(
                "h-5 px-2 text-xs font-semibold",
                declining.length > 0
                  ? "border-destructive/40 bg-destructive/10 text-status-danger"
                  : "border-status-success/40 bg-status-success/10 text-status-success",
              )}
            >
              {declining.length} Outlet Turun
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {prevMonthLabel ? `Bulan pembanding: ${prevMonthLabel}` : "Perbandingan dengan periode bulan lalu"}
            {currentDateRange?.start && currentDateRange?.end && (
              <span> ({currentDateRange.start} s/d {currentDateRange.end} vs {prevDateRange?.start} s/d {prevDateRange?.end})</span>
            )}
          </p>
        </div>

        {/* Quick summary badges */}
        {declining.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-right">
              <span className="block text-[10px] text-muted-foreground">Total Penurunan Omzet</span>
              <span className="font-bold text-status-danger">
                -{formatRupiah(totalDecliningRevenue)}
              </span>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-right">
              <span className="block text-[10px] text-muted-foreground">Penurunan Transaksi</span>
              <span className="font-bold text-status-danger">
                -{formatNumber(totalDecliningTxn)} txn
              </span>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-1 text-right">
              <span className="block text-[10px] text-muted-foreground">Rasio Outlet Turun</span>
              <span className="font-semibold text-foreground">
                {totalOutlets > 0 ? ((declining.length / totalOutlets) * 100).toFixed(1) : 0}% ({declining.length}/{totalOutlets})
              </span>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-xs text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Memuat perbandingan outlet dengan bulan lalu...</span>
        </div>
      ) : declining.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-status-success/30 bg-status-success/5 p-4 text-xs">
          <Store className="h-5 w-5 text-status-success shrink-0" />
          <div>
            <span className="font-semibold text-status-success">Performa Sangat Positif!</span>
            <p className="text-muted-foreground mt-0.5">
              Tidak ada outlet yang mengalami penurunan omzet dibandingkan periode yang sama bulan lalu. Seluruh outlet mencatat pertumbuhan atau stabil.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Controls: Search and Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 max-w-sm">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari outlet yang turun..."
                className="h-8 pl-8 pr-8 text-xs"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs">
              <span className="text-muted-foreground">Urutkan:</span>
              <button
                type="button"
                onClick={() => setSortBy("diffRevenue")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  sortBy === "diffRevenue"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                Nominal Drop (Rp)
              </button>
              <button
                type="button"
                onClick={() => setSortBy("pctChange")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  sortBy === "pctChange"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                Persen Drop (%)
              </button>
              <button
                type="button"
                onClick={() => setSortBy("diffTransactions")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  sortBy === "diffTransactions"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                Transaksi (Txn)
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="max-h-[460px] overflow-auto rounded-lg border border-border">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xs text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-center w-10">#</th>
                  <th className="px-3 py-2.5">Outlet</th>
                  <th className="px-3 py-2.5 text-right">Bulan Ini</th>
                  <th className="px-3 py-2.5 text-right">Bulan Lalu</th>
                  <th className="px-3 py-2.5 text-right">Selisih Penurunan</th>
                  <th className="px-3 py-2.5 text-right">Perubahan (%)</th>
                  <th className="px-3 py-2.5 text-right">Selisih Txn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {displayList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      Tidak ada outlet yang cocok dengan pencarian &quot;{query}&quot;.
                    </td>
                  </tr>
                ) : (
                  displayList.map((item, idx) => {
                    const cleanName = cleanOutletName(item.outlet);
                    const absDrop = Math.abs(item.diffRevenue);
                    const barWidth = Math.min((absDrop / maxDrop) * 100, 100);
                    const isInactive = item.status === "inactive" || item.currentRevenue === 0;

                    return (
                      <tr
                        key={item.outlet}
                        className={cn(
                          "transition-colors hover:bg-muted/40",
                          isInactive && "bg-destructive/[0.04]",
                        )}
                      >
                        <td className="px-3 py-2.5 text-center font-mono text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground" title={item.outlet}>
                              {cleanName}
                            </span>
                            {isInactive && (
                              <Badge
                                variant="outline"
                                className="h-4.5 px-1.5 text-[10px] font-semibold border-destructive/40 bg-destructive/10 text-status-danger"
                              >
                                Non-aktif Bulan Ini
                              </Badge>
                            )}
                          </div>
                          {/* Visual bar of relative drop */}
                          <div className="mt-1 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-status-danger"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums text-foreground">
                          {formatRupiah(item.currentRevenue)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {formatRupiah(item.prevRevenue)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-status-danger">
                          <div className="inline-flex items-center gap-0.5">
                            <ArrowDownRight className="h-3.5 w-3.5" />
                            <span>-{formatRupiah(absDrop)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          <span className="inline-block rounded-sm bg-destructive/10 px-1.5 py-0.5 font-semibold text-status-danger">
                            {formatPct(item.pctChange)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          <span className="text-status-danger font-medium">
                            {formatNumber(item.diffTransactions)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Toggle show all */}
          {filteredAndSorted.length > 10 && (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="gap-1.5 text-xs min-h-8"
              >
                {showAll ? (
                  <>
                    <span>Tampilkan Lebih Sedikit (Top 10)</span>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    <span>Tampilkan Semua {filteredAndSorted.length} Outlet Turun</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
