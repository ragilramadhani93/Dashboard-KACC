"use client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRupiah, formatNumber, formatPct } from "@/lib/format";

interface KpiCardProps {
  label: string;
  value: string;
  deltaPct?: number | null;
  hint?: string;
  featured?: boolean;
  icon?: React.ReactNode;
  alert?: boolean;
  alertMessage?: string;
  className?: string;
}

export function KpiCard({
  label,
  value,
  deltaPct = null,
  hint,
  featured = false,
  icon,
  alert,
  alertMessage,
  className,
}: KpiCardProps) {
  const hasDelta = deltaPct !== null && deltaPct !== undefined;
  const isPositive = hasDelta && deltaPct! > 0;
  const isNegative = hasDelta && deltaPct! < 0;
  const isFlat = hasDelta && deltaPct === 0;

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between rounded-xl border bg-card p-4 transition-colors",
        featured
          ? "border-primary/45 bg-primary/[0.04] dark:bg-primary/[0.06]"
          : "border-border",
        alert && "border-destructive/60 bg-destructive/[0.04]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            {label}
          </div>
          <div
            className={cn(
              "font-bold tracking-tight tabular-nums text-foreground",
              featured ? "text-2xl sm:text-[26px]" : "text-xl sm:text-2xl",
            )}
          >
            {value}
          </div>
          {hint && (
            <div className="text-xs text-muted-foreground">{hint}</div>
          )}
        </div>
        {icon && (
          <div
            aria-hidden="true"
            className={cn(
              "shrink-0 rounded-lg p-2",
              featured ? "bg-primary text-primary-foreground" : "bg-muted text-primary",
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Delta indicator (icon + sign + text, never color-only) */}
      {hasDelta && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          {isPositive && (
            <span className="inline-flex items-center gap-1 font-medium text-status-success">
              <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" />
              +{formatPct(deltaPct!)}
            </span>
          )}
          {isNegative && (
            <span className="inline-flex items-center gap-1 font-medium text-status-danger">
              <TrendingDown aria-hidden="true" className="h-3.5 w-3.5" />
              {formatPct(deltaPct!)}
            </span>
          )}
          {isFlat && (
            <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
              <Minus aria-hidden="true" className="h-3.5 w-3.5" />
              0%
            </span>
          )}
          <span className="text-muted-foreground">vs periode sebelumnya</span>
        </div>
      )}

      {/* Alert badge */}
      {alert && alertMessage && (
        <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-status-danger">
          {alertMessage}
        </div>
      )}
    </div>
  );
}

interface KpiGridProps {
  kpi: {
    revenue: number;
    transactions: number;
    items: number;
    outlets: number;
    aov: number;
    avgItemsPerTxn: number;
    peakHour: number;
    uniqueItemTypes: number;
  };
  prevKpi: {
    revenue: number;
    transactions: number;
    items: number;
    outlets: number;
    aov: number;
    avgItemsPerTxn: number;
    peakHour: number;
    uniqueItemTypes: number;
  } | null;
  hasPrev: boolean;
}

function delta(curr: number, prev: number | null): number | null {
  if (prev === null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

export function KpiGrid({ kpi, prevKpi, hasPrev }: KpiGridProps) {
  const prev = hasPrev ? prevKpi : null;
  const avgRevPerOutlet = kpi.outlets > 0 ? kpi.revenue / kpi.outlets : 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
      <KpiCard
        label="Total Revenue"
        value={formatRupiah(kpi.revenue)}
        deltaPct={delta(kpi.revenue, prev?.revenue ?? null)}
        featured
        icon={<TrendingUp className="h-4 w-4" />}
        className="sm:col-span-2 lg:col-span-4"
      />
      <KpiCard
        label="Total Transaksi"
        value={formatNumber(kpi.transactions)}
        deltaPct={delta(kpi.transactions, prev?.transactions ?? null)}
        className="lg:col-span-4"
      />
      <KpiCard
        label="Rata-rata Order (AOV)"
        value={formatRupiah(kpi.aov)}
        deltaPct={delta(kpi.aov, prev?.aov ?? null)}
        hint="Per transaksi"
        className="lg:col-span-4"
      />
      <KpiCard
        label="Item Terjual"
        value={formatNumber(kpi.items)}
        deltaPct={delta(kpi.items, prev?.items ?? null)}
        hint={`${kpi.avgItemsPerTxn.toFixed(2)} item/txn`}
        className="lg:col-span-4"
      />
      <KpiCard
        label="Outlet Aktif"
        value={formatNumber(kpi.outlets)}
        deltaPct={delta(kpi.outlets, prev?.outlets ?? null)}
        hint={`Avg ${formatRupiah(avgRevPerOutlet)}/outlet`}
        className="lg:col-span-4"
      />
      <KpiCard
        label="Jam Puncak"
        value={`${String(kpi.peakHour).padStart(2, "0")}:00`}
        hint={`${formatNumber(kpi.uniqueItemTypes)} item unik`}
        className="lg:col-span-4"
      />
    </div>
  );
}
