"use client";
import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = q
      ? data.filter((d) => d.outlet.toLowerCase().includes(q))
      : [...data];
    arr.sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "desc" ? -diff : diff;
    });
    return arr;
  }, [data, query, sortKey, sortDir]);

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
      {/* Quick search + Threshold summary */}
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama outlet..."
          aria-label="Cari nama outlet"
          className="h-9 pl-8 pr-8 text-xs"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Hapus pencarian outlet"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2.5 rounded-lg border border-status-warning/25 bg-status-warning/10 px-3 py-2 text-xs">
        <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-status-warning" />
        <span className="text-muted-foreground">
          Threshold alert:{" "}
          <span className="font-semibold text-status-warning">
            outlet di bawah {formatRupiah(effectiveThreshold)} (50% dari rata-rata {formatRupiah(avgRev)})
          </span>
        </span>
      </div>

      <div className="max-h-[460px] overflow-auto rounded-lg border border-border">
        <table className="w-full">
          <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xs">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                #
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                Outlet
              </th>
              {renderSortHeader("Revenue", "revenue", "right")}
              {renderSortHeader("Transaksi", "transactions", "right")}
              {renderSortHeader("Item", "items", "right")}
              {renderSortHeader("AOV", "avgPerTxn", "right")}
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Tidak ada outlet yang cocok dengan pencarian &quot;{query}&quot;.
                </td>
              </tr>
            ) : (
              visible.map((o, i) => {
              const outletName = o.outlet.replace(/^KACC\s*-\s*/i, "").trim();
              const share = totalRev > 0 ? (o.revenue / totalRev) * 100 : 0;
              const isAlert = o.revenue < effectiveThreshold;
              const barWidth = (o.revenue / maxRev) * 100;
              return (
                <tr
                  key={o.outlet}
                  className={cn(
                    "border-b border-border/70 transition-colors hover:bg-muted/40",
                    isAlert && "bg-destructive/[0.06] hover:bg-destructive/10",
                  )}
                >
                  <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground" title={o.outlet}>
                        {outletName}
                      </span>
                      {isAlert && (
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[11px] font-semibold border-destructive/40 bg-destructive/10 text-status-danger"
                        >
                          <AlertTriangle aria-hidden="true" className="mr-1 h-3 w-3" />
                          Alert
                        </Badge>
                      )}
                    </div>
                    {/* Revenue bar */}
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          isAlert
                            ? "bg-destructive"
                            : i === 0
                              ? "bg-status-success"
                              : "bg-primary",
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-foreground">
                    {formatRupiah(o.revenue)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                    {formatNumber(o.transactions)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                    {formatNumber(o.items)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-medium tabular-nums text-status-warning">
                    {formatRupiah(o.avgPerTxn)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                    {formatPct(share)}
                  </td>
                </tr>
              );
            }))}
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
