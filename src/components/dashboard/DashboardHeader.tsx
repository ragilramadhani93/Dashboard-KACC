"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Download, Loader2, CheckCircle2, AlertCircle, Coffee, Clock, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatDateLong } from "@/lib/dashboard/aggregate";
import type { DashboardMeta } from "@/lib/types";
import { SheetSelector } from "@/components/dashboard/SheetSelector";
import type { SheetSourceDTO } from "@/lib/sheet-sources";

interface DashboardHeaderProps {
  meta: DashboardMeta | null;
  loading: boolean;
  refreshing: boolean;
  warning: string | null;
  error: string | null;
  onRefresh: () => void;
  onExportPdf: () => void;
  exporting: boolean;
  // Sheet sources props
  sources: SheetSourceDTO[];
  activeSheetId: string | null;
  sourcesLoading: boolean;
  onActivateSheet: (id: string) => Promise<void>;
  onOpenSheetManager: () => void;
}

export function DashboardHeader({
  meta,
  loading,
  refreshing,
  warning,
  error,
  onRefresh,
  onExportPdf,
  exporting,
  sources,
  activeSheetId,
  sourcesLoading,
  onActivateSheet,
  onOpenSheetManager,
}: DashboardHeaderProps) {
  const [now, setNow] = useState<Date | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);

  // Auto-refresh clock & sync initial theme state
  useEffect(() => {
    setNow(new Date());
    setIsDark(document.documentElement.classList.contains("dark"));
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    try {
      localStorage.setItem("kacc-theme", nextDark ? "dark" : "light");
    } catch {
      // Ignore storage write failure in restricted contexts
    }
  };

  const lastUpdated = meta?.lastUpdated;
  const ageMs = lastUpdated ? Date.now() - new Date(lastUpdated).getTime() : null;
  const isFresh = ageMs !== null && ageMs < 5 * 60_000;
  const isStale = ageMs !== null && ageMs > 60 * 60_000;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          >
            <Coffee className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-foreground">
              KACC Dashboard Monitoring
            </h1>
            <p className="text-xs text-muted-foreground">
              Kopi Aku Coffee Corner - Transaksi Outlet Real-time
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Sheet selector */}
          <SheetSelector
            sources={sources}
            activeId={activeSheetId}
            loading={sourcesLoading}
            onActivate={onActivateSheet}
            onOpenManager={onOpenSheetManager}
          />

          {/* Status indicator (compact on mobile, expanded on md+) */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 md:px-3">
            <div className="flex items-center gap-1.5">
              {loading ? (
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : error ? (
                <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 text-status-danger" />
              ) : isStale ? (
                <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 text-status-warning" />
              ) : isFresh ? (
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-status-success" />
              ) : (
                <Clock aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-foreground">
                {loading
                  ? "Memuat..."
                  : error
                    ? "Error"
                    : isStale
                      ? "Stale"
                      : isFresh
                        ? "Fresh"
                        : "Cached"}
              </span>
            </div>
            {lastUpdated && (
              <div className="hidden border-l border-border pl-2 text-xs text-muted-foreground md:block">
                Update:{" "}
                <span className="font-mono text-foreground">
                  {new Date(lastUpdated).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
            )}
            {meta && (
              <div className="hidden border-l border-border pl-2 text-xs text-muted-foreground lg:block">
                <span className="font-mono text-foreground">{meta.rowCount.toLocaleString("id-ID")}</span>{" "}
                records
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 min-w-10 px-2.5"
            onClick={toggleTheme}
            aria-label={isDark ? "Ubah ke tema terang" : "Ubah ke tema gelap"}
            aria-pressed={isDark}
            title={isDark ? "Tema terang" : "Tema gelap"}
          >
            {isDark ? (
              <Sun aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Moon aria-hidden="true" className="h-4 w-4" />
            )}
          </Button>

          {/* Refresh button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 gap-1.5 text-xs"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Muat ulang data dashboard"
          >
            <RefreshCw aria-hidden="true" className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Export PDF */}
          <Button
            type="button"
            size="sm"
            className="min-h-10 gap-1.5 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={onExportPdf}
            disabled={exporting || loading || !meta}
          >
            {exporting ? (
              <>
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Membuat PDF...</span>
              </>
            ) : (
              <>
                <Download aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export PDF</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Warning / stale banner */}
      {warning && (
        <div
          role="status"
          className="border-t border-status-warning/25 bg-status-warning/10"
        >
          <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2 px-4 py-2 text-xs text-status-warning lg:px-6">
            <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span>{warning}</span>
          </div>
        </div>
      )}

      {/* Current date banner */}
      {now && (
        <div className="border-t border-border bg-muted/40">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-1.5 text-xs text-muted-foreground lg:px-6">
            {formatDateLong(now.toISOString().slice(0, 10))} -{" "}
            {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
            <span className="ml-2 hidden sm:inline">
              | Auto-refresh dari Google Sheets tiap 5 menit
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
