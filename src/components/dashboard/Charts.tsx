"use client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  TrendPoint,
  OutletAgg,
  ItemAgg,
  PaymentAgg,
  HourAgg,
} from "@/lib/types";
import { formatRupiah, formatNumber, formatPct } from "@/lib/format";
import { formatDateShort } from "@/lib/dashboard/aggregate";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const CHART_COLORS = {
  emerald: "#10B981",
  cyan: "#06B6D4",
  amber: "#F59E0B",
  pink: "#EC4899",
  purple: "#A855F7",
  slate: "#475569",
  red: "#EF4444",
};

// ----- Daily Revenue Trend (with optional compare overlay) -----
interface TrendChartProps {
  current: TrendPoint[];
  previous?: TrendPoint[] | null;
  compareEnabled?: boolean;
  height?: number;
}

export function RevenueTrendChart({ current, previous, compareEnabled, height = 320 }: TrendChartProps) {
  // Merge current + previous by index (since dates differ in compare mode)
  const maxLen = Math.max(current.length, previous?.length ?? 0);
  const merged: Array<{
    label: string;
    currDate: string;
    prevDate: string | null;
    curr: number;
    prev: number | null;
  }> = [];
  for (let i = 0; i < maxLen; i++) {
    const c = current[i];
    const p = previous?.[i];
    merged.push({
      label: c ? formatDateShort(c.date) : p ? formatDateShort(p.date) : `${i + 1}`,
      currDate: c?.date ?? "",
      prevDate: p?.date ?? null,
      curr: c?.revenue ?? 0,
      prev: p?.revenue ?? null,
    });
  }

  return (
    <ChartContainer
      config={{
        curr: { label: "Periode Ini", color: CHART_COLORS.emerald },
        prev: { label: "Periode Sebelumnya", color: CHART_COLORS.amber },
      }}
      className="w-full"
      style={{ height }}
    >
      <AreaChart data={merged} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="colorCurr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.45} />
            <stop offset="100%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.amber} stopOpacity={0.3} />
            <stop offset="100%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
        />
        <YAxis
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v) => formatRupiah(v)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => {
                const labels: Record<string, string> = { curr: "Periode Ini", prev: "Periode Sebelumnya" };
                return (
                  <div className="flex w-full flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {labels[name as string] ?? name}
                    </span>
                    <span className="font-bold tabular-nums">{formatRupiah(Number(value), false)}</span>
                  </div>
                );
              }}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="curr"
          stroke={CHART_COLORS.emerald}
          strokeWidth={2}
          fill="url(#colorCurr)"
          dot={false}
        />
        {compareEnabled && previous && (
          <Area
            type="monotone"
            dataKey="prev"
            stroke={CHART_COLORS.amber}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            fill="url(#colorPrev)"
            dot={false}
            connectNulls
          />
        )}
      </AreaChart>
    </ChartContainer>
  );
}

// ----- Top Outlets (horizontal bar) -----
interface TopOutletsChartProps {
  data: OutletAgg[];
  height?: number;
}

export function TopOutletsChart({ data, height = 320 }: TopOutletsChartProps) {
  const top = data.slice(0, 10).map((d) => ({
    name: d.outlet.replace(/^KACC\s*-\s*/i, "").trim(),
    revenue: d.revenue,
    transactions: d.transactions,
  }));
  const maxRev = Math.max(...top.map((t) => t.revenue), 1);

  return (
    <ChartContainer
      config={{ revenue: { label: "Revenue", color: CHART_COLORS.cyan } }}
      className="w-full"
      style={{ height }}
    >
      <BarChart data={top} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatRupiah(v)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "#cbd5e1", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={120}
          interval={0}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => {
                const txn = (item?.payload as { transactions?: number })?.transactions ?? 0;
                return (
                  <div className="flex w-full flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">Revenue</span>
                    <span className="font-bold tabular-nums">{formatRupiah(Number(value), false)}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatNumber(txn)} transaksi
                    </span>
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {top.map((d, i) => (
            <Cell
              key={`cell-${i}`}
              fill={i === 0 ? CHART_COLORS.emerald : CHART_COLORS.cyan}
              opacity={1 - (i / top.length) * 0.55}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// ----- Payment Mix (donut) -----
interface PaymentPieProps {
  data: PaymentAgg[];
}

export function PaymentMixChart({ data }: PaymentPieProps) {
  const colors = [
    CHART_COLORS.emerald,
    CHART_COLORS.cyan,
    CHART_COLORS.amber,
    CHART_COLORS.pink,
    CHART_COLORS.purple,
    CHART_COLORS.red,
    "#22D3EE",
    "#A78BFA",
    "#34D399",
    "#FBBF24",
    "#F472B6",
    "#60A5FA",
    "#94A3B8",
  ];

  return (
    <div className="flex h-[260px] flex-col items-center gap-3">
      <ChartContainer
        config={{ revenue: { label: "Revenue", color: CHART_COLORS.emerald } }}
        className="aspect-square h-[200px]"
      >
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => {
                  const p = item?.payload as { payment?: string; share?: number };
                  return (
                    <div className="flex w-full flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground">{p?.payment}</span>
                      <span className="font-bold tabular-nums">{formatRupiah(Number(value), false)}</span>
                      {p?.share !== undefined && (
                        <span className="text-[10px] text-muted-foreground">{formatPct(p.share)} share</span>
                      )}
                    </div>
                  );
                }}
              />
            }
          />
          <Pie
            data={data}
            dataKey="revenue"
            nameKey="payment"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={1.5}
          >
            {data.map((_, i) => (
              <Cell key={`cell-${i}`} fill={colors[i % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        {data.slice(0, 6).map((p, i) => (
          <div key={p.payment} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <span className="text-[10px] text-muted-foreground">
              {p.payment} ({formatPct(p.share)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----- Hourly Distribution (bar) -----
interface HourlyChartProps {
  data: HourAgg[];
  peakHour: number;
  height?: number;
}

export function HourlyChart({ data, peakHour, height = 320 }: HourlyChartProps) {
  // Filter to only hours with data (typically 5-22)
  const activeData = data.filter((d) => d.revenue > 0 || d.transactions > 0);
  const display = activeData.length > 0 ? activeData : data;

  return (
    <ChartContainer
      config={{ revenue: { label: "Revenue", color: CHART_COLORS.purple } }}
      className="w-full"
      style={{ height }}
    >
      <BarChart data={display} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="hour"
          tickFormatter={(v) => `${String(v).padStart(2, "0")}:00`}
          tick={{ fill: "#94a3b8", fontSize: 9 }}
          tickLine={false}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          interval={0}
        />
        <YAxis
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) => formatRupiah(v)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => {
                const h = (item?.payload as { hour?: number })?.hour ?? 0;
                return (
                  <div className="flex w-full flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      Jam {String(h).padStart(2, "0")}:00
                      {h === peakHour && " (PUNCAK)"}
                    </span>
                    <span className="font-bold tabular-nums">{formatRupiah(Number(value), false)}</span>
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={28}>
          {display.map((d, i) => (
            <Cell
              key={`cell-${i}`}
              fill={d.hour === peakHour ? CHART_COLORS.emerald : CHART_COLORS.purple}
              opacity={d.hour === peakHour ? 1 : 0.7}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// ----- Top Items (horizontal bar) -----
interface TopItemsChartProps {
  data: ItemAgg[];
  height?: number;
}

export function TopItemsChart({ data, height = 320 }: TopItemsChartProps) {
  const top = data.slice(0, 10).map((d) => ({
    name: d.item.length > 28 ? d.item.slice(0, 26) + "..." : d.item,
    qty: d.qty,
    revenue: d.revenue,
    category: d.category,
  }));
  return (
    <ChartContainer
      config={{ qty: { label: "Qty", color: CHART_COLORS.amber } }}
      className="w-full"
      style={{ height }}
    >
      <BarChart data={top} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatNumber(v)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "#cbd5e1", fontSize: 9 }}
          tickLine={false}
          axisLine={false}
          width={130}
          interval={0}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => {
                const p = item?.payload as { revenue?: number; category?: string };
                return (
                  <div className="flex w-full flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">Qty terjual</span>
                    <span className="font-bold tabular-nums">{formatNumber(Number(value))} cup</span>
                    {p?.revenue !== undefined && (
                      <span className="text-[10px] text-muted-foreground">
                        Revenue {formatRupiah(p.revenue, false)} - {p.category}
                      </span>
                    )}
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="qty" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {top.map((d, i) => {
            const color =
              d.category === "Coffee"
                ? CHART_COLORS.emerald
                : d.category === "Non-Coffee"
                  ? CHART_COLORS.cyan
                  : d.category === "Packaging"
                    ? CHART_COLORS.slate
                    : CHART_COLORS.amber;
            return (
              <Cell
                key={`cell-${i}`}
                fill={color}
                opacity={1 - (i / top.length) * 0.5}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
