"use client";
import { useState } from "react";
import {
  Cookie,
  CakeSlice,
  Loader2,
  FileText,
  Star,
  XCircle,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Target,
  AlertCircle,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatRupiah, formatNumber, formatPct } from "@/lib/format";
import { formatDateLong } from "@/lib/dashboard/aggregate";

interface SnackItemAgg {
  item: string;
  category: string;
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

interface SnackResult {
  available: boolean;
  noIssues?: boolean;
  message?: string;
  narrative?: string;
  topPerformers?: string[];
  decliningItems?: string[];
  revenueSummary?: string;
  opportunities?: string[];
  recommendations?: string[];
  itemAnalyses?: SnackItemAgg[];
  categoryTotals?: Record<string, {
    currRevenue: number;
    prevRevenue: number;
    currQty: number;
    prevQty: number;
    deltaPct: number | null;
  }>;
  meta?: {
    currentDateRange: { start: string; end: string };
    prevDateRange: { start: string; end: string };
    totalItems: number;
    totalCurrRevenue: number;
    totalPrevRevenue: number;
    totalCurrQty: number;
    totalPrevQty: number;
    totalDeltaPct: number | null;
  };
  generatedAt?: string;
  error?: string;
}

interface SnackAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSourceId: string | null;
  currentDateRange: { start: string; end: string };
  filters: {
    outlets: string[];
    payments: string[];
    itemCategories: string[];
    menuTypes: string[];
  };
}

const categoryConfig: Record<string, {
  color: string;
  bg: string;
  border: string;
  icon: typeof Cookie;
}> = {
  Snack: {
    color: "text-primary",
    bg: "bg-primary/[0.06]",
    border: "border-primary/35",
    icon: Cookie,
  },
  Pastry: {
    color: "text-amber-800 dark:text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-600/35",
    icon: CakeSlice,
  },
  RTD: {
    color: "text-blue-800 dark:text-blue-300",
    bg: "bg-blue-600/10",
    border: "border-blue-600/35",
    icon: Package,
  },
};

const trendConfig: Record<string, { color: string; icon: typeof TrendingUp; label: string }> = {
  growing: { color: "text-emerald-700 dark:text-emerald-300", icon: TrendingUp, label: "Naik" },
  declining: { color: "text-red-700 dark:text-red-400", icon: TrendingDown, label: "Turun" },
  stable: { color: "text-muted-foreground", icon: Target, label: "Stabil" },
  new: { color: "text-primary", icon: Star, label: "Baru" },
  discontinued: { color: "text-red-700 dark:text-red-400", icon: XCircle, label: "Stop" },
};

export function SnackAnalysisDialog({
  open,
  onOpenChange,
  activeSourceId,
  currentDateRange,
  filters,
}: SnackAnalysisDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SnackResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    if (!activeSourceId || !currentDateRange.start || !currentDateRange.end) {
      toast({
        title: "Data belum siap",
        description: "Pilih periode tanggal dulu sebelum analisa snack.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/insight/snack-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeSourceId,
          currentDateRange,
          filters,
        }),
      });
      const data: SnackResult = await res.json();
      if (!res.ok && !data.available) {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      setResult(data);
      if (data.error) {
        toast({
          title: "AI narrative gagal",
          description: "Data item tetap ditampilkan, tapi AI narrative tidak tersedia.",
          variant: "destructive",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      toast({
        title: "Analisa gagal",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[96vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cookie aria-hidden="true" className="h-5 w-5 text-primary" />
            Analisa Penjualan Snack, Pastry &amp; RTD
          </DialogTitle>
          <DialogDescription className="text-xs">
            Bandingkan penjualan makanan (snack, pastry, RTD) periode{" "}
            <span className="font-medium text-foreground">
              {formatDateLong(currentDateRange.start)} s/d {formatDateLong(currentDateRange.end)}
            </span>{" "}
            vs tanggal yang sama di bulan lalu untuk identifikasi best-seller, item naik/turun, dan peluang upsell.
          </DialogDescription>
        </DialogHeader>

        {/* Action button */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            size="sm"
            className="min-h-10 gap-1.5 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={runAnalysis}
            disabled={loading || !activeSourceId}
          >
            {loading ? (
              <>
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                Menganalisa (bisa 30-60 detik)...
              </>
            ) : (
              <>
                <Cookie aria-hidden="true" className="h-3.5 w-3.5" />
                {result ? "Jalankan Ulang Analisa" : "Mulai Analisa Snack"}
              </>
            )}
          </Button>
          {result?.meta && (
            <div className="text-xs text-muted-foreground">
              {result.meta.totalItems} item dianalisa
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-red-700 dark:text-red-300"
          >
            <AlertCircle aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !result && (
          <div className="space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="mt-4 text-center text-xs text-muted-foreground">
              Mengambil data bulan lalu, agregasi snack, dan menyusun analisa...
            </div>
          </div>
        )}

        {/* No issues */}
        {result?.noIssues && (
          <div className="rounded-lg border border-emerald-700/30 bg-emerald-700/10 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
            <Lightbulb aria-hidden="true" className="mr-1.5 inline h-4 w-4" />
            {result.message}
          </div>
        )}

        {/* Results */}
        {result && !result.noIssues && (
          <div className="space-y-4">
            {/* Narrative */}
            {result.narrative && (
              <div className="rounded-lg border border-primary/30 bg-primary/[0.05] p-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <FileText aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary">
                    Ringkasan Analisa
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-foreground">
                  {result.narrative}
                </p>
              </div>
            )}

            {/* Summary KPIs */}
            {result.meta && (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-primary/35 bg-primary/[0.06] p-2.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    Revenue Snack/Pastry/RTD
                  </div>
                  <div className="text-sm font-bold tabular-nums text-foreground">
                    {formatRupiah(result.meta.totalCurrRevenue)}
                  </div>
                  {result.meta.totalDeltaPct !== null && (
                    <div className={cn(
                      "text-xs font-semibold",
                      result.meta.totalDeltaPct < 0
                        ? "text-red-700 dark:text-red-400"
                        : "text-emerald-700 dark:text-emerald-300",
                    )}>
                      {formatPct(result.meta.totalDeltaPct)} vs bulan lalu
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-2.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    Total Qty Terjual
                  </div>
                  <div className="text-sm font-bold tabular-nums text-foreground">
                    {formatNumber(result.meta.totalCurrQty)} pcs
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Bulan lalu: {formatNumber(result.meta.totalPrevQty)} pcs
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-2.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    Item Unik
                  </div>
                  <div className="text-sm font-bold tabular-nums text-foreground">
                    {result.meta.totalItems}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-2.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    Periode Banding
                  </div>
                  <div className="text-xs font-mono text-foreground">
                    {result.meta.prevDateRange.start} s/d {result.meta.prevDateRange.end}
                  </div>
                </div>
              </div>
            )}

            {/* Category breakdown */}
            {result.categoryTotals && Object.keys(result.categoryTotals).length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Target aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                  Breakdown per Kategori
                </h3>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {Object.entries(result.categoryTotals).map(([cat, t]) => {
                    const conf = categoryConfig[cat] ?? categoryConfig.Snack;
                    const Icon = conf.icon;
                    return (
                      <div
                        key={cat}
                        className={cn("rounded-lg border p-3", conf.border, conf.bg)}
                      >
                        <div className="mb-1 flex items-center gap-1.5">
                          <Icon aria-hidden="true" className={cn("h-3.5 w-3.5", conf.color)} />
                          <span className={cn("text-xs font-bold", conf.color)}>{cat}</span>
                        </div>
                        <div className="text-sm font-bold tabular-nums text-foreground">
                          {formatRupiah(t.currRevenue)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatNumber(t.currQty)} pcs (lalu: {formatNumber(t.prevQty)})
                        </div>
                        {t.deltaPct !== null && (
                          <div className={cn(
                            "mt-0.5 text-xs font-semibold",
                            t.deltaPct < 0
                              ? "text-red-700 dark:text-red-400"
                              : "text-emerald-700 dark:text-emerald-300",
                          )}>
                            {formatPct(t.deltaPct)} vs bulan lalu
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Top performers */}
            {result.topPerformers && result.topPerformers.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <TrendingUp aria-hidden="true" className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                  Top Performers (Best-Seller / Naik Signifikan)
                </h3>
                <ul className="space-y-1.5">
                  {result.topPerformers.map((s, i) => (
                    <li
                      key={i}
                      className="flex gap-2 rounded-md border border-emerald-700/25 bg-emerald-700/10 px-2.5 py-2 text-xs text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200"
                    >
                      <span aria-hidden="true" className="font-bold">+</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Declining items */}
            {result.decliningItems && result.decliningItems.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <TrendingDown aria-hidden="true" className="h-3.5 w-3.5 text-red-700 dark:text-red-400" />
                  Item yang Turun Signifikan
                </h3>
                <ul className="space-y-1.5">
                  {result.decliningItems.map((s, i) => (
                    <li
                      key={i}
                      className="flex gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-2 text-xs text-red-800 dark:text-red-200"
                    >
                      <span aria-hidden="true" className="font-bold">-</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Opportunities */}
            {result.opportunities && result.opportunities.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Lightbulb aria-hidden="true" className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                  Peluang Bisnis (Upsell / Cross-sell / Promosi)
                </h3>
                <ul className="space-y-1">
                  {result.opportunities.map((s, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed text-foreground/90">
                      <span aria-hidden="true" className="font-bold text-primary">-</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Item analyses table */}
            {result.itemAnalyses && result.itemAnalyses.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Cookie aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                  Detail Semua Item (urut revenue periode ini)
                </h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full">
                    <thead className="border-b border-border bg-muted/50">
                      <tr>
                        <th className="px-2.5 py-2 text-left text-xs font-semibold text-muted-foreground">
                          #
                        </th>
                        <th className="px-2.5 py-2 text-left text-xs font-semibold text-muted-foreground">
                          Item
                        </th>
                        <th className="px-2.5 py-2 text-left text-xs font-semibold text-muted-foreground">
                          Kategori
                        </th>
                        <th className="px-2.5 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Qty Ini
                        </th>
                        <th className="px-2.5 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Qty Lalu
                        </th>
                        <th className="px-2.5 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Delta %
                        </th>
                        <th className="px-2.5 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Revenue Ini
                        </th>
                        <th className="px-2.5 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Selisih Revenue
                        </th>
                        <th className="px-2.5 py-2 text-center text-xs font-semibold text-muted-foreground">
                          Trend
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.itemAnalyses.map((a, i) => {
                        const conf = categoryConfig[a.category] ?? categoryConfig.Snack;
                        const trendConf = trendConfig[a.trend] ?? trendConfig.stable;
                        const TrendIcon = trendConf.icon;
                        return (
                          <tr
                            key={a.item}
                            className={cn(
                              "border-b border-border/70 transition-colors hover:bg-muted/40",
                              a.trend === "declining" && "bg-destructive/[0.06]",
                              a.trend === "growing" && "bg-emerald-700/[0.06] dark:bg-emerald-400/[0.06]",
                            )}
                          >
                            <td className="px-2.5 py-2 text-xs font-mono text-muted-foreground">
                              {i + 1}
                            </td>
                            <td className="px-2.5 py-2 text-xs font-medium text-foreground" title={a.item}>
                              {a.item}
                            </td>
                            <td className="px-2.5 py-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-5 px-2 text-[11px] font-medium",
                                  conf.bg,
                                  conf.border,
                                  conf.color,
                                )}
                              >
                                {a.category}
                              </Badge>
                            </td>
                            <td className="px-2.5 py-2 text-right text-xs font-bold tabular-nums text-foreground">
                              {formatNumber(a.currQty)}
                            </td>
                            <td className="px-2.5 py-2 text-right text-xs tabular-nums text-muted-foreground">
                              {formatNumber(a.prevQty)}
                            </td>
                            <td
                              className={cn(
                                "px-2.5 py-2 text-right text-xs font-bold tabular-nums",
                                a.deltaPct !== null && a.deltaPct < 0
                                  ? "text-red-700 dark:text-red-400"
                                  : a.deltaPct !== null && a.deltaPct > 0
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : "text-muted-foreground",
                              )}
                            >
                              {a.deltaPct !== null ? formatPct(a.deltaPct) : "-"}
                            </td>
                            <td className="px-2.5 py-2 text-right text-xs font-bold tabular-nums text-foreground">
                              {formatRupiah(a.currRevenue)}
                            </td>
                            <td
                              className={cn(
                                "px-2.5 py-2 text-right text-xs tabular-nums",
                                a.revenueChange < 0
                                  ? "text-red-700 dark:text-red-400"
                                  : a.revenueChange > 0
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : "text-muted-foreground",
                              )}
                            >
                              {a.revenueChange < 0 ? "-" : a.revenueChange > 0 ? "+" : ""}
                              {formatRupiah(Math.abs(a.revenueChange))}
                            </td>
                            <td className="px-2.5 py-2 text-center">
                              <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", trendConf.color)}>
                                <TrendIcon aria-hidden="true" className="h-3.5 w-3.5" />
                                {trendConf.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Target aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                  Rekomendasi Operasional
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {result.recommendations.map((r, i) => (
                    <li
                      key={i}
                      className="flex gap-2 rounded-md border border-border/60 bg-muted/30 p-2.5 text-xs leading-relaxed text-foreground/90"
                    >
                      <span aria-hidden="true" className="font-bold text-primary">-</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Generated timestamp */}
            {result.generatedAt && (
              <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                Dibuat pada {new Date(result.generatedAt).toLocaleString("id-ID")}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
