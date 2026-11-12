"use client";
import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatRupiah, formatNumber, formatPct } from "@/lib/format";
import type { ItemAgg } from "@/lib/types";

interface ItemRankingTableProps {
  data: ItemAgg[];
  topN?: number;
}

type SortKey = "revenue" | "qty" | "transactions";
type SortDir = "asc" | "desc";

const categoryColor: Record<string, string> = {
  Coffee: "border-emerald-700/30 bg-emerald-700/10 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300",
  "Non-Coffee": "border-blue-700/30 bg-blue-700/10 text-blue-800 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300",
  Packaging: "border-border bg-muted text-muted-foreground",
  Merchandise: "border-primary/40 bg-primary/10 text-primary",
  Other: "border-amber-700/30 bg-amber-600/10 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",
};

export function ItemRankingTable({ data, topN = 15 }: ItemRankingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = q
      ? data.filter(
          (d) =>
            d.item.toLowerCase().includes(q) || d.category.toLowerCase().includes(q),
        )
      : [...data];
    arr.sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "desc" ? -diff : diff;
    });
    return arr;
  }, [data, query, sortKey, sortDir]);

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

  const renderSortHeader = (label: string, k: SortKey, align: "left" | "right" = "left") => {
    const isSorted = sortKey === k;
    return (
      <th
        key={k}
        aria-sort={isSorted ? (sortDir === "desc" ? "descending" : "ascending") : "none"}
        className="px-3 py-2 text-xs font-semibold text-muted-foreground"
        style={{ textAlign: align }}
      >
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={cn(
            "inline-flex min-h-8 w-full items-center gap-1 rounded hover:text-foreground",
            align === "right" && "justify-end",
          )}
        >
          <span>{label}</span>
          {isSorted ? (
            sortDir === "desc" ? (
              <ArrowDown aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
            ) : (
              <ArrowUp aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
            )
          ) : (
            <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 opacity-40" />
          )}
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama menu atau kategori..."
          aria-label="Cari nama menu atau kategori"
          className="h-9 pl-8 pr-8 text-xs"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Hapus pencarian menu"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="max-h-[460px] overflow-auto rounded-lg border border-border">
        <table className="w-full">
          <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xs">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                #
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                Item
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                Kategori
              </th>
              {renderSortHeader("Qty", "qty", "right")}
              {renderSortHeader("Revenue", "revenue", "right")}
              {renderSortHeader("Transaksi", "transactions", "right")}
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Tidak ada menu yang cocok dengan pencarian &quot;{query}&quot;.
                </td>
              </tr>
            ) : (
              visible.map((it, i) => {
                const share = totalRev > 0 ? (it.revenue / totalRev) * 100 : 0;
                return (
                  <tr
                    key={it.item}
                    className="border-b border-border/70 transition-colors hover:bg-muted/40"
                  >
                    <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium text-foreground" title={it.item}>
                      {it.item}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-5 px-2 text-[11px] font-medium",
                          categoryColor[it.category] ?? categoryColor.Other,
                        )}
                      >
                        {it.category}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-status-warning">
                      {formatNumber(it.qty)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-foreground">
                      {formatRupiah(it.revenue)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                      {formatNumber(it.transactions)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                      {formatPct(share)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > topN && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 text-xs"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Tampilkan Lebih Sedikit" : `Tampilkan Semua (${sorted.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}
