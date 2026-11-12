"use client";
import { useState } from "react";
import {
  AlertTriangle,
  PackageX,
  Loader2,
  FileText,
  TrendingDown,
  Calendar,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  AlertCircle,
  CreditCard,
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
import { formatDateLong, formatDateShort } from "@/lib/dashboard/aggregate";

interface DayBreakdown {
  date: string;
  dayOfWeek: string;
  qty: number;
  revenue: number;
  prevSameDowAvg: number;
  isZeroAnomaly: boolean;
}

interface ItemAnalysis {
  item: string;
  category: string;
  prevQty: number;
  currQty: number;
  deltaPct: number | null;
  prevRevenue: number;
  currRevenue: number;
  revenueLoss: number;
  severity: "severe" | "high" | "moderate" | "normal";
  severityReason: string;
  zeroAnomalyDays: string[];
  currDaysWithSales: number;
  currPeriodDays: number;
  prevDaysWithSales: number;
  prevPeriodDays: number;
  dailyBreakdown: DayBreakdown[];
}

interface PaymentAnalysis {
  payment: string;
  prevRevenue: number;
  currRevenue: number;
  prevTransactions: number;
  currTransactions: number;
  revenueDeltaPct: number | null;
  txnDeltaPct: number | null;
  prevShare: number;
  currShare: number;
  revenueChange: number;
}

interface StockoutResult {
  available: boolean;
  noIssues?: boolean;
  message?: string;
  narrative?: string;
  suspectedStockout?: string[];
  revenueLossEstimate?: string;
  restockPriority?: Array<{ item: string; priority: string; reason: string }>;
  recommendations?: string[];
  paymentMethodAnalysis?: string;
  itemAnalyses?: ItemAnalysis[];
  paymentAnalyses?: PaymentAnalysis[];
  meta?: {
    currentDateRange: { start: string; end: string };
    prevDateRange: { start: string; end: string };
    totalItemsAnalyzed: number;
    suspectedItemsCount: number;
    totalRevenueLossRaw: number;
    totalCurrRevenue?: number;
    totalPrevRevenue?: number;
  };
  generatedAt?: string;
  error?: string;
}

interface StockoutAnalysisDialogProps {
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

const severityConfig: Record<
  string,
  { color: string; bg: string; border: string; icon: typeof AlertTriangle; label: string }
> = {
  severe: {
    color: "text-red-700 dark:text-red-400",
    bg: "bg-destructive/10",
    border: "border-destructive/40",
    icon: AlertTriangle,
    label: "SEVERE",
  },
  high: {
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/40",
    icon: PackageX,
    label: "TINGGI",
  },
  moderate: {
    color: "text-amber-800 dark:text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-600/40",
    icon: TrendingDown,
    label: "SEDANG",
  },
  normal: {
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-700/10 dark:bg-emerald-400/10",
    border: "border-emerald-700/40 dark:border-emerald-400/40",
    icon: Lightbulb,
    label: "NORMAL",
  },
};

const priorityColor: Record<string, string> = {
  KRITIS: "border-destructive/40 bg-destructive/10 text-red-700 dark:text-red-400",
  TINGGI: "border-primary/40 bg-primary/10 text-primary",
  SEDANG: "border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
};

export function StockoutAnalysisDialog({
  open,
  onOpenChange,
  activeSourceId,
  currentDateRange,
  filters,
}: StockoutAnalysisDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StockoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  async function runAnalysis() {
    if (!activeSourceId || !currentDateRange.start || !currentDateRange.end) {
      toast({
        title: "Data belum siap",
        description: "Pilih periode tanggal dulu sebelum analisa stock-out.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/insight/stockout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeSourceId,
          currentDateRange,
          filters,
        }),
      });
      const data: StockoutResult = await res.json();
      if (!res.ok && !data.available) {
        throw new Error(
          data.message || data.error || `HTTP ${res.status}`,
        );
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

  function toggleItem(item: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX aria-hidden="true" className="h-5 w-5 text-primary" />
            Analisa Indikasi Stock-Out
          </DialogTitle>
          <DialogDescription className="text-xs">
            Bandingkan penjualan menu periode{" "}
            <span className="font-medium text-foreground">
              {formatDateLong(currentDateRange.start)} s/d {formatDateLong(currentDateRange.end)}
            </span>{" "}
            vs tanggal yang sama di bulan lalu untuk mengidentifikasi item yang kemungkinan kehabisan stok.
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
                <PackageX aria-hidden="true" className="h-3.5 w-3.5" />
                {result ? "Jalankan Ulang Analisa" : "Mulai Analisa Stock-Out"}
              </>
            )}
          </Button>
          {result?.meta && (
            <div className="text-xs text-muted-foreground">
              {result.meta.totalItemsAnalyzed} item dianalisa, {result.meta.suspectedItemsCount} terindikasi
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
              Mengambil data bulan lalu, agregasi per item per hari, dan menyusun analisa...
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

            {/* Revenue loss + meta */}
            {result.meta && (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div className="rounded-lg border border-destructive/30 bg-destructive/[0.06] p-2.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    Estimasi Revenue Loss
                  </div>
                  <div className="text-sm font-bold tabular-nums text-red-700 dark:text-red-400">
                    {result.revenueLossEstimate || formatRupiah(result.meta.totalRevenueLossRaw)}
                  </div>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/[0.06] p-2.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    Item Terindikasi
                  </div>
                  <div className="text-sm font-bold tabular-nums text-primary">
                    {result.meta.suspectedItemsCount} dari {result.meta.totalItemsAnalyzed}
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

            {/* Suspected stock-out items */}
            {result.suspectedStockout && result.suspectedStockout.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 text-red-700 dark:text-red-400" />
                  Item Terindikasi Kuat Stock-Out
                </h3>
                <ul className="space-y-1.5">
                  {result.suspectedStockout.map((s, i) => (
                    <li
                      key={i}
                      className="flex gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-2 text-xs text-red-800 dark:text-red-200"
                    >
                      <span aria-hidden="true" className="font-bold">!</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Restock priority */}
            {result.restockPriority && result.restockPriority.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <PackageX aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                  Prioritas Restock
                </h3>
                <div className="space-y-1.5">
                  {result.restockPriority.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-md border border-border bg-muted/40 px-2.5 py-2"
                    >
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-5 shrink-0 px-1.5 text-[11px] font-bold",
                          priorityColor[p.priority] ?? priorityColor.SEDANG,
                        )}
                      >
                        {p.priority}
                      </Badge>
                      <div className="flex-1">
                        <div className="text-xs font-medium text-foreground">{p.item}</div>
                        <div className="text-xs text-muted-foreground">{p.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Payment method comparison */}
            {result.paymentAnalyses && result.paymentAnalyses.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <CreditCard aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                  Penurunan per Metode Pembayaran (Periode Ini vs Lalu)
                </h3>

                {/* Payment analysis narrative */}
                {result.paymentMethodAnalysis && (
                  <div className="mb-2.5 rounded-lg border border-border bg-muted/50 p-3">
                    <div className="mb-1 flex items-center gap-1.5">
                      <FileText aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold text-foreground">
                        Ringkasan Metode Pembayaran
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/90">
                      {result.paymentMethodAnalysis}
                    </p>
                  </div>
                )}

                {/* Payment table */}
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full">
                    <thead className="border-b border-border bg-muted/50">
                      <tr>
                        <th className="px-2.5 py-2 text-left text-xs font-semibold text-muted-foreground">
                          Payment
                        </th>
                        <th className="px-2.5 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Revenue Ini
                        </th>
                        <th className="px-2.5 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Revenue Lalu
                        </th>
                        <th className="px-2.5 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Selisih Revenue
                        </th>
                        <th className="px-2.5 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Delta %
                        </th>
                        <th className="px-2.5 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Txn Ini
                        </th>
                        <th className="px-2.5 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Txn Lalu
                        </th>
                        <th className="px-2.5 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Share Ini
                        </th>
                        <th className="px-2.5 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Share Lalu
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.paymentAnalyses.map((p) => {
                        const isLoss = p.revenueChange < 0;
                        const isGain = p.revenueChange > 0;
                        const isSignificant = Math.abs(p.revenueChange) > 1_000_000;
                        return (
                          <tr
                            key={p.payment}
                            className={cn(
                              "border-b border-border/70 transition-colors hover:bg-muted/40",
                              isLoss && isSignificant && "bg-destructive/[0.06]",
                              isGain && isSignificant && "bg-emerald-700/[0.06] dark:bg-emerald-400/[0.06]",
                            )}
                          >
                            <td className="px-2.5 py-2 text-xs font-medium text-foreground">
                              {p.payment}
                            </td>
                            <td className="px-2.5 py-2 text-right text-xs tabular-nums text-foreground">
                              {formatRupiah(p.currRevenue)}
                            </td>
                            <td className="px-2.5 py-2 text-right text-xs tabular-nums text-muted-foreground">
                              {formatRupiah(p.prevRevenue)}
                            </td>
                            <td
                              className={cn(
                                "px-2.5 py-2 text-right text-xs font-bold tabular-nums",
                                isLoss
                                  ? "text-red-700 dark:text-red-400"
                                  : isGain
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : "text-muted-foreground",
                              )}
                            >
                              {isLoss ? "-" : isGain ? "+" : ""}
                              {formatRupiah(Math.abs(p.revenueChange))}
                            </td>
                            <td
                              className={cn(
                                "px-2.5 py-2 text-right text-xs font-bold tabular-nums",
                                p.revenueDeltaPct !== null && p.revenueDeltaPct < 0
                                  ? "text-red-700 dark:text-red-400"
                                  : p.revenueDeltaPct !== null && p.revenueDeltaPct > 0
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : "text-muted-foreground",
                              )}
                            >
                              {p.revenueDeltaPct !== null ? formatPct(p.revenueDeltaPct) : "-"}
                            </td>
                            <td className="px-2.5 py-2 text-right text-xs tabular-nums text-muted-foreground">
                              {formatNumber(p.currTransactions)}
                            </td>
                            <td className="px-2.5 py-2 text-right text-xs tabular-nums text-muted-foreground">
                              {formatNumber(p.prevTransactions)}
                            </td>
                            <td className="px-2.5 py-2 text-right text-xs tabular-nums text-foreground">
                              {formatPct(p.currShare)}
                            </td>
                            <td className="px-2.5 py-2 text-right text-xs tabular-nums text-muted-foreground">
                              {formatPct(p.prevShare)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {result.meta?.totalCurrRevenue !== undefined && result.meta?.totalPrevRevenue !== undefined && (
                      <tfoot className="border-t-2 border-border bg-muted/50">
                        <tr>
                          <td className="px-2.5 py-2 text-xs font-bold text-foreground">TOTAL</td>
                          <td className="px-2.5 py-2 text-right text-xs font-bold tabular-nums text-foreground">
                            {formatRupiah(result.meta.totalCurrRevenue)}
                          </td>
                          <td className="px-2.5 py-2 text-right text-xs font-bold tabular-nums text-muted-foreground">
                            {formatRupiah(result.meta.totalPrevRevenue)}
                          </td>
                          <td
                            className={cn(
                              "px-2.5 py-2 text-right text-xs font-bold tabular-nums",
                              result.meta.totalCurrRevenue - result.meta.totalPrevRevenue < 0
                                ? "text-red-700 dark:text-red-400"
                                : "text-emerald-700 dark:text-emerald-300",
                            )}
                          >
                            {result.meta.totalCurrRevenue - result.meta.totalPrevRevenue < 0 ? "-" : "+"}
                            {formatRupiah(Math.abs(result.meta.totalCurrRevenue - result.meta.totalPrevRevenue))}
                          </td>
                          <td
                            className={cn(
                              "px-2.5 py-2 text-right text-xs font-bold tabular-nums",
                              result.meta.totalPrevRevenue > 0 &&
                              ((result.meta.totalCurrRevenue - result.meta.totalPrevRevenue) / result.meta.totalPrevRevenue) * 100 < 0
                                ? "text-red-700 dark:text-red-400"
                                : "text-emerald-700 dark:text-emerald-300",
                            )}
                          >
                            {result.meta.totalPrevRevenue > 0
                              ? formatPct(
                                  ((result.meta.totalCurrRevenue - result.meta.totalPrevRevenue) /
                                    result.meta.totalPrevRevenue) *
                                    100,
                                )
                              : "-"}
                          </td>
                          <td colSpan={2}></td>
                          <td className="px-2.5 py-2 text-right text-xs font-bold tabular-nums text-foreground">
                            100,0%
                          </td>
                          <td className="px-2.5 py-2 text-right text-xs font-bold tabular-nums text-muted-foreground">
                            100,0%
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Keterangan: Baris merah menandakan penurunan di atas Rp 1 juta; baris hijau menandakan kenaikan di atas Rp 1 juta (diurut dari penurunan terbesar).
                </p>
              </section>
            )}

            {/* Item analyses table */}
            {result.itemAnalyses && result.itemAnalyses.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <TrendingDown aria-hidden="true" className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                  Detail Item Terindikasi (pilih untuk rincian harian)
                </h3>
                <div className="space-y-2">
                  {result.itemAnalyses.map((a) => {
                    const sev = severityConfig[a.severity] ?? severityConfig.moderate;
                    const Icon = sev.icon;
                    const expanded = expandedItems.has(a.item);
                    return (
                      <div
                        key={a.item}
                        className={cn(
                          "rounded-lg border bg-card",
                          sev.border,
                        )}
                      >
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => toggleItem(a.item)}
                          className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            {expanded ? (
                              <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <Icon aria-hidden="true" className={cn("h-4 w-4 shrink-0", sev.color)} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-xs font-semibold text-foreground">
                                  {a.item}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "h-5 shrink-0 px-1.5 text-[11px] font-bold",
                                    sev.bg,
                                    sev.border,
                                    sev.color,
                                  )}
                                >
                                  {sev.label}
                                </Badge>
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {a.severityReason}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs tabular-nums">
                            <div className="text-right">
                              <div className="text-[11px] text-muted-foreground">Bulan Lalu</div>
                              <div className="font-bold text-foreground">
                                {formatNumber(a.prevQty)} cup
                              </div>
                            </div>
                            <span aria-hidden="true" className="text-muted-foreground">ke</span>
                            <div className="text-right">
                              <div className="text-[11px] text-muted-foreground">Periode Ini</div>
                              <div className="font-bold text-foreground">
                                {formatNumber(a.currQty)} cup
                              </div>
                            </div>
                            <div
                              className={cn(
                                "rounded px-2 py-0.5 text-xs font-bold",
                                (a.deltaPct ?? 0) < 0
                                  ? "bg-destructive/15 text-red-700 dark:text-red-300"
                                  : "bg-emerald-700/15 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
                              )}
                            >
                              {a.deltaPct !== null ? formatPct(a.deltaPct) : "-"}
                            </div>
                            <div className="text-right">
                              <div className="text-[11px] text-muted-foreground">Loss</div>
                              <div className="font-bold text-red-700 dark:text-red-400">
                                {formatRupiah(a.revenueLoss)}
                              </div>
                            </div>
                          </div>
                        </button>
                        {expanded && (
                          <div className="border-t border-border px-3 py-2.5">
                            {/* Zero anomaly days highlight */}
                            {a.zeroAnomalyDays.length > 0 && (
                              <div className="mb-2 rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-1.5 text-xs text-red-800 dark:text-red-300">
                                <AlertCircle aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />
                                <span className="font-bold">{a.zeroAnomalyDays.length} hari</span> dengan qty=0 padahal hari yang sama bulan lalu rata-rata minimal 5 cup:
                                <span className="ml-1 font-mono">
                                  {a.zeroAnomalyDays.map((d) => `${formatDateShort(d)} (${a.dailyBreakdown.find((db) => db.date === d)?.dayOfWeek})`).join(", ")}
                                </span>
                              </div>
                            )}
                            {/* Daily breakdown table */}
                            <div className="overflow-x-auto rounded border border-border">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/50">
                                  <tr className="text-muted-foreground">
                                    <th className="px-2 py-1.5 text-left font-medium">Tanggal</th>
                                    <th className="px-2 py-1.5 text-left font-medium">Hari</th>
                                    <th className="px-2 py-1.5 text-right font-medium">Qty Ini</th>
                                    <th className="px-2 py-1.5 text-right font-medium">Qty Lalu (avg DoW)</th>
                                    <th className="px-2 py-1.5 text-right font-medium">Revenue</th>
                                    <th className="px-2 py-1.5 text-center font-medium">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {a.dailyBreakdown.map((d) => (
                                    <tr
                                      key={d.date}
                                      className={cn(
                                        "border-t border-border",
                                        d.isZeroAnomaly && "bg-destructive/10",
                                      )}
                                    >
                                      <td className="px-2 py-1.5 font-mono">{d.date}</td>
                                      <td className="px-2 py-1.5">{d.dayOfWeek}</td>
                                      <td className="px-2 py-1.5 text-right font-bold tabular-nums">
                                        {formatNumber(d.qty)}
                                      </td>
                                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                        {d.prevSameDowAvg > 0 ? d.prevSameDowAvg.toFixed(0) : "-"}
                                      </td>
                                      <td className="px-2 py-1.5 text-right tabular-nums">
                                        {d.revenue > 0 ? formatRupiah(d.revenue) : "-"}
                                      </td>
                                      <td className="px-2 py-1.5 text-center font-medium">
                                        {d.isZeroAnomaly ? (
                                          <span className="font-bold text-red-700 dark:text-red-400">KOSONG (ZERO)</span>
                                        ) : d.qty === 0 ? (
                                          <span className="text-muted-foreground">0</span>
                                        ) : d.qty < d.prevSameDowAvg * 0.5 ? (
                                          <span className="text-amber-700 dark:text-amber-300">Turun</span>
                                        ) : (
                                          <span className="text-emerald-700 dark:text-emerald-300">Normal</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span>
                                Hari jual periode ini: <span className="font-bold text-foreground">{a.currDaysWithSales}/{a.currPeriodDays}</span>
                              </span>
                              <span>
                                Bulan lalu: <span className="font-bold text-foreground">{a.prevDaysWithSales}/{a.prevPeriodDays}</span>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Lightbulb aria-hidden="true" className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                  Rekomendasi Operasional
                </h3>
                <ul className="space-y-1">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed text-foreground/90">
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
                <Calendar aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />
                Dibuat pada {new Date(result.generatedAt).toLocaleString("id-ID")}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
