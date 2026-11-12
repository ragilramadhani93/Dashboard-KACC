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
  const { max, avg } = useMemo(() => {
    let max = 0;
    let sum = 0;
    let count = 0;
    for (const row of data) {
      for (const c of row) {
        if (c.revenue > max) max = c.revenue;
        if (c.revenue > 0) {
          sum += c.revenue;
          count++;
        }
      }
    }
    return { max, avg: count > 0 ? sum / count : 0 };
  }, [data]);

  function getCellToneClass(value: number): string {
    if (value <= 0) return "bg-muted/50 text-muted-foreground";
    const ratio = max > 0 ? value / max : 0;
    if (ratio < 0.2) return "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200";
    if (ratio < 0.4) return "bg-emerald-200 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100";
    if (ratio < 0.6) return "bg-emerald-300 text-emerald-950 dark:bg-emerald-800 dark:text-white";
    if (ratio < 0.8) return "bg-emerald-700 text-white dark:bg-emerald-700 dark:text-white";
    return "bg-emerald-800 text-white dark:bg-emerald-400 dark:text-emerald-950";
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
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-card px-2 py-1.5 text-left font-medium text-muted-foreground">
              Outlet / Tanggal
            </th>
            {dateList.map((d) => (
              <th
                key={d}
                className="min-w-11 px-1 py-1.5 text-center font-medium text-muted-foreground"
              >
                {formatDateShort(d)}
              </th>
            ))}
            <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">
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
              <tr key={i}>
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
                    className={cn(
                      "h-9 min-w-11 rounded p-0 transition-colors hover:ring-1 hover:ring-ring/60",
                      getCellToneClass(c.revenue),
                    )}
                    title={`${outletName} | ${formatDateShort(c.date)}: ${formatRupiah(c.revenue, false)} (${c.transactions} txn)`}
                  >
                    <div className="flex h-full items-center justify-center px-1 text-[11px] font-medium tabular-nums">
                      {c.revenue > 0 ? formatRupiah(c.revenue, true) : "-"}
                    </div>
                  </td>
                ))}
                <td
                  className={cn(
                    "px-2 py-1.5 text-right font-bold tabular-nums",
                    rowTotal < avg * 0.5 ? "text-red-700 dark:text-red-400" : "text-foreground",
                  )}
                >
                  {formatRupiah(rowTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Discrete contrast-safe color legend */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Rendah</span>
        <div className="flex items-center gap-1" aria-hidden="true">
          <span className="h-3 w-5 rounded-sm bg-emerald-100 dark:bg-emerald-950" />
          <span className="h-3 w-5 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
          <span className="h-3 w-5 rounded-sm bg-emerald-300 dark:bg-emerald-800" />
          <span className="h-3 w-5 rounded-sm bg-emerald-700" />
          <span className="h-3 w-5 rounded-sm bg-emerald-800 dark:bg-emerald-400" />
        </div>
        <span>Tinggi</span>
        <span className="ml-auto tabular-nums">
          Rata-rata: {formatRupiah(avg)} / Maks: {formatRupiah(max)}
        </span>
      </div>
    </div>
  );
}
