"use client";
import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRupiah, formatNumber, formatPct } from "@/lib/format";
import type { OutletAgg } from "@/lib/types";

interface OutletRankingTableProps {
  data: OutletAgg[];
  avgThreshold?: number; // outlets below this revenue are flagged
  topN?: number;
}

type SortKey = "revenue" | "transactions" | "items" | "avgPerTxn";
type SortDir = "asc" | "desc";

export function OutletRankingTable({
  data,
  avgThreshold,
  topN = 15,
}: OutletRankingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "desc" ? -diff : diff;
    });
    return arr;
  }, [data, sortKey, sortDir]);

  const visible = showAll ? sorted : sorted.slice(0, topN);
  const maxRev = Math.max(...data.map((d) => d.revenue), 1);
  const totalRev = data.reduce((s, d) => s + d.revenue, 0);
  const avgRev = data.length > 0 ? totalRev / data.length : 0;
  const effectiveThreshold = avgThreshold ?? avgRev * 0.5;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const renderSortHeader = (label: string, k: SortKey, align: "left" | "right" = "left") => (
    <th
      key={k}
      className="cursor-pointer select-none px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
      onClick={() => toggleSort(k)}
      style={{ textAlign: align }}
    >
      <div className={cn("flex items-center gap-1", align === "right" && "justify-end")}>
        {label}
        {sortKey === k ? (
          sortDir === "desc" ? (
            <ArrowDown className="h-3 w-3 text-emerald-400" />
          ) : (
            <ArrowUp className="h-3 w-3 text-emerald-400" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </th>
  );

  return (
    <div className="space-y-2">
      {/* Threshold summary */}
      <div className="flex items-center gap-3 rounded-md bg-amber-500/5 px-3 py-1.5 text-[10px]">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-muted-foreground">
          Threshold alert:{" "}
          <span className="font-semibold text-amber-400">
            outlet di bawah {formatRupiah(effectiveThreshold)} (50% dari avg {formatRupiah(avgRev)})
          </span>
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/5">
        <table className="w-full">
          <thead className="border-b border-white/5 bg-card/50">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                #
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Outlet
              </th>
              {renderSortHeader("Revenue", "revenue", "right")}
              {renderSortHeader("Transaksi", "transactions", "right")}
              {renderSortHeader("Item", "items", "right")}
              {renderSortHeader("AOV", "avgPerTxn", "right")}
              <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((o, i) => {
              const outletName = o.outlet.replace(/^KACC\s*-\s*/i, "").trim();
              const share = totalRev > 0 ? (o.revenue / totalRev) * 100 : 0;
              const isAlert = o.revenue < effectiveThreshold;
              const barWidth = (o.revenue / maxRev) * 100;
              return (
                <tr
                  key={o.outlet}
                  className={cn(
                    "border-b border-white/5 transition-colors hover:bg-white/5",
                    isAlert && "bg-red-500/5 hover:bg-red-500/10",
                  )}
                >
                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground" title={o.outlet}>
                        {outletName}
                      </span>
                      {isAlert && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] border-red-500/40 bg-red-500/10 text-red-400">
                          <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />
                          ALERT
                        </Badge>
                      )}
                    </div>
                    {/* Revenue bar */}
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          isAlert ? "bg-red-500/60" : i === 0 ? "bg-emerald-400" : "bg-cyan-400/70",
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-foreground">
                    {formatRupiah(o.revenue)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {formatNumber(o.transactions)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {formatNumber(o.items)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-amber-300">
                    {formatRupiah(o.avgPerTxn)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {formatPct(share)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length > topN && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 bg-white/5 text-xs hover:bg-white/10"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Tampilkan Lebih Sedikit" : `Tampilkan Semua (${sorted.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}
