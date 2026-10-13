"use client";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import { formatDateShort } from "@/lib/dashboard/aggregate";
import type { HeatmapCell } from "@/lib/types";

interface OutletHeatmapProps {
  data: HeatmapCell[][]; // rows = outlets, cols = dates
  dateList: string[];
  height?: number;
}

/**
 * Outlet x Day heatmap of revenue.
 * Color scale: dark -> emerald (low to high).
 */
export function OutletHeatmap({ data, dateList, height = 380 }: OutletHeatmapProps) {
  const { max, min, avg } = useMemo(() => {
    let max = 0;
    let min = Infinity;
    let sum = 0;
    let count = 0;
    for (const row of data) {
      for (const c of row) {
        if (c.revenue > max) max = c.revenue;
        if (c.revenue < min && c.revenue > 0) min = c.revenue;
        if (c.revenue > 0) {
          sum += c.revenue;
          count++;
        }
      }
    }
    return { max, min: min === Infinity ? 0 : min, avg: count > 0 ? sum / count : 0 };
  }, [data]);

  function getColor(value: number): string {
    if (value <= 0) return "rgba(255,255,255,0.03)";
    const ratio = max > 0 ? value / max : 0;
    // emerald gradient
    if (ratio < 0.2) return "rgba(16,185,129,0.18)";
    if (ratio < 0.4) return "rgba(16,185,129,0.32)";
    if (ratio < 0.6) return "rgba(16,185,129,0.55)";
    if (ratio < 0.8) return "rgba(16,185,129,0.75)";
    return "rgba(16,185,129,0.95)";
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        Tidak ada data untuk heatmap
      </div>
    );
  }

  return (
    <div className="overflow-auto" style={{ maxHeight: height }}>
      <table className="w-full border-separate border-spacing-1 text-[10px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-card px-2 py-1 text-left font-medium text-muted-foreground">
              Outlet / Tanggal
            </th>
            {dateList.map((d) => (
              <th
                key={d}
                className="px-1 py-1 text-center font-medium text-muted-foreground"
                style={{ minWidth: 40 }}
              >
                {formatDateShort(d)}
              </th>
            ))}
            <th className="px-2 py-1 text-right font-medium text-muted-foreground">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const outlet = row[0]?.outlet ?? "";
            const outletName = outlet.replace(/^KACC\s*-\s*/i, "").trim();
            const rowTotal = row.reduce((s, c) => s + c.revenue, 0);
            return (
              <tr key={i} className="group">
                <td
                  className="sticky left-0 z-10 bg-card px-2 py-1.5 font-medium text-foreground"
                  title={outlet}
                >
                  <div className="max-w-[150px] truncate" title={outletName}>
                    {outletName}
                  </div>
                </td>
                {row.map((c, j) => (
                  <td
                    key={j}
                    className="h-9 min-w-[40px] cursor-pointer rounded p-0 transition-all hover:ring-1 hover:ring-white/30"
                    style={{ backgroundColor: getColor(c.revenue) }}
                    title={`${outletName} | ${formatDateShort(c.date)}: ${formatRupiah(c.revenue, false)} (${c.transactions} txn)`}
                  >
                    <div className="flex h-full items-center justify-center text-[9px] text-white/80">
                      {c.revenue > 0 ? formatRupiah(c.revenue, true) : ""}
                    </div>
                  </td>
                ))}
                <td
                  className={cn(
                    "px-2 py-1.5 text-right font-bold tabular-nums",
                    rowTotal < avg * 0.5 ? "text-red-400" : "text-foreground",
                  )}
                >
                  {formatRupiah(rowTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Color legend */}
      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Low</span>
        <div className="h-3 w-32 rounded bg-gradient-to-r from-emerald-500/20 via-emerald-500/55 to-emerald-500/95" />
        <span>High</span>
        <span className="ml-auto">
          Avg: {formatRupiah(avg)} / Max: {formatRupiah(max)}
        </span>
      </div>
    </div>
  );
}
