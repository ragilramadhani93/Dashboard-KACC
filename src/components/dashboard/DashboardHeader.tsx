"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Download, Loader2, CheckCircle2, AlertCircle, Coffee, Clock } from "lucide-react";
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

  // Auto-refresh every 5 minutes
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const lastUpdated = meta?.lastUpdated;
  const ageMs = lastUpdated ? Date.now() - new Date(lastUpdated).getTime() : null;
  const isFresh = ageMs !== null && ageMs < 5 * 60_000;
  const isStale = ageMs !== null && ageMs > 60 * 60_000;

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur-xl">
      <div className="bg-grid">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          {/* Logo + title */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/10 ring-1 ring-emerald-400/30">
              <Coffee className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight text-foreground">
                KACC Dashboard Monitoring
              </h1>
              <p className="text-[10px] text-muted-foreground">
                Kopi Aku Coffe Corner - Transaksi Outlet Real-time
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

            {/* Status indicator */}
            <div className="hidden md:flex items-center gap-2 rounded-lg border border-white/10 bg-card/60 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
                ) : error ? (
                  <AlertCircle className="h-3 w-3 text-red-400" />
                ) : isStale ? (
                  <AlertCircle className="h-3 w-3 text-amber-400" />
                ) : isFresh ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Clock className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="text-[10px] font-medium text-muted-foreground">
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
                <div className="border-l border-white/10 pl-2 text-[10px] text-muted-foreground">
                  Update:{" "}
                  <span className="font-mono">
                    {new Date(lastUpdated).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              )}
              {meta && (
                <div className="border-l border-white/10 pl-2 text-[10px] text-muted-foreground">
                  <span className="font-mono">{meta.rowCount.toLocaleString("id-ID")}</span> records
                </div>
              )}
            </div>

            {/* Refresh button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-white/10 bg-white/5 text-xs hover:bg-white/10"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {/* Export PDF */}
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-500/15 text-xs text-emerald-300 hover:bg-emerald-500/25"
              onClick={onExportPdf}
              disabled={exporting || loading || !meta}
            >
              {exporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="hidden sm:inline">Generating...</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Export PDF</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Warning / stale banner */}
        {warning && (
          <div className="flex items-center gap-2 border-t border-amber-500/20 bg-amber-500/5 px-4 py-1.5 text-[10px] text-amber-300">
            <AlertCircle className="h-3 w-3" />
            {warning}
          </div>
        )}

        {/* Current date banner */}
        {now && (
          <div className="border-t border-white/5 px-4 py-1 text-[10px] text-muted-foreground">
            {formatDateLong(now.toISOString().slice(0, 10))} -{" "}
            {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
            <span className="ml-2 hidden sm:inline">
              • Auto-refresh dari Google Sheets tiap 5 menit
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
