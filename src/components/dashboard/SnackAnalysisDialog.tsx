"use client";
import { useState } from "react";
import {
  Cookie,
  CakeSlice,
  Loader2,
  Sparkles,
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
    color: "text-pink-300",
    bg: "bg-pink-500/10",
    border: "border-pink-500/30",
    icon: Cookie,
  },
  Pastry: {
    color: "text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    icon: CakeSlice,
  },
  RTD: {
    color: "text-cyan-300",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    icon: Package,
  },
};

const trendConfig: Record<string, { color: string; icon: typeof TrendingUp; label: string }> = {
  growing: { color: "text-emerald-400", icon: TrendingUp, label: "↑ Naik" },
  declining: { color: "text-red-400", icon: TrendingDown, label: "↓ Turun" },
  stable: { color: "text-muted-foreground", icon: Target, label: "= Stabil" },
  new: { color: "text-cyan-400", icon: Sparkles, label: "★ Baru" },
  discontinued: { color: "text-red-500", icon: AlertCircle, label: "✗ Stop" },
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
      <DialogContent className="max-h-[95vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cookie className="h-5 w-5 text-pink-400" />
            Analisa Penjualan Snack, Pastry & RTD
          </DialogTitle>
          <DialogDescription className="text-xs">
            Bandingkan penjualan makanan (snack, pastry, RTD) periode{" "}
            <span className="font-medium text-foreground">
              {formatDateLong(currentDateRange.start)} → {formatDateLong(currentDateRange.end)}
            </span>{" "}
            vs tanggal yang sama di bulan lalu. AI akan identifikasi best-seller, item naik/turun, peluang upsell.
          </DialogDescription>
        </DialogHeader>

        {/* Action button */}
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            className="gap-1.5 bg-pink-500/15 text-xs text-pink-300 hover:bg-pink-500/25"
            onClick={runAnalysis}
            disabled={loading || !activeSourceId}
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Menganalisa (bisa 30-60 detik)...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                {result ? "Re-run Analisa" : "Mulai Analisa Snack"}
              </>
            )}
          </Button>
          {result?.meta && (
            <div className="text-[10px] text-muted-foreground">
              {result.meta.totalItems} item dianalisa
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="mr-1 inline h-3 w-3" />
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !result && (
          <div className="space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
            <div className="h-3 w-full animate-pulse rounded bg-white/5" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-white/5" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
            <div className="mt-4 text-center text-[10px] text-muted-foreground">
              Mengambil data bulan lalu + agregasi snack + analisa AI...
            </div>
          </div>
        )}

        {/* No issues */}
        {result?.noIssues && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <Lightbulb className="mr-1 inline h-4 w-4" />
            {result.message}
          </div>
        )}

        {/* Results */}
        {result && !result.noIssues && (
          <div className="space-y-4">
            {/* AI Narrative */}
            {result.narrative && (
              <div className="rounded-lg border border-pink-500/20 bg-pink-500/5 p-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-pink-300" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-pink-300">
                    Analisa AI
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-foreground/90">
                  {result.narrative}
                </p>
              </div>
            )}

            {/* Summary KPIs */}
            {result.meta && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-pink-500/20 bg-pink-500/5 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Revenue Snack/Pastry/RTD
                  </div>
                  <div className="text-sm font-bold tabular-nums text-pink-300">
                    {formatRupiah(result.meta.totalCurrRevenue)}
                  </div>
                  {result.meta.totalDeltaPct !== null && (
                    <div className={cn(
                      "text-[10px] font-bold",
                      result.meta.totalDeltaPct < 0 ? "text-red-400" : "text-emerald-400",
                    )}>
                      {formatPct(result.meta.totalDeltaPct)} vs bulan lalu
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Total Qty Terjual
                  </div>
                  <div className="text-sm font-bold tabular-nums text-amber-300">
                    {formatNumber(result.meta.totalCurrQty)} cup
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    prev: {formatNumber(result.meta.totalPrevQty)} cup
                  </div>
                </div>
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Item Unik
                  </div>
                  <div className="text-sm font-bold tabular-nums text-cyan-300">
                    {result.meta.totalItems}
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Periode Banding
                  </div>
                  <div className="text-[11px] font-mono text-emerald-300">
                    {result.meta.prevDateRange.start} → {result.meta.prevDateRange.end}
                  </div>
                </div>
              </div>
            )}

            {/* Category breakdown */}
            {result.categoryTotals && Object.keys(result.categoryTotals).length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Target className="h-3.5 w-3.5 text-amber-300" />
                  Breakdown per Kategori
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {Object.entries(result.categoryTotals).map(([cat, t]) => {
                    const conf = categoryConfig[cat] ?? categoryConfig.Snack;
                    const Icon = conf.icon;
                    return (
                      <div
                        key={cat}
                        className={cn("rounded-lg border p-2.5", conf.border, conf.bg)}
                      >
                        <div className="mb-1 flex items-center gap-1.5">
                          <Icon className={cn("h-3.5 w-3.5", conf.color)} />
                          <span className={cn("text-xs font-bold", conf.color)}>{cat}</span>
                        </div>
                        <div className="text-sm font-bold tabular-nums text-foreground">
                          {formatRupiah(t.currRevenue)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatNumber(t.currQty)} cup (prev: {formatNumber(t.prevQty)})
                        </div>
                        {t.deltaPct !== null && (
                          <div className={cn(
                            "text-[10px] font-bold",
                            t.deltaPct < 0 ? "text-red-400" : "text-emerald-400",
                          )}>
                            {formatPct(t.deltaPct)} vs prev
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
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
                  Top Performers (Best-Seller / Naik Signifikan)
                </h3>
                <ul className="space-y-1.5">
                  {result.topPerformers.map((s, i) => (
                    <li
                      key={i}
                      className="flex gap-1.5 rounded-md bg-emerald-500/5 px-2 py-1.5 text-xs text-emerald-200"
                    >
                      <span className="font-bold text-emerald-400">↑</span>
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
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                  Item yang Turun Signifikan
                </h3>
                <ul className="space-y-1.5">
                  {result.decliningItems.map((s, i) => (
                    <li
                      key={i}
                      className="flex gap-1.5 rounded-md bg-red-500/5 px-2 py-1.5 text-xs text-red-200"
                    >
                      <span className="font-bold text-red-400">↓</span>
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
                  <Lightbulb className="h-3.5 w-3.5 text-amber-300" />
                  Peluang Bisnis (Upsell / Cross-sell / Promosi)
                </h3>
                <ul className="space-y-1">
                  {result.opportunities.map((s, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-foreground/80">
                      <span className="text-amber-300">💡</span>
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
                  <Cookie className="h-3.5 w-3.5 text-pink-300" />
                  Detail Semua Item (sorted by revenue curr)
                </h3>
                <div className="overflow-x-auto rounded-lg border border-white/5">
                  <table className="w-full">
                    <thead className="border-b border-white/5 bg-card/50">
                      <tr>
                        <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          #
                        </th>
                        <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Item
                        </th>
                        <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Kategori
                        </th>
                        <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Qty Ini
                        </th>
                        <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Qty Lalu
                        </th>
                        <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Δ %
                        </th>
                        <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Revenue Ini
                        </th>
                        <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Δ Revenue
                        </th>
                        <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
                              "border-b border-white/5 transition-colors hover:bg-white/5",
                              a.trend === "declining" && "bg-red-500/5",
                              a.trend === "growing" && "bg-emerald-500/5",
                            )}
                          >
                            <td className="px-2 py-1.5 text-[10px] font-mono text-muted-foreground">
                              {i + 1}
                            </td>
                            <td className="px-2 py-1.5 text-[11px] font-medium text-foreground" title={a.item}>
                              {a.item}
                            </td>
                            <td className="px-2 py-1.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-4 px-1 text-[9px] font-medium",
                                  conf.bg,
                                  conf.border,
                                  conf.color,
                                )}
                              >
                                {a.category}
                              </Badge>
                            </td>
                            <td className="px-2 py-1.5 text-right text-[11px] font-bold tabular-nums text-foreground">
                              {formatNumber(a.currQty)}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                              {formatNumber(a.prevQty)}
                            </td>
                            <td
                              className={cn(
                                "px-2 py-1.5 text-right text-[11px] font-bold tabular-nums",
                                a.deltaPct !== null && a.deltaPct < 0
                                  ? "text-red-400"
                                  : a.deltaPct !== null && a.deltaPct > 0
                                    ? "text-emerald-400"
                                    : "text-muted-foreground",
                              )}
                            >
                              {a.deltaPct !== null ? formatPct(a.deltaPct) : "-"}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[11px] font-bold tabular-nums text-foreground">
                              {formatRupiah(a.currRevenue)}
                            </td>
                            <td
                              className={cn(
                                "px-2 py-1.5 text-right text-[11px] tabular-nums",
                                a.revenueChange < 0
                                  ? "text-red-400"
                                  : a.revenueChange > 0
                                    ? "text-emerald-400"
                                    : "text-muted-foreground",
                              )}
                            >
                              {a.revenueChange < 0 ? "−" : a.revenueChange > 0 ? "+" : ""}
                              {formatRupiah(Math.abs(a.revenueChange))}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-bold", trendConf.color)}>
                                <TrendIcon className="h-3 w-3" />
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
                  <Target className="h-3.5 w-3.5 text-purple-300" />
                  Rekomendasi Operasional
                </h3>
                <ul className="space-y-1">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-foreground/80">
                      <span className="text-purple-300">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Generated timestamp */}
            {result.generatedAt && (
              <div className="border-t border-white/5 pt-2 text-[10px] text-muted-foreground">
                Generated at {new Date(result.generatedAt).toLocaleString("id-ID")}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
