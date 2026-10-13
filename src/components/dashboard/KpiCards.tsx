"use client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRupiah, formatNumber, formatPct } from "@/lib/format";

interface KpiCardProps {
  label: string;
  value: string;
  deltaPct: number | null;
  hint?: string;
  accent?: "emerald" | "cyan" | "amber" | "pink" | "purple";
  icon?: React.ReactNode;
  alert?: boolean;
  alertMessage?: string;
}

const accentClasses: Record<string, { bar: string; text: string; glow: string }> = {
  emerald: {
    bar: "bg-emerald-400",
    text: "text-emerald-400",
    glow: "shadow-[0_0_24px_rgba(16,185,129,0.15)]",
  },
  cyan: {
    bar: "bg-cyan-400",
    text: "text-cyan-400",
    glow: "shadow-[0_0_24px_rgba(34,211,238,0.15)]",
  },
  amber: {
    bar: "bg-amber-400",
    text: "text-amber-400",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.15)]",
  },
  pink: {
    bar: "bg-pink-400",
    text: "text-pink-400",
    glow: "shadow-[0_0_24px_rgba(244,114,182,0.15)]",
  },
  purple: {
    bar: "bg-purple-400",
    text: "text-purple-400",
    glow: "shadow-[0_0_24px_rgba(192,132,252,0.15)]",
  },
};

export function KpiCard({
  label,
  value,
  deltaPct,
  hint,
  accent = "emerald",
  icon,
  alert,
  alertMessage,
}: KpiCardProps) {
  const a = accentClasses[accent] ?? accentClasses.emerald;
  const hasDelta = deltaPct !== null;
  const isPositive = hasDelta && deltaPct! > 0;
  const isNegative = hasDelta && deltaPct! < 0;
  const isFlat = hasDelta && deltaPct === 0;

  return (
    <div
      className={cn(
        "relative rounded-xl border border-white/10 bg-card p-4 transition-all",
        "hover:border-white/20 hover:bg-card/80",
        a.glow,
        alert && "glow-danger border-red-500/40",
      )}
    >
      <div className={cn("absolute top-0 left-4 right-4 h-0.5 rounded-b-full", a.bar)} />
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
            {value}
          </div>
          {hint && (
            <div className="text-[11px] text-muted-foreground">{hint}</div>
          )}
        </div>
        {icon && (
          <div className={cn("rounded-lg bg-white/5 p-2", a.text)}>
            {icon}
          </div>
        )}
      </div>

      {/* Delta indicator */}
      {hasDelta && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          {isPositive && (
            <>
              <TrendingUp className={cn("h-3.5 w-3.5", a.text)} />
              <span className={a.text}>+{formatPct(deltaPct!)}</span>
            </>
          )}
          {isNegative && (
            <>
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              <span className="text-red-400">{formatPct(deltaPct!)}</span>
            </>
          )}
          {isFlat && (
            <>
              <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">0%</span>
            </>
          )}
          <span className="text-muted-foreground">vs periode sebelumnya</span>
        </div>
      )}

      {/* Alert badge */}
      {alert && alertMessage && (
        <div className="mt-2 rounded-md bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-400">
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KpiCard
        label="Total Revenue"
        value={formatRupiah(kpi.revenue)}
        deltaPct={delta(kpi.revenue, prev?.revenue ?? null)}
        accent="emerald"
        icon={<TrendingUp className="h-4 w-4" />}
      />
      <KpiCard
        label="Total Transaksi"
        value={formatNumber(kpi.transactions)}
        deltaPct={delta(kpi.transactions, prev?.transactions ?? null)}
        accent="cyan"
      />
      <KpiCard
        label="AOV"
        value={formatRupiah(kpi.aov)}
        deltaPct={delta(kpi.aov, prev?.aov ?? null)}
        hint="Avg Order Value"
        accent="amber"
      />
      <KpiCard
        label="Item Terjual"
        value={formatNumber(kpi.items)}
        deltaPct={delta(kpi.items, prev?.items ?? null)}
        hint={`${kpi.avgItemsPerTxn.toFixed(2)} item/txn`}
        accent="pink"
      />
      <KpiCard
        label="Outlet Aktif"
        value={formatNumber(kpi.outlets)}
        deltaPct={delta(kpi.outlets, prev?.outlets ?? null)}
        hint={`Avg ${formatRupiah(avgRevPerOutlet)}/outlet`}
        accent="purple"
      />
      <KpiCard
        label="Jam Puncak"
        value={`${String(kpi.peakHour).padStart(2, "0")}:00`}
        hint={`${formatNumber(kpi.uniqueItemTypes)} item unik`}
        accent="cyan"
      />
    </div>
  );
}
