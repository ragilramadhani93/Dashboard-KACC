"use client";
import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRupiah, formatNumber, formatPct } from "@/lib/format";
import type { ItemAgg } from "@/lib/types";

interface ItemRankingTableProps {
  data: ItemAgg[];
  topN?: number;
}

type SortKey = "revenue" | "qty" | "transactions";
type SortDir = "asc" | "desc";

const categoryColor: Record<string, string> = {
  Coffee: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  "Non-Coffee": "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  Packaging: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  Merchandise: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  Other: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

export function ItemRankingTable({ data, topN = 15 }: ItemRankingTableProps) {
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
  const totalRev = data.reduce((s, d) => s + d.revenue, 0);

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
      <div className="overflow-x-auto rounded-lg border border-white/5">
        <table className="w-full">
          <thead className="border-b border-white/5 bg-card/50">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                #
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Item
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Kategori
              </th>
              {renderSortHeader("Qty", "qty", "right")}
              {renderSortHeader("Revenue", "revenue", "right")}
              {renderSortHeader("Transaksi", "transactions", "right")}
              <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((it, i) => {
              const share = totalRev > 0 ? (it.revenue / totalRev) * 100 : 0;
              return (
                <tr
                  key={it.item}
                  className="border-b border-white/5 transition-colors hover:bg-white/5"
                >
                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-foreground" title={it.item}>
                    {it.item}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-4 px-1 text-[9px] font-medium",
                        categoryColor[it.category] ?? categoryColor.Other,
                      )}
                    >
                      {it.category}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-amber-300">
                    {formatNumber(it.qty)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-foreground">
                    {formatRupiah(it.revenue)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {formatNumber(it.transactions)}
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
