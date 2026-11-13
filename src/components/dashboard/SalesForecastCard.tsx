"use client";

import { useState } from "react";
import {
  TrendingUp,
  Target,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { formatRupiah, formatNumber, formatPct } from "@/lib/format";
import type { SalesForecastResult } from "@/lib/dashboard/forecast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SalesForecastCardProps {
  forecast: SalesForecastResult;
  className?: string;
}

export function SalesForecastCard({ forecast, className }: SalesForecastCardProps) {
  const [showDailyList, setShowDailyList] = useState(false);

  if (forecast.isCompleteMonth) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border bg-card p-4 transition-colors",
          className,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                Realisasi Penuh Bulan {forecast.monthName}
              </div>
              <div className="text-xl font-bold tabular-nums text-foreground">
                {formatRupiah(forecast.actualRevenue)}
              </div>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            100% Selesai ({forecast.totalDaysInMonth} Hari)
          </Badge>
        </div>
      </div>
    );
  }

  const isGrowthPositive =
    forecast.growthVsPrevMonthPct !== null && forecast.growthVsPrevMonthPct > 0;
  const isGrowthNegative =
    forecast.growthVsPrevMonthPct !== null && forecast.growthVsPrevMonthPct < 0;

  return (
    <div
      className={cn(
        "rounded-xl border border-primary/35 bg-gradient-to-br from-card via-card to-primary/[0.03] p-4 sm:p-5 shadow-xs transition-colors",
        className,
      )}
    >
      {/* Top row: Title + Meta Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">
                Forecast Sales Akhir Bulan ({forecast.monthName})
              </h3>
              <Badge
                variant="secondary"
                className="gap-1 bg-primary/10 text-[11px] font-semibold text-primary"
              >
                <Sparkles className="h-3 w-3" />
                Proyeksi AI Run-Rate
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Estimasi berbasis data realisasi harian &amp; bobot pola hari (Day-of-Week seasonality)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-medium">
            <Clock className="mr-1 h-3 w-3 text-muted-foreground" />
            Hari ke-{forecast.elapsedDays} dari {forecast.totalDaysInMonth} (Sisa {forecast.remainingDays} hari)
          </Badge>
        </div>
      </div>

      {/* Main Stats Banner */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Projected Total Revenue */}
        <div className="rounded-lg border border-primary/40 bg-primary/[0.06] p-3.5">
          <div className="text-xs font-semibold text-primary">
            Estimasi Total Akhir Bulan
          </div>
          <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">
            {formatRupiah(forecast.projectedTotalRevenue)}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {forecast.growthVsPrevMonthPct !== null ? (
              <span
                className={cn(
                  "inline-flex items-center font-medium",
                  isGrowthPositive
                    ? "text-emerald-700 dark:text-emerald-300"
                    : isGrowthNegative
                      ? "text-red-700 dark:text-red-400"
                      : "text-muted-foreground",
                )}
              >
                {isGrowthPositive ? (
                  <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
                )}
                {formatPct(Math.abs(forecast.growthVsPrevMonthPct))} vs bulan lalu
              </span>
            ) : (
              <span>Target proyeksi bulan penuh</span>
            )}
          </div>
        </div>

        {/* Card 2: Actual M-T-D */}
        <div className="rounded-lg border border-border bg-card p-3.5">
          <div className="text-xs font-medium text-muted-foreground">
            Realisasi Saat Ini (M-T-D)
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {formatRupiah(forecast.actualRevenue)}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {forecast.currentPacing}%
            </span>{" "}
            tercapai ({formatNumber(forecast.actualTxn)} transaksi)
          </div>
        </div>

        {/* Card 3: Remaining Projected Revenue */}
        <div className="rounded-lg border border-border bg-card p-3.5">
          <div className="text-xs font-medium text-muted-foreground">
            Proyeksi Sisa {forecast.remainingDays} Hari
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {formatRupiah(forecast.remainingProjectedRevenue)}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            Rata-rata:{" "}
            <span className="font-semibold text-foreground">
              {formatRupiah(forecast.runRateRequired)}/hari
            </span>
          </div>
        </div>

        {/* Card 4: Confidence Range */}
        <div className="rounded-lg border border-border bg-card p-3.5">
          <div className="text-xs font-medium text-muted-foreground">
            Rentang Skenario Akhir Bulan
          </div>
          <div className="mt-2 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Konservatif (-10%):</span>
              <span className="font-mono font-medium text-foreground">
                {formatRupiah(forecast.conservative)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Optimis (+10%):</span>
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                {formatRupiah(forecast.optimistic)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress timeline bar */}
      <div className="mt-4 rounded-lg border border-border/70 bg-muted/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-foreground">
            Progres Waktu vs Progres Omzet
          </span>
          <span className="text-muted-foreground">
            Waktu terlewati:{" "}
            <strong className="text-foreground">{forecast.percentElapsed}%</strong> | Omzet
            tercapai:{" "}
            <strong className="text-foreground">{forecast.currentPacing}%</strong>
          </span>
        </div>
        <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, forecast.currentPacing)}%` }}
            title={`Realisasi: ${forecast.currentPacing}%`}
          />
        </div>
      </div>

      {/* Expand daily breakdown toggle */}
      <div className="mt-3 flex items-center justify-between pt-1">
        <div className="text-xs text-muted-foreground">
          Rata-rata harian saat ini:{" "}
          <span className="font-semibold text-foreground">
            {formatRupiah(forecast.overallDailyAvg)}/hari
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-primary hover:text-primary"
          onClick={() => setShowDailyList(!showDailyList)}
        >
          {showDailyList ? (
            <>
              Tutup Rincian Harian <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Lihat Proyeksi per Hari ({forecast.remainingDays} Hari){" "}
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </div>

      {/* Collapsible Daily Forecast Table */}
      {showDailyList && (
        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-border bg-muted/80 backdrop-blur-xs">
                <tr>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Tanggal</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Hari</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                    Estimasi Revenue
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {forecast.projectedDays.map((d) => (
                  <tr key={d.date} className="hover:bg-muted/40">
                    <td className="px-3 py-1.5 font-mono text-foreground">{d.date}</td>
                    <td className="px-3 py-1.5 text-foreground">{d.dayOfWeek}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-medium tabular-nums text-foreground">
                      {formatRupiah(d.revenue)}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] text-primary"
                      >
                        Forecast
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
