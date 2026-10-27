"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TrendingUp,
  Store,
  CreditCard,
  Clock,
  Coffee,
  Package,
  PackageX,
  BarChart3,
  Table2,
  CalendarDays,
  Sparkles,
  AlertCircle,
  X,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { Button } from "@/components/ui/button";
import { KpiGrid } from "@/components/dashboard/KpiCards";
import { SectionCard } from "@/components/dashboard/SectionCard";
import {
  RevenueTrendChart,
  TopOutletsChart,
  PaymentMixChart,
  HourlyChart,
  TopItemsChart,
} from "@/components/dashboard/Charts";
import { OutletHeatmap } from "@/components/dashboard/Heatmap";
import { OutletRankingTable } from "@/components/dashboard/OutletRankingTable";
import { ItemRankingTable } from "@/components/dashboard/ItemRankingTable";
import { InsightPanel } from "@/components/dashboard/InsightPanel";
import { SheetManagerModal } from "@/components/dashboard/SheetManagerModal";
import { HourlyDrilldownDialog } from "@/components/dashboard/HourlyDrilldownDialog";
import { StockoutAnalysisDialog } from "@/components/dashboard/StockoutAnalysisDialog";
import { useDashboardStore, computePresetRange } from "@/lib/dashboard/store";
import {
  applyFilter,
  buildDateList,
  computeHeatmap,
  computeDailyTrend,
  computeHourAgg,
  computeItemAgg,
  computeKpi,
  computeOutletAgg,
  computePaymentAgg,
  formatDateLong,
  findConsistentOutlets,
  findConsistentOutletsByPct,
  filterToConsistentOutlets,
} from "@/lib/dashboard/aggregate";
import type { DashboardData, HeatmapCell } from "@/lib/types";
import type { SheetSourceDTO } from "@/lib/sheet-sources";

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Sheet sources state
  const [sources, setSources] = useState<SheetSourceDTO[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);

  // Hourly drill-down state
  const [drilldownHour, setDrilldownHour] = useState<number | null>(null);

  // Stockout analysis dialog state
  const [stockoutOpen, setStockoutOpen] = useState(false);

  // Apply initial preset based on actual data range
  const dataRange = data?.meta.dateRange ?? { start: "", end: "" };
  const activeSheetId = data?.meta.sheetSourceId ?? null;

  // ----- Sheet sources fetching -----
  const fetchSources = useCallback(async () => {
    setSourcesLoading(true);
    try {
      const res = await fetch("/api/sheet-sources", { cache: "no-store" });
      const data = await res.json();
      setSources(data.sources || []);
    } catch {
      // Silent - sources are best-effort
    } finally {
      setSourcesLoading(false);
    }
  }, []);

  // ----- Data fetching -----
  const fetchData = useCallback(async (forceRefresh = false) => {
    setRefreshing(true);
    setError(null);
    setWarning(null);
    try {
      const url = forceRefresh ? "/api/sheets?refresh=1" : "/api/sheets";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const errMsg = errBody?.error || `HTTP ${res.status}`;
        const errLabel = errBody?.sheetLabel ? ` (sheet: ${errBody.sheetLabel})` : "";
        throw new Error(`${errMsg}${errLabel}`);
      }
      const json: DashboardData & { warning?: string } = await res.json();
      if (json.warning) setWarning(json.warning);
      setData(json);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load + auto-refresh every 5 minutes
  useEffect(() => {
    fetchSources();
    fetchData(false);
    const t = setInterval(() => fetchData(false), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchData, fetchSources]);

  // ----- Initialize preset when data first arrives -----
  const store = useDashboardStore();
  const { dateStart, dateEnd, compareEnabled, prevDateStart, prevDateEnd } = store;
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (data && dataRange.start && dataRange.end && !initialized) {
      // Use the actual data end as "today" reference (since sheet may lag a day)
      store.setPreset("last7", dataRange);
      setInitialized(true);
    }
  }, [data, dataRange, initialized, store]);

  // ----- Activate a different sheet (called from SheetSelector) -----
  const handleActivateSheet = useCallback(async (id: string) => {
    const DEFAULT_PIN = "kacc2026";
    try {
      const res = await fetch(
        `/api/sheet-sources/activate?id=${encodeURIComponent(id)}`,
        {
          method: "POST",
          headers: { "X-Admin-PIN": DEFAULT_PIN },
        },
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || `HTTP ${res.status}`);
      }
      // Reset the preset initialization so it re-runs for new sheet's date range
      setInitialized(false);
      // Reset insight (different sheet = different narrative)
      store.setInsight({
        narrative: "",
        highlights: [],
        alerts: [],
        generatedAt: "",
      });
      // Refetch sheet data with force refresh to load new sheet's records
      await Promise.all([fetchSources(), fetchData(true)]);
      // Reset cross-sheet compare - need to refetch prev month for new active sheet
      store.resetCrossSheet();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(`Gagal ganti sheet: ${msg}`);
    }
  }, [fetchSources, fetchData, store]);

  // ----- Cross-sheet compare state (vs sheet bulan lalu, same day-of-month) -----
  const {
    crossSheetCompareEnabled,
    crossSheetLoading,
    crossSheetAvailable,
    crossSheetPrevSourceId,
    crossSheetPrevSourceLabel,
    crossSheetPrevDateStart,
    crossSheetPrevDateEnd,
    crossSheetUnavailableReason,
  } = store;
  const [crossSheetKpi, setCrossSheetKpi] = useState<{
    kpi: import("@/lib/types").KpiSummary | null;
    dailyTrend: import("@/lib/types").TrendPoint[] | null;
  }>({ kpi: null, dailyTrend: null });

  // Toggle cross-sheet compare - fetch prev month data on enable
  const handleToggleCrossSheetCompare = useCallback(async () => {
    if (!data?.meta.sheetSourceId || !dateStart || !dateEnd) return;

    // If turning OFF
    if (crossSheetCompareEnabled) {
      store.setCrossSheetCompareEnabled(false);
      setCrossSheetKpi({ kpi: null, dailyTrend: null });
      return;
    }

    // Turning ON - fetch prev month compare
    store.setCrossSheetCompareEnabled(true);
    // useEffect will trigger the fetch automatically when crossSheetCompareEnabled flips
  }, [data, dateStart, dateEnd, crossSheetCompareEnabled, store]);

  // Re-fetch cross-sheet compare when filters or date range change (if enabled)
  // Use individual primitive deps to avoid infinite loop with store object reference
  const selOutlets = store.outlets;
  const selPayments = store.payments;
  const selItemCategories = store.itemCategories;
  const selMenuTypes = store.menuTypes;
  const activeSheetSourceId = data?.meta.sheetSourceId ?? null;
  // Refs to store actions to keep them stable across renders
  const setCrossSheetLoadingRef = useRef(store.setCrossSheetLoading);
  const setCrossSheetResultRef = useRef(store.setCrossSheetResult);
  setCrossSheetLoadingRef.current = store.setCrossSheetLoading;
  setCrossSheetResultRef.current = store.setCrossSheetResult;

  useEffect(() => {
    if (!crossSheetCompareEnabled) return;
    if (!activeSheetSourceId || !dateStart || !dateEnd) return;
    let cancelled = false;
    (async () => {
      setCrossSheetLoadingRef.current(true);
      try {
        const res = await fetch("/api/sheets/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activeSourceId: activeSheetSourceId,
            currentDateRange: { start: dateStart, end: dateEnd },
            filters: {
              outlets: selOutlets,
              payments: selPayments,
              itemCategories: selItemCategories,
              menuTypes: selMenuTypes,
            },
          }),
        });
        if (!res.ok) {
          setCrossSheetLoadingRef.current(false);
          return;
        }
        const body = await res.json();
        if (cancelled) return;
        if (body.available) {
          setCrossSheetResultRef.current({
            prevSourceId: body.prevSource?.id ?? null,
            prevSourceLabel: body.prevSource?.label ?? "",
            prevDateStart: body.prevDateRange.start,
            prevDateEnd: body.prevDateRange.end,
            available: true,
          });
          setCrossSheetKpi({ kpi: body.prevKpi, dailyTrend: body.prevDailyTrend });
        } else {
          setCrossSheetResultRef.current({
            prevSourceId: null,
            prevSourceLabel: "",
            prevDateStart: body.prevDateRange?.start ?? "",
            prevDateEnd: body.prevDateRange?.end ?? "",
            available: false,
            unavailableReason: body.unavailableReason,
          });
          setCrossSheetKpi({ kpi: null, dailyTrend: null });
        }
      } catch {
        if (!cancelled) setCrossSheetLoadingRef.current(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    crossSheetCompareEnabled,
    dateStart,
    dateEnd,
    activeSheetSourceId,
    selOutlets,
    selPayments,
    selItemCategories,
    selMenuTypes,
  ]);

  // ----- Filter state -----
  const filterState = useMemo(
    () => ({
      dateStart,
      dateEnd,
      outlets: store.outlets,
      payments: store.payments,
      itemCategories: store.itemCategories,
      menuTypes: store.menuTypes,
    }),
    [dateStart, dateEnd, store.outlets, store.payments, store.itemCategories, store.menuTypes],
  );

  // ----- Apply filters & aggregate -----
  const allRecords = data?.records ?? [];
  const baseFilteredRecords = useMemo(
    () => applyFilter(allRecords, filterState),
    [allRecords, filterState],
  );

  // ----- Outlet consistency filter -----
  // Banyak outlet KACC jadwalnya partial (weekend-only, hari kerja saja).
  // Saat compare periode ini vs bulan lalu, outlet yang baru buka/tutup bisa bias trend.
  // Toggle ini filter ke outlet yang konsisten aktif sepanjang periode.
  const outletConsistency = store.outletConsistency;
  const consistentOutletSet = useMemo(() => {
    if (outletConsistency === "off") return new Set<string>();
    if (outletConsistency === "strict") {
      return findConsistentOutlets(baseFilteredRecords, dateStart, dateEnd);
    }
    return findConsistentOutletsByPct(baseFilteredRecords, dateStart, dateEnd, 0.8);
  }, [outletConsistency, baseFilteredRecords, dateStart, dateEnd]);

  const filteredRecords = useMemo(() => {
    if (outletConsistency === "off") return baseFilteredRecords;
    return filterToConsistentOutlets(baseFilteredRecords, consistentOutletSet);
  }, [outletConsistency, baseFilteredRecords, consistentOutletSet]);

  // Compute consistent outlet count for display
  const consistentOutletCount = consistentOutletSet.size;
  const totalOutletCount = useMemo(
    () => new Set(baseFilteredRecords.map((r) => r.outlet)).size,
    [baseFilteredRecords],
  );

  const kpi = useMemo(() => computeKpi(filteredRecords), [filteredRecords]);
  const dailyTrend = useMemo(() => computeDailyTrend(filteredRecords), [filteredRecords]);
  const outletAgg = useMemo(() => computeOutletAgg(filteredRecords), [filteredRecords]);
  const itemAgg = useMemo(() => computeItemAgg(filteredRecords), [filteredRecords]);
  const paymentAgg = useMemo(() => computePaymentAgg(filteredRecords), [filteredRecords]);
  const hourAgg = useMemo(() => computeHourAgg(filteredRecords), [filteredRecords]);

  // Previous period for compare mode
  const prevFilterState = useMemo(() => {
    if (!compareEnabled || !prevDateStart || !prevDateEnd) return null;
    return {
      dateStart: prevDateStart,
      dateEnd: prevDateEnd,
      outlets: store.outlets,
      payments: store.payments,
      itemCategories: store.itemCategories,
      menuTypes: store.menuTypes,
    };
  }, [
    compareEnabled,
    prevDateStart,
    prevDateEnd,
    store.outlets,
    store.payments,
    store.itemCategories,
    store.menuTypes,
  ]);

  const prevRecords = useMemo(
    () => (prevFilterState ? applyFilter(allRecords, prevFilterState) : []),
    [allRecords, prevFilterState],
  );
  const prevKpi = useMemo(() => computeKpi(prevRecords), [prevRecords]);
  const prevDailyTrend = useMemo(
    () => (compareEnabled ? computeDailyTrend(prevRecords) : null),
    [compareEnabled, prevRecords],
  );

  // Heatmap data
  const topOutletNames = useMemo(
    () => outletAgg.slice(0, 15).map((o) => o.outlet),
    [outletAgg],
  );
  const dateList = useMemo(
    () => buildDateList(dateStart, dateEnd),
    [dateStart, dateEnd],
  );
  const heatmap: HeatmapCell[][] = useMemo(
    () => computeHeatmap(filteredRecords, topOutletNames, dateList),
    [filteredRecords, topOutletNames, dateList],
  );

  // ----- Export PDF handler -----
  const handleExportPdf = useCallback(async () => {
    if (!data) return;
    setExporting(true);
    try {
      const insight = {
        narrative: store.insightNarrative,
        highlights: store.insightHighlights,
        alerts: store.insightAlerts,
      };
      const payload = {
        meta: {
          ...data.meta,
          dateRange: data.meta.dateRange,
        },
        filters: {
          dateRange: { start: dateStart, end: dateEnd },
          outlets: store.outlets,
          payments: store.payments,
          itemCategories: store.itemCategories,
        },
        kpi,
        prevKpi: compareEnabled ? prevKpi : null,
        dailyTrend,
        topOutlets: outletAgg.slice(0, 10),
        topItems: itemAgg.slice(0, 10),
        paymentMix: paymentAgg,
        hourly: hourAgg,
        insight,
      };
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kacc-report-${dateStart}_to_${dateEnd}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(`PDF export failed: ${msg}`);
    } finally {
      setExporting(false);
    }
  }, [
    data,
    store.insightNarrative,
    store.insightHighlights,
    store.insightAlerts,
    store.outlets,
    store.payments,
    store.itemCategories,
    dateStart,
    dateEnd,
    kpi,
    prevKpi,
    compareEnabled,
    dailyTrend,
    outletAgg,
    itemAgg,
    paymentAgg,
    hourAgg,
  ]);

  // ----- Loading state -----
  if (loading && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
        <p className="text-sm text-muted-foreground">Memuat data dari Google Sheets...</p>
      </div>
    );
  }

  // ----- Error state -----
  if (error && !data) {
    // Find the active sheet (if any) to show context
    const activeSheet = sources.find((s) => s.isActive);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <div className="max-w-md rounded-lg border border-red-500/30 bg-red-500/5 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="mb-1 text-sm font-semibold text-red-400">
                Gagal memuat data
              </p>
              <p className="mb-3 text-xs text-muted-foreground">{error}</p>
              {activeSheet && (
                <div className="rounded-md bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                  Sheet aktif: <strong>{activeSheet.label}</strong>
                  <br />
                  Pastikan sheet ini:
                  <ul className="ml-4 mt-1 list-disc space-y-0.5">
                    <li>Sudah di-share ke &quot;Anyone with link can view&quot;</li>
                    <li>Punya header kolom yang sama dengan sheet Okt</li>
                    <li>Tidak kosong (ada baris data)</li>
                    <li>URL benar (cek sheetId &amp; gid)</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-lg bg-emerald-500/15 px-4 py-2 text-xs text-emerald-300 hover:bg-emerald-500/25"
            onClick={() => fetchData(true)}
          >
            Coba lagi
          </button>
          <button
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-foreground hover:bg-white/10"
            onClick={() => setManagerOpen(true)}
          >
            Buka Kelola Sheet
          </button>
        </div>
        {/* Sheet Manager Modal (also rendered here so user can switch back even in error state) */}
        <SheetManagerModal
          open={managerOpen}
          onOpenChange={setManagerOpen}
          sources={sources}
          activeId={activeSheetId}
          onChange={async () => {
            await fetchSources();
            await fetchData(true);
            setError(null);
          }}
        />
      </div>
    );
  }

  if (!data) return null;

  // Build filter state for insight panel
  const insightFilterState = {
    dateRange: { start: dateStart, end: dateEnd },
    outlets: store.outlets,
    payments: store.payments,
    itemCategories: store.itemCategories,
  };

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <DashboardHeader
        meta={data.meta}
        loading={loading}
        refreshing={refreshing}
        warning={warning}
        error={error}
        onRefresh={() => fetchData(true)}
        onExportPdf={handleExportPdf}
        exporting={exporting}
        sources={sources}
        activeSheetId={activeSheetId}
        sourcesLoading={sourcesLoading}
        onActivateSheet={handleActivateSheet}
        onOpenSheetManager={() => setManagerOpen(true)}
      />

      {/* Error banner (visible even when stale data is shown) */}
      {error && data && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-3 lg:px-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-red-300">
                Gagal fetch data sheet aktif. Menampilkan data lama (stale).
              </div>
              <div className="mt-0.5 text-[11px] text-red-400/80">
                {error}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                Coba klik tombol Refresh, atau periksa sheet aktif via{" "}
                <button
                  onClick={() => setManagerOpen(true)}
                  className="text-emerald-400 underline"
                >
                  Kelola Sheet
                </button>
                . Pastikan sheet Google Sheets-nya public (Anyone with link
                can view) dan header kolom sama dengan sheet Okt.
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-6 gap-1 border-red-500/30 bg-red-500/10 text-[10px] text-red-300 hover:bg-red-500/20"
              onClick={() => setError(null)}
            >
              <X className="h-3 w-3" />
              Tutup
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col space-y-4 p-4 lg:p-6">
        {/* Filter bar */}
        <FilterBar
          dataRange={dataRange}
          outlets={data.meta.outlets}
          paymentMethods={data.meta.paymentMethods}
          itemCategories={data.meta.itemCategories}
          onToggleCrossSheetCompare={handleToggleCrossSheetCompare}
        />

        {/* Cross-sheet compare banner */}
        {crossSheetCompareEnabled && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-amber-300">
                vs Bulan Lalu
              </span>
              {crossSheetLoading ? (
                <span className="text-muted-foreground">Memuat data bulan lalu...</span>
              ) : crossSheetAvailable ? (
                <>
                  <span className="text-muted-foreground">
                    Membandingkan dengan <span className="text-foreground">{crossSheetPrevSourceLabel}</span> ({crossSheetPrevDateStart} → {crossSheetPrevDateEnd})
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    • Filter outlet/payment/kategori menu juga diterapkan ke data bulan lalu
                  </span>
                </>
              ) : (
                <span className="text-red-400">
                  {crossSheetUnavailableReason || "Data bulan lalu tidak tersedia"}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Outlet consistency banner - explain why filtering */}
        {outletConsistency !== "off" && (
          <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-teal-300">
                Filter Outlet Konsisten Aktif
              </span>
              <span className="text-muted-foreground">
                Mode: <span className="text-foreground">
                  {outletConsistency === "strict" ? "100% hari aktif (strict)" : "≥ 80% hari aktif (permissive)"}
                </span>
              </span>
              <span className="text-muted-foreground">
                • Menampilkan <span className="font-bold text-foreground">{consistentOutletCount}</span> dari {totalOutletCount} outlet
              </span>
              <span className="text-[10px] text-muted-foreground">
                💡 Hanya outlet yang konsisten aktif sepanjang periode yang dihitung - supaya perbandingan tren harian apple-to-apple (tanpa bias dari outlet yang buka/tutup di tanggal tertentu)
              </span>
            </div>
          </div>
        )}

        {/* KPI grid - shows delta vs prev period (within-sheet OR cross-sheet) */}
        <KpiGrid
          kpi={kpi}
          prevKpi={
            crossSheetCompareEnabled && crossSheetAvailable
              ? crossSheetKpi.kpi
              : compareEnabled
                ? prevKpi
                : null
          }
          hasPrev={
            crossSheetCompareEnabled && crossSheetAvailable ? true : compareEnabled
          }
        />

        {/* Revenue trend + Insight panel */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard
            title="Tren Revenue Harian"
            subtitle={
              crossSheetCompareEnabled && crossSheetAvailable
                ? `${formatDateLong(dateStart)} → ${formatDateLong(dateEnd)} (vs bulan lalu ${formatDateLong(crossSheetPrevDateStart)} → ${formatDateLong(crossSheetPrevDateEnd)})`
                : compareEnabled
                  ? `${formatDateLong(dateStart)} → ${formatDateLong(dateEnd)} (vs prev ${formatDateLong(prevDateStart)} → ${formatDateLong(prevDateEnd)})`
                  : `${formatDateLong(dateStart)} → ${formatDateLong(dateEnd)}`
            }
            icon={<TrendingUp className="h-4 w-4 text-emerald-300" />}
            className="lg:col-span-2"
          >
            <RevenueTrendChart
              current={dailyTrend}
              previous={
                crossSheetCompareEnabled && crossSheetAvailable
                  ? crossSheetKpi.dailyTrend
                  : prevDailyTrend
              }
              compareEnabled={
                (crossSheetCompareEnabled && crossSheetAvailable) || compareEnabled
              }
            />
          </SectionCard>

          <InsightPanel
            meta={data.meta}
            kpi={kpi}
            prevKpi={
              crossSheetCompareEnabled && crossSheetAvailable
                ? crossSheetKpi.kpi
                : compareEnabled
                  ? prevKpi
                  : null
            }
            hasPrev={
              (crossSheetCompareEnabled && crossSheetAvailable) || compareEnabled
            }
            topOutlets={outletAgg.slice(0, 5)}
            topItems={itemAgg.slice(0, 5)}
            paymentMix={paymentAgg}
            dailyTrend={dailyTrend}
            peakHour={kpi.peakHour}
            filterState={insightFilterState}
          />
        </div>

        {/* Stock-out Analysis - deteksi item kehabisan stok dengan AI */}
        <SectionCard
          title="Analisa Indikasi Stock-Out"
          subtitle="AI deteksi menu yang kemungkinan kehabisan stok dengan compare vs tanggal yang sama bulan lalu"
          icon={<PackageX className="h-4 w-4 text-orange-300" />}
          action={
            <Button
              size="sm"
              className="gap-1.5 bg-orange-500/15 text-xs text-orange-300 hover:bg-orange-500/25"
              onClick={() => setStockoutOpen(true)}
              disabled={!activeSheetId || !dateStart || !dateEnd}
            >
              <PackageX className="h-3.5 w-3.5" />
              Analisa Stock-Out
            </Button>
          }
        >
          <div className="flex flex-col gap-2 py-2 text-xs text-muted-foreground">
            <p>
              Klik <span className="font-medium text-orange-300">Analisa Stock-Out</span> untuk
              menjalankan AI deteksi stock-out. Sistem akan:
            </p>
            <ul className="ml-4 list-disc space-y-0.5 text-[11px]">
              <li>Compare qty penjualan setiap menu di periode ini vs tanggal yang sama bulan lalu</li>
              <li>Identifikasi item dengan penurunan drastis atau qty = 0 di hari tertentu</li>
              <li>Hitung estimasi revenue loss dari stock-out</li>
              <li>Berikan prioritas restock + rekomendasi operasional</li>
            </ul>
            <p className="text-[10px]">
              💡 Tip: Untuk hasil terbaik, pastikan sheet bulan lalu sudah terdaftar
              (lihat tombol &quot;vs Bulan Lalu&quot;). Tanpa sheet bulan lalu, analisa tidak bisa jalan.
            </p>
          </div>
        </SectionCard>

        {/* Top outlets + Payment mix */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard
            title="Top 10 Outlet"
            subtitle="Berdasarkan revenue"
            icon={<Store className="h-4 w-4 text-cyan-300" />}
            className="lg:col-span-2"
          >
            <TopOutletsChart data={outletAgg} />
          </SectionCard>

          <SectionCard
            title="Mix Pembayaran"
            subtitle="Share revenue per metode"
            icon={<CreditCard className="h-4 w-4 text-amber-300" />}
          >
            <PaymentMixChart data={paymentAgg} />
          </SectionCard>
        </div>

        {/* Hourly + Top items */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard
            title="Distribusi Jam Operasional"
            subtitle={`Jam puncak: ${String(kpi.peakHour).padStart(2, "0")}:00 WIB - klik bar untuk lihat menu terjual di jam itu`}
            icon={<Clock className="h-4 w-4 text-purple-300" />}
            className="lg:col-span-2"
          >
            <HourlyChart
              data={hourAgg}
              peakHour={kpi.peakHour}
              onBarClick={(hour) => setDrilldownHour(hour)}
            />
          </SectionCard>

          <SectionCard
            title="Top 10 Item"
            subtitle="Berdasarkan qty terjual"
            icon={<Coffee className="h-4 w-4 text-pink-300" />}
          >
            <TopItemsChart data={itemAgg} />
          </SectionCard>
        </div>

        {/* Heatmap */}
        <SectionCard
          title="Heatmap Outlet x Tanggal"
          subtitle="Intensitas revenue per outlet per hari - merah di kolom Total = alert"
          icon={<BarChart3 className="h-4 w-4 text-emerald-300" />}
        >
          <OutletHeatmap data={heatmap} dateList={dateList} />
        </SectionCard>

        {/* Outlet ranking + Item ranking */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard
            title="Ranking Outlet"
            subtitle="Klik header kolom untuk sort"
            icon={<Table2 className="h-4 w-4 text-cyan-300" />}
          >
            <OutletRankingTable data={outletAgg} />
          </SectionCard>

          <SectionCard
            title="Ranking Item Menu"
            subtitle="Sortable by qty / revenue / transaksi"
            icon={<Package className="h-4 w-4 text-pink-300" />}
          >
            <ItemRankingTable data={itemAgg} />
          </SectionCard>
        </div>

        {/* Footer */}
        <footer className="mt-auto py-6 text-center text-[10px] text-muted-foreground">
          <div>
            KACC Dashboard Monitoring v1.0 - Data di-refresh otomatis tiap 5 menit dari Google Sheets
          </div>
          <div className="mt-1">
            Source:{" "}
            <a
              href={data.meta.source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              Google Sheets
            </a>{" "}
            • Last updated: {data.meta.lastUpdated ? new Date(data.meta.lastUpdated).toLocaleString("id-ID") : "-"}
          </div>
        </footer>
      </div>

      {/* Sheet Manager Modal (multi-month / add / delete) */}
      <SheetManagerModal
        open={managerOpen}
        onOpenChange={setManagerOpen}
        sources={sources}
        activeId={activeSheetId}
        onChange={async () => {
          await fetchSources();
          // If user activated a different sheet via the modal, refetch data too
          await fetchData(true);
          setInitialized(false);
        }}
      />

      {/* Hourly drill-down dialog - shows items/outlets/payments for clicked hour */}
      <HourlyDrilldownDialog
        open={drilldownHour !== null}
        onOpenChange={(open) => !open && setDrilldownHour(null)}
        hour={drilldownHour}
        records={filteredRecords}
        dateRange={{ start: dateStart, end: dateEnd }}
      />

      {/* Stock-out analysis dialog - AI detect items kehabisan stok */}
      <StockoutAnalysisDialog
        open={stockoutOpen}
        onOpenChange={setStockoutOpen}
        activeSourceId={activeSheetId}
        currentDateRange={{ start: dateStart, end: dateEnd }}
        filters={{
          outlets: store.outlets,
          payments: store.payments,
          itemCategories: store.itemCategories,
          menuTypes: store.menuTypes,
        }}
      />
    </main>
  );
}
