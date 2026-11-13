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
  Cookie,
  BarChart3,
  Table2,
  AlertCircle,
  X,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { SnackAnalysisDialog } from "@/components/dashboard/SnackAnalysisDialog";
import { SalesForecastCard } from "@/components/dashboard/SalesForecastCard";
import { calculateSalesForecast } from "@/lib/dashboard/forecast";
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
import { formatNumber, formatPct, formatRupiah } from "@/lib/format";

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

  // Snack analysis dialog state
  const [snackOpen, setSnackOpen] = useState(false);

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
        // Include debug hint if available
        const debugHint = errBody?.debug?.hint ? `\n\nPetunjuk: ${errBody.debug.hint}` : "";
        throw new Error(`${errMsg}${errLabel}${debugHint}`);
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

  // ----- Loading skeleton (layout-matched to prevent CLS) -----
  if (loading && !data) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        role="status"
        aria-live="polite"
        aria-label="Memuat data dashboard dari Google Sheets"
        className="min-h-screen bg-background text-foreground"
      >
        <div className="border-b border-border bg-card">
          <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64 hidden sm:block" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-32 rounded-md" />
              <Skeleton className="h-9 w-9 rounded-md" />
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[1440px] flex-col space-y-4 p-4 lg:p-6">
          <Skeleton className="h-14 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className={`h-28 rounded-xl lg:col-span-4 ${i === 0 ? "sm:col-span-2" : ""}`}
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Skeleton className="h-[390px] rounded-xl lg:col-span-2" />
            <Skeleton className="h-[390px] rounded-xl" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
          <span className="sr-only">Memuat data dari Google Sheets...</span>
        </div>
      </main>
    );
  }

  // ----- Error state -----
  if (error && !data) {
    const activeSheet = sources.find((s) => s.isActive);
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-foreground"
      >
        <div role="alert" className="max-w-lg rounded-xl border border-destructive/40 bg-card p-6 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-400" />
            <div className="flex-1">
              <h1 className="mb-1 text-sm font-semibold text-red-700 dark:text-red-400">
                Gagal memuat data
              </h1>
              <p className="mb-3 whitespace-pre-line text-xs text-muted-foreground">{error}</p>
              {activeSheet && (
                <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-xs text-red-800 dark:text-red-200">
                  Sheet aktif: <strong>{activeSheet.label}</strong>
                  <br />
                  Pastikan sheet ini:
                  <ul className="ml-4 mt-1 list-disc space-y-0.5">
                    <li>Sudah di-share ke &quot;Anyone with link can view&quot;</li>
                    <li>Memiliki header kolom yang sama dengan sheet Okt</li>
                    <li>Tidak kosong (memiliki baris data)</li>
                    <li>URL benar (periksa sheetId &amp; gid)</li>
                  </ul>
                </div>
              )}
              <div className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Untuk diagnosa lengkap, buka endpoint{" "}
                <a
                  href="/api/health"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-medium text-primary underline"
                >
                  /api/health
                </a>{" "}
                di tab baru (cek koneksi DB, status sheet aktif, dan akses Google Sheets).
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            size="sm"
            className="min-h-10 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={() => fetchData(true)}
          >
            Coba Lagi
          </Button>
          <a
            href="/api/health"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            Diagnose via /api/health
          </a>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 text-xs"
            onClick={() => setManagerOpen(true)}
          >
            Buka Kelola Sheet
          </Button>
        </div>
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
      </main>
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

  const snackItems = itemAgg.filter((i) =>
    i.category === "Snack" || i.category === "Pastry" || i.category === "RTD",
  );
  const snackRevenue = snackItems.reduce((sum, i) => sum + i.revenue, 0);
  const snackQty = snackItems.reduce((sum, i) => sum + i.qty, 0);
  const snackSharePct = kpi.revenue > 0 ? (snackRevenue / kpi.revenue) * 100 : 0;
  const topSnackItem = snackItems[0] ?? null;

  // Sales Forecast to End-of-Month
  const prevMonthRevenueForForecast =
    crossSheetCompareEnabled && crossSheetAvailable && crossSheetKpi.kpi
      ? crossSheetKpi.kpi.revenue
      : prevKpi?.revenue ?? null;

  const salesForecast = useMemo(() => {
    return calculateSalesForecast(dailyTrend, prevMonthRevenueForForecast);
  }, [dailyTrend, prevMonthRevenueForForecast]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen flex-col bg-background text-foreground outline-none"
    >
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
        <div role="alert" className="border-b border-destructive/35 bg-destructive/10">
          <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-start gap-3 px-4 py-3 lg:px-6">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-status-danger" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-status-danger">
                Gagal fetch data sheet aktif. Menampilkan data terakhir yang tersimpan.
              </div>
              <div className="mt-0.5 text-xs text-status-danger/90">
                {error}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Klik Refresh atau periksa sheet aktif lewat{" "}
                <button
                  type="button"
                  onClick={() => setManagerOpen(true)}
                  className="font-medium text-primary underline"
                >
                  Kelola Sheet
                </button>
                . Pastikan Google Sheets berstatus publik (Anyone with link can view).
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-9 gap-1 border-destructive/35 text-xs text-status-danger hover:bg-destructive/10"
              onClick={() => setError(null)}
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
              Tutup
            </Button>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col space-y-4 p-4 lg:p-6">
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
          <div className="rounded-lg border border-primary/35 bg-primary/[0.06] px-3.5 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-primary">
                Mode Banding Bulan Lalu
              </span>
              {crossSheetLoading ? (
                <span className="text-muted-foreground">Memuat data bulan lalu...</span>
              ) : crossSheetAvailable ? (
                <span className="text-muted-foreground">
                  Membandingkan dengan <span className="font-medium text-foreground">{crossSheetPrevSourceLabel}</span> ({crossSheetPrevDateStart} s/d {crossSheetPrevDateEnd}) dengan filter yang sama.
                </span>
              ) : (
                <span className="font-medium text-status-danger">
                  {crossSheetUnavailableReason || "Data bulan lalu tidak tersedia"}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Outlet consistency banner */}
        {outletConsistency !== "off" && (
          <div className="rounded-lg border border-status-success/35 bg-status-success/[0.06] px-3.5 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="font-semibold text-status-success">
                Filter Outlet Konsisten Aktif
              </span>
              <span className="text-muted-foreground">
                Mode: <span className="font-medium text-foreground">
                  {outletConsistency === "strict" ? "100% hari aktif (strict)" : "minimal 80% hari aktif"}
                </span>
              </span>
              <span className="text-muted-foreground">
                ({consistentOutletCount} dari {totalOutletCount} outlet dihitung agar perbandingan tren apple-to-apple)
              </span>
            </div>
          </div>
        )}

        {/* KPI grid */}
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

        {/* Sales Forecast sampai Akhir Bulan */}
        {salesForecast && (
          <SalesForecastCard forecast={salesForecast} />
        )}

        {/* Revenue trend + Insight panel */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard
            title="Tren Revenue Harian"
            subtitle={
              crossSheetCompareEnabled && crossSheetAvailable
                ? `${formatDateLong(dateStart)} s/d ${formatDateLong(dateEnd)} (vs bulan lalu ${formatDateLong(crossSheetPrevDateStart)} s/d ${formatDateLong(crossSheetPrevDateEnd)})`
                : compareEnabled
                  ? `${formatDateLong(dateStart)} s/d ${formatDateLong(dateEnd)} (vs prev ${formatDateLong(prevDateStart)} s/d ${formatDateLong(prevDateEnd)})`
                  : `${formatDateLong(dateStart)} s/d ${formatDateLong(dateEnd)}`
            }
            icon={<TrendingUp className="h-4 w-4" />}
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

        {/* Operational Deep-Dive Modules */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SectionCard
            title="Analisa Indikasi Stock-Out"
            subtitle="Bandingkan qty menu vs bulan lalu untuk deteksi kehabisan stok dan estimasi loss"
            icon={<PackageX className="h-4 w-4" />}
            action={
              <Button
                type="button"
                size="sm"
                className="min-h-10 gap-1.5 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                onClick={() => setStockoutOpen(true)}
                disabled={!activeSheetId || !dateStart || !dateEnd}
              >
                <PackageX aria-hidden="true" className="h-3.5 w-3.5" />
                Buka Analisa
              </Button>
            }
          >
            <div className="space-y-2.5">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Menandai menu dengan penurunan tajam atau qty 0 pada hari tertentu dibanding periode yang sama di sheet bulan lalu, lengkap dengan prioritas restock.
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Badge variant="outline" className="font-normal">
                  <span className="font-mono font-semibold text-foreground">{formatNumber(kpi.outlets)}</span>
                  <span className="ml-1 text-muted-foreground">outlet dipantau</span>
                </Badge>
                <Badge variant="outline" className="font-normal">
                  <span className="font-mono font-semibold text-foreground">{formatNumber(kpi.uniqueItemTypes)}</span>
                  <span className="ml-1 text-muted-foreground">SKU aktif</span>
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    sources.length >= 2
                      ? "border-status-success/35 bg-status-success/10 text-status-success"
                      : "border-status-warning/35 bg-status-warning/10 text-status-warning"
                  }
                >
                  {sources.length >= 2 ? "Pembanding bulan lalu siap" : "Tambah sheet bulan lalu di Kelola Sheet"}
                </Badge>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Analisa Snack, Pastry &amp; RTD"
            subtitle="Evaluasi item makanan pendamping, kontribusi kategori, dan peluang cross-sell"
            icon={<Cookie className="h-4 w-4" />}
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10 gap-1.5 text-xs"
                onClick={() => setSnackOpen(true)}
                disabled={!activeSheetId || !dateStart || !dateEnd}
              >
                <Cookie aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                Buka Analisa
              </Button>
            }
          >
            <div className="space-y-2.5">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Mengelompokkan kategori Snack, Pastry, dan RTD untuk memantau best-seller, produk yang menurun, serta rekomendasi bundling menu.
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Badge variant="outline" className="font-normal">
                  <span className="font-mono font-semibold text-foreground">{formatRupiah(snackRevenue)}</span>
                  <span className="ml-1 text-muted-foreground">({formatPct(snackSharePct)} omzet)</span>
                </Badge>
                <Badge variant="outline" className="font-normal">
                  <span className="font-mono font-semibold text-foreground">{formatNumber(snackQty)}</span>
                  <span className="ml-1 text-muted-foreground">qty terjual</span>
                </Badge>
                {topSnackItem && (
                  <Badge variant="secondary" className="max-w-full truncate font-normal">
                    Top: <span className="ml-1 font-medium text-foreground">{topSnackItem.item}</span>
                  </Badge>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Top outlets + Payment mix */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard
            title="Top 10 Outlet"
            subtitle="Berdasarkan revenue"
            icon={<Store className="h-4 w-4" />}
            className="lg:col-span-2"
          >
            <TopOutletsChart data={outletAgg} />
          </SectionCard>

          <SectionCard
            title="Mix Pembayaran"
            subtitle="Share revenue per metode"
            icon={<CreditCard className="h-4 w-4" />}
          >
            <PaymentMixChart data={paymentAgg} />
          </SectionCard>
        </div>

        {/* Hourly + Top items */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard
            title="Distribusi Jam Operasional"
            subtitle={`Jam puncak: ${String(kpi.peakHour).padStart(2, "0")}:00 WIB - pilih jam untuk detail menu`}
            icon={<Clock className="h-4 w-4" />}
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
            icon={<Coffee className="h-4 w-4" />}
          >
            <TopItemsChart data={itemAgg} />
          </SectionCard>
        </div>

        {/* Heatmap */}
        <SectionCard
          title="Heatmap Outlet x Tanggal"
          subtitle="Intensitas revenue per outlet per hari (total bertanda merah berada di bawah 50% rata-rata)"
          icon={<BarChart3 className="h-4 w-4" />}
        >
          <OutletHeatmap data={heatmap} dateList={dateList} />
        </SectionCard>

        {/* Outlet ranking + Item ranking */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard
            title="Ranking Outlet"
            subtitle="Klik header kolom untuk mengurutkan"
            icon={<Table2 className="h-4 w-4" />}
          >
            <OutletRankingTable data={outletAgg} />
          </SectionCard>

          <SectionCard
            title="Ranking Item Menu"
            subtitle="Urutkan berdasarkan qty, revenue, atau transaksi"
            icon={<Package className="h-4 w-4" />}
          >
            <ItemRankingTable data={itemAgg} />
          </SectionCard>
        </div>

        {/* Footer */}
        <footer className="mt-auto border-t border-border py-5 text-center text-xs text-muted-foreground">
          <div>
            Kapal Api Coffee Corner Sales Monitoring Dashboard - Auto-refresh tiap 5 menit dari Google Sheets
          </div>
          <div className="mt-1">
            Sumber:{" "}
            <a
              href={data.meta.source}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Google Sheets
            </a>{" "}
            | Pembaruan terakhir: {data.meta.lastUpdated ? new Date(data.meta.lastUpdated).toLocaleString("id-ID") : "-"}
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

      {/* Snack analysis dialog - AI analisa penjualan makanan */}
      <SnackAnalysisDialog
        open={snackOpen}
        onOpenChange={setSnackOpen}
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
