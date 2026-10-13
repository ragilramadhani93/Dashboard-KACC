"use client";
import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, Lightbulb, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
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
    <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-card to-cyan-500/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-purple-500/15 p-2">
            <Sparkles className="h-4 w-4 text-purple-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Insight Otomatis (AI)</h3>
            <p className="text-[10px] text-muted-foreground">
              Analisa naratif performa periode ini
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-purple-500/30 bg-purple-500/10 text-xs text-purple-200 hover:bg-purple-500/20"
          onClick={generateInsight}
          disabled={insightLoading}
        >
          {insightLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Menganalisa...
            </>
          ) : insightNarrative ? (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Insight
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Generate Insight
            </>
          )}
        </Button>
      </div>

      {/* Generated content */}
      {insightLoading && !insightNarrative && (
        <div className="space-y-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-full animate-pulse rounded bg-white/5" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {insightNarrative && !insightLoading && (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-foreground/90">
            {insightNarrative}
          </p>

          {insightHighlights.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3 text-amber-300" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                  Poin Penting
                </span>
              </div>
              <ul className="space-y-1">
                {insightHighlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex gap-1.5 text-xs text-foreground/80"
                  >
                    <span className="text-amber-300">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insightAlerts.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-red-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
                  Alert Operasional
                </span>
              </div>
              <ul className="space-y-1">
                {insightAlerts.map((a, i) => (
                  <li
                    key={i}
                    className="flex gap-1.5 rounded bg-red-500/5 px-2 py-1 text-xs text-red-300"
                  >
                    <span className="font-bold">!</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insightGeneratedAt && (
            <div className="border-t border-white/5 pt-2 text-[10px] text-muted-foreground">
              Generated at {formatDateLong(insightGeneratedAt.slice(0, 10))}{" "}
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
        <div className="py-4 text-center text-xs text-muted-foreground">
          Klik <span className="font-medium text-purple-300">Generate Insight</span> untuk
          mendapat analisa otomatis dari AI
        </div>
      )}
    </div>
  );
}
