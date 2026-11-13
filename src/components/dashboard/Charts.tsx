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
  primary: "var(--chart-1)",
  emerald: "var(--chart-2)",
  cobalt: "var(--chart-3)",
  amber: "var(--chart-4)",
  danger: "var(--chart-5)",
  muted: "var(--muted-foreground)",
};

// ----- Daily Revenue Trend (with optional compare overlay) -----
interface TrendChartProps {
  current: TrendPoint[];
  previous?: TrendPoint[] | null;
  compareEnabled?: boolean;
  forecast?: { date: string; revenue: number }[] | null;
  height?: number;
}

export function RevenueTrendChart({
  current,
  previous,
  compareEnabled,
  forecast,
  height = 320,
}: TrendChartProps) {
  // Merge current + previous by index (since dates differ in compare mode)
  const maxLen = Math.max(current.length, previous?.length ?? 0);
  const merged: Array<{
    label: string;
    currDate: string;
    prevDate: string | null;
    curr: number | null;
    prev: number | null;
    forecast: number | null;
  }> = [];

  for (let i = 0; i < maxLen; i++) {
    const c = current[i];
    const p = previous?.[i];
    // On the last actual point, anchor forecast so the dashed line connects seamlessly
    const isLastActual = i === current.length - 1 && forecast && forecast.length > 0;
    merged.push({
      label: c ? formatDateShort(c.date) : p ? formatDateShort(p.date) : `${i + 1}`,
      currDate: c?.date ?? "",
      prevDate: p?.date ?? null,
      curr: c?.revenue ?? 0,
      prev: p?.revenue ?? null,
      forecast: isLastActual && c ? c.revenue : null,
    });
  }

  // Append remaining forecast days if provided
  if (forecast && forecast.length > 0) {
    for (const f of forecast) {
      merged.push({
        label: formatDateShort(f.date),
        currDate: f.date,
        prevDate: null,
        curr: null,
        prev: null,
        forecast: f.revenue,
      });
    }
  }

  const hasForecast = forecast && forecast.length > 0;

  return (
    <ChartContainer
      config={{
        curr: { label: "Realisasi Harian", color: CHART_COLORS.emerald },
        prev: { label: "Periode Sebelumnya", color: CHART_COLORS.primary },
        forecast: { label: "Forecast Akhir Bulan", color: CHART_COLORS.amber },
      }}
      className="w-full"
      style={{ height }}
    >
      <AreaChart data={merged} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="colorCurr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.amber} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={60}
          tickFormatter={(v) => formatRupiah(v)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => {
                const labels: Record<string, string> = {
                  curr: "Realisasi Harian",
                  prev: "Periode Sebelumnya",
                  forecast: "Estimasi Forecast",
                };
                return (
                  <div className="flex w-full flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
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
          connectNulls
        />
        {compareEnabled && previous && (
          <Area
            type="monotone"
            dataKey="prev"
            stroke={CHART_COLORS.primary}
            strokeWidth={1.75}
            strokeDasharray="4 3"
            fill="url(#colorPrev)"
            dot={false}
            connectNulls
          />
        )}
        {hasForecast && (
          <Area
            type="monotone"
            dataKey="forecast"
            stroke={CHART_COLORS.amber}
            strokeWidth={2}
            strokeDasharray="4 3"
            fill="url(#colorForecast)"
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

  return (
    <ChartContainer
      config={{ revenue: { label: "Revenue", color: CHART_COLORS.primary } }}
      className="w-full"
      style={{ height }}
    >
      <BarChart data={top} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatRupiah(v)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "var(--foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={126}
          interval={0}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => {
                const txn = (item?.payload as { transactions?: number })?.transactions ?? 0;
                return (
                  <div className="flex w-full flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Revenue</span>
                    <span className="font-bold tabular-nums">{formatRupiah(Number(value), false)}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatNumber(txn)} transaksi
                    </span>
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {top.map((_, i) => (
            <Cell
              key={`cell-${i}`}
              fill={i === 0 ? CHART_COLORS.emerald : CHART_COLORS.primary}
              opacity={1 - (i / Math.max(top.length, 1)) * 0.45}
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
    CHART_COLORS.primary,
    CHART_COLORS.emerald,
    CHART_COLORS.cobalt,
    CHART_COLORS.amber,
    CHART_COLORS.danger,
    CHART_COLORS.muted,
  ];

  return (
    <div className="flex min-h-[260px] flex-col items-center gap-3">
      <ChartContainer
        config={{ revenue: { label: "Revenue", color: CHART_COLORS.primary } }}
        className="aspect-square h-[196px]"
      >
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => {
                  const p = item?.payload as { payment?: string; share?: number };
                  return (
                    <div className="flex w-full flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">{p?.payment}</span>
                      <span className="font-bold tabular-nums">{formatRupiah(Number(value), false)}</span>
                      {p?.share !== undefined && (
                        <span className="text-xs text-muted-foreground">{formatPct(p.share)} share</span>
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
            innerRadius={54}
            outerRadius={84}
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
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
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <span className="text-xs text-muted-foreground">
              {p.payment} ({formatPct(p.share)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----- Hourly Distribution (bar) - clickable + keyboard buttons -----
interface HourlyChartProps {
  data: HourAgg[];
  peakHour: number;
  height?: number;
  onBarClick?: (hour: number) => void;
}

export function HourlyChart({ data, peakHour, height = 280, onBarClick }: HourlyChartProps) {
  const activeData = data.filter((d) => d.revenue > 0 || d.transactions > 0);
  const display = activeData.length > 0 ? activeData : data;

  return (
    <div className="flex flex-col gap-3">
      <ChartContainer
        config={{ revenue: { label: "Revenue", color: CHART_COLORS.primary } }}
        className="w-full"
        style={{ height }}
      >
        <BarChart
          data={display}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={(v) => `${String(v).padStart(2, "0")}:00`}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={0}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(v) => formatRupiah(v)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => {
                  const h = (item?.payload as { hour?: number })?.hour ?? 0;
                  return (
                    <div className="flex w-full flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">
                        Jam {String(h).padStart(2, "0")}:00
                        {h === peakHour && " (Puncak)"}
                      </span>
                      <span className="font-bold tabular-nums">{formatRupiah(Number(value), false)}</span>
                      {onBarClick && (
                        <span className="text-xs text-primary">
                          Klik batang atau tombol jam di bawah untuk detail menu
                        </span>
                      )}
                    </div>
                  );
                }}
              />
            }
          />
          <Bar
            dataKey="revenue"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            cursor={onBarClick ? "pointer" : "default"}
            onClick={(barData: unknown) => {
              if (!onBarClick) return;
              const payload = (barData as { payload?: { hour?: number } })?.payload;
              if (payload && typeof payload.hour === "number") {
                onBarClick(payload.hour);
              }
            }}
          >
            {display.map((d, i) => (
              <Cell
                key={`cell-${i}`}
                fill={d.hour === peakHour ? CHART_COLORS.emerald : CHART_COLORS.primary}
                opacity={d.hour === peakHour ? 1 : 0.78}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {onBarClick && display.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5"
          role="group"
          aria-label="Pilih jam untuk melihat detail menu"
        >
          <span className="mr-1 text-xs font-medium text-muted-foreground">
            Detail jam:
          </span>
          {display.map((d) => {
            const label = `${String(d.hour).padStart(2, "0")}:00`;
            const isPeak = d.hour === peakHour;
            return (
              <button
                key={d.hour}
                type="button"
                onClick={() => onBarClick(d.hour)}
                className={
                  isPeak
                    ? "min-h-8 rounded-md border border-emerald-700/40 bg-emerald-700/10 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-700/20 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300"
                    : "min-h-8 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                }
                aria-label={`Lihat detail transaksi jam ${label}${isPeak ? " (jam puncak)" : ""}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
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
      config={{ qty: { label: "Qty", color: CHART_COLORS.primary } }}
      className="w-full"
      style={{ height }}
    >
      <BarChart data={top} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatNumber(v)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "var(--foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={142}
          interval={0}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => {
                const p = item?.payload as { revenue?: number; category?: string };
                return (
                  <div className="flex w-full flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Qty terjual</span>
                    <span className="font-bold tabular-nums">{formatNumber(Number(value))} cup</span>
                    {p?.revenue !== undefined && (
                      <span className="text-xs text-muted-foreground">
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
                ? CHART_COLORS.primary
                : d.category === "Non-Coffee"
                  ? CHART_COLORS.emerald
                  : d.category === "Packaging"
                    ? CHART_COLORS.muted
                    : CHART_COLORS.cobalt;
            return (
              <Cell
                key={`cell-${i}`}
                fill={color}
                opacity={1 - (i / Math.max(top.length, 1)) * 0.45}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
