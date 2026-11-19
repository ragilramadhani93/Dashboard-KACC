"use client";
import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Search,
  X,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatRupiah, formatNumber, formatPct, cleanOutletName } from "@/lib/format";
import type { OutletAgg } from "@/lib/types";

interface OutletRankingTableProps {
  data: OutletAgg[];
  prevData?: OutletAgg[] | null;
  avgThreshold?: number; // outlets below this revenue are flagged
  topN?: number;
}

type SortKey = "revenue" | "transactions" | "items" | "avgPerTxn" | "diffRevenue";
type SortDir = "asc" | "desc";
type FilterTab = "all" | "declining" | "growing";

export function OutletRankingTable({
  data,
  prevData,
  avgThreshold,
  topN = 15,
}: OutletRankingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");

  const prevMap = useMemo(() => {
    if (!prevData || prevData.length === 0) return null;
    const m = new Map<string, OutletAgg>();
    for (const p of prevData) {
      if (p.outlet) m.set(p.outlet, p);
    }
    return m;
  }, [prevData]);

  // Combine data with comparison metrics
  const enriched = useMemo(() => {
    return data.map((d) => {
      const prev = prevMap?.get(d.outlet);
      const prevRev = prev ? prev.revenue : 0;
      const diffRev = prevMap ? d.revenue - prevRev : 0;
      const pctChange = prevRev > 0 ? (diffRev / prevRev) * 100 : d.revenue > 0 ? 100 : 0;
      return {
        ...d,
        prevRevenue: prevRev,
        diffRevenue: diffRev,
        pctChange,
        isDeclining: prevMap ? diffRev < 0 : false,
        isGrowing: prevMap ? diffRev > 0 : false,
      };
    });
  }, [data, prevMap]);

  const decliningCount = useMemo(
    () => enriched.filter((e) => e.isDeclining).length,
    [enriched],
  );
  const growingCount = useMemo(
    () => enriched.filter((e) => e.isGrowing).length,
    [enriched],
  );

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = q
      ? enriched.filter((d) =>
          d.outlet.toLowerCase().includes(q) || cleanOutletName(d.outlet).toLowerCase().includes(q),
        )
      : [...enriched];

    if (filterTab === "declining") {
      arr = arr.filter((d) => d.isDeclining);
    } else if (filterTab === "growing") {
      arr = arr.filter((d) => d.isGrowing);
    }

    arr.sort((a, b) => {
      const valA = (a[sortKey] as number) ?? 0;
      const valB = (b[sortKey] as number) ?? 0;
      const diff = valA - valB;
      return sortDir === "desc" ? -diff : diff;
    });
    return arr;
  }, [enriched, query, filterTab, sortKey, sortDir]);

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
      setSortDir(key === "diffRevenue" && filterTab === "declining" ? "asc" : "desc");
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
      {/* Filter Tabs if comparison is available */}
      {prevMap && (
        <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filterTab === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            Semua ({enriched.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterTab("declining");
              setSortKey("diffRevenue");
              setSortDir("asc"); // biggest drop first
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filterTab === "declining"
                ? "bg-destructive text-destructive-foreground font-semibold"
                : "bg-destructive/10 text-status-danger hover:bg-destructive/20",
            )}
          >
            <TrendingDown className="h-3 w-3" />
            <span>Outlet Turun ({decliningCount})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterTab("growing");
              setSortKey("diffRevenue");
              setSortDir("desc");
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filterTab === "growing"
                ? "bg-status-success text-white font-semibold"
                : "bg-status-success/10 text-status-success hover:bg-status-success/20",
            )}
          >
            <TrendingUp className="h-3 w-3" />
            <span>Outlet Naik ({growingCount})</span>
          </button>
        </div>
      )}

      {/* Quick search */}
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            filterTab === "declining"
              ? "Cari outlet yang turun..."
              : "Cari nama outlet..."
          }
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
              {prevMap && renderSortHeader("vs Bulan Lalu", "diffRevenue", "right")}
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
                <td
                  colSpan={prevMap ? 8 : 7}
                  className="px-3 py-6 text-center text-xs text-muted-foreground"
                >
                  {filterTab === "declining"
                    ? "Tidak ada outlet yang mengalami penurunan omzet."
                    : `Tidak ada outlet yang cocok dengan pencarian "${query}".`}
                </td>
              </tr>
            ) : (
              visible.map((o, i) => {
                const outletName = cleanOutletName(o.outlet);
                const share = totalRev > 0 ? (o.revenue / totalRev) * 100 : 0;
                const isAlert = o.revenue < effectiveThreshold;
                const barWidth = (o.revenue / maxRev) * 100;
                return (
                  <tr
                    key={o.outlet}
                    className={cn(
                      "border-b border-border/70 transition-colors hover:bg-muted/40",
                      isAlert && "bg-destructive/[0.06] hover:bg-destructive/10",
                      o.isDeclining && filterTab === "declining" && "bg-destructive/[0.03]",
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
                    {prevMap && (
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                        {o.diffRevenue < 0 ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="font-semibold text-status-danger">
                              -{formatRupiah(Math.abs(o.diffRevenue))}
                            </span>
                            <span className="text-[10px] text-status-danger">
                              {formatPct(o.pctChange)}
                            </span>
                          </div>
                        ) : o.diffRevenue > 0 ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="font-semibold text-status-success">
                              +{formatRupiah(o.diffRevenue)}
                            </span>
                            <span className="text-[10px] text-status-success">
                              +{formatPct(o.pctChange)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    )}
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
