"use client";
import { useState } from "react";
import { FileText, Loader2, AlertTriangle, Lightbulb, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/lib/dashboard/store";
import type {
  DashboardMeta,
  KpiSummary,
  TrendPoint,
  OutletAgg,
  ItemAgg,
  PaymentAgg,
  InsightRequest,
  InsightResponse,
} from "@/lib/types";
import { formatDateLong } from "@/lib/dashboard/aggregate";

interface InsightPanelProps {
  meta: DashboardMeta;
  kpi: KpiSummary;
  prevKpi: KpiSummary | null;
  hasPrev: boolean;
  topOutlets: OutletAgg[];
  topItems: ItemAgg[];
  paymentMix: PaymentAgg[];
  dailyTrend: TrendPoint[];
  peakHour: number;
  filterState: {
    dateRange: { start: string; end: string };
    outlets: string[];
    payments: string[];
    itemCategories: string[];
  };
}

export function InsightPanel(props: InsightPanelProps) {
  const {
    insightLoading,
    insightNarrative,
    insightHighlights,
    insightAlerts,
    insightGeneratedAt,
    setInsight,
    setInsightLoading,
  } = useDashboardStore();
  const [error, setError] = useState<string | null>(null);

  async function generateInsight() {
    setInsightLoading(true);
    setError(null);
    try {
      const req: InsightRequest = {
        meta: props.meta,
        kpi: props.kpi,
        prevKpi: props.hasPrev ? props.prevKpi : null,
        topOutlets: props.topOutlets,
        topItems: props.topItems,
        paymentMix: props.paymentMix,
        dailyTrend: props.dailyTrend,
        peakHour: props.peakHour,
        filters: props.filterState,
      };
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data: InsightResponse = await res.json();
      setInsight(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(`Gagal: ${msg}`);
    } finally {
      setInsightLoading(false);
    }
  }

  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-primary/30 bg-card p-4 shadow-xs"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Ringkasan Insight Periode</h2>
            <p className="text-xs text-muted-foreground">
              Analisa naratif performa outlet dan menu
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant={insightNarrative ? "outline" : "default"}
          size="sm"
          className="min-h-10 gap-1.5 text-xs"
          onClick={generateInsight}
          disabled={insightLoading}
        >
          {insightLoading ? (
            <>
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              Menganalisa...
            </>
          ) : insightNarrative ? (
            <>
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
              Perbarui Insight
            </>
          ) : (
            <>
              <FileText aria-hidden="true" className="h-3.5 w-3.5" />
              Buat Ringkasan
            </>
          )}
        </Button>
      </div>

      {/* Generated content */}
      {insightLoading && !insightNarrative && (
        <div className="space-y-2" aria-label="Memuat ringkasan">
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {insightNarrative && !insightLoading && (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-foreground">
            {insightNarrative}
          </p>

          {insightHighlights.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <Lightbulb aria-hidden="true" className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Poin Penting
                </span>
              </div>
              <ul className="space-y-1">
                {insightHighlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-xs leading-relaxed text-foreground/90"
                  >
                    <span aria-hidden="true" className="font-bold text-primary">
                      -
                    </span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insightAlerts.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 text-red-700 dark:text-red-400" />
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                  Alert Operasional
                </span>
              </div>
              <ul className="space-y-1">
                {insightAlerts.map((a, i) => (
                  <li
                    key={i}
                    className="flex gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-1.5 text-xs text-red-800 dark:text-red-300"
                  >
                    <span aria-hidden="true" className="font-bold">!</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insightGeneratedAt && (
            <div className="border-t border-border pt-2 text-xs text-muted-foreground">
              Dibuat pada {formatDateLong(insightGeneratedAt.slice(0, 10))}{" "}
              {new Date(insightGeneratedAt).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              WIB
            </div>
          )}
        </div>
      )}

      {!insightNarrative && !insightLoading && !error && (
        <div className="py-3 text-center text-xs text-muted-foreground">
          Klik <span className="font-semibold text-primary">Buat Ringkasan</span> untuk
          membuat analisa otomatis berdasarkan filter periode saat ini.
        </div>
      )}
    </section>
  );
}
