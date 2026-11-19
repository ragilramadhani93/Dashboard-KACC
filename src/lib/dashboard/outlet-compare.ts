import type { OutletAgg } from "@/lib/types";

export interface OutletComparisonItem {
  outlet: string;
  currentRevenue: number;
  prevRevenue: number;
  diffRevenue: number; // current - prev (negative means drop)
  pctChange: number; // percentage change, e.g. -24.5
  currentTransactions: number;
  prevTransactions: number;
  diffTransactions: number;
  currentAov: number;
  prevAov: number;
  diffAov: number;
  status: "down" | "up" | "stable" | "new" | "inactive";
}

export interface OutletComparisonSummary {
  items: OutletComparisonItem[];
  declining: OutletComparisonItem[];
  growing: OutletComparisonItem[];
  stable: OutletComparisonItem[];
  totalDecliningRevenue: number; // sum of absolute revenue drop
  totalDecliningTxn: number;
  decliningCount: number;
  growingCount: number;
  stableCount: number;
  totalOutlets: number;
}

export function computeOutletComparison(
  currentList: OutletAgg[],
  prevList: OutletAgg[] | null,
): OutletComparisonSummary {
  if (!prevList || prevList.length === 0) {
    const emptyItems = currentList.map((c) => ({
      outlet: c.outlet,
      currentRevenue: c.revenue,
      prevRevenue: 0,
      diffRevenue: 0,
      pctChange: 0,
      currentTransactions: c.transactions,
      prevTransactions: 0,
      diffTransactions: 0,
      currentAov: c.avgPerTxn,
      prevAov: 0,
      diffAov: 0,
      status: "new" as const,
    }));
    return {
      items: emptyItems,
      declining: [],
      growing: [],
      stable: emptyItems,
      totalDecliningRevenue: 0,
      totalDecliningTxn: 0,
      decliningCount: 0,
      growingCount: 0,
      stableCount: 0,
      totalOutlets: currentList.length,
    };
  }

  const prevMap = new Map<string, OutletAgg>();
  for (const p of prevList) {
    if (p.outlet) prevMap.set(p.outlet, p);
  }

  const currentMap = new Map<string, OutletAgg>();
  for (const c of currentList) {
    if (c.outlet) currentMap.set(c.outlet, c);
  }

  // Union of all outlets
  const allOutletNames = new Set<string>([
    ...currentMap.keys(),
    ...prevMap.keys(),
  ]);

  const items: OutletComparisonItem[] = [];

  for (const outlet of allOutletNames) {
    const cur = currentMap.get(outlet);
    const prev = prevMap.get(outlet);

    const curRev = cur ? cur.revenue : 0;
    const prevRev = prev ? prev.revenue : 0;
    const diffRev = curRev - prevRev;

    const curTxn = cur ? cur.transactions : 0;
    const prevTxn = prev ? prev.transactions : 0;
    const diffTxn = curTxn - prevTxn;

    const curAov = cur ? cur.avgPerTxn : 0;
    const prevAov = prev ? prev.avgPerTxn : 0;
    const diffAov = curAov - prevAov;

    let pctChange = 0;
    let status: OutletComparisonItem["status"] = "stable";

    if (prevRev > 0) {
      pctChange = ((curRev - prevRev) / prevRev) * 100;
      if (diffRev < -1) {
        status = curRev === 0 ? "inactive" : "down";
      } else if (diffRev > 1) {
        status = "up";
      } else {
        status = "stable";
      }
    } else if (curRev > 0) {
      pctChange = 100;
      status = "new";
    }

    items.push({
      outlet,
      currentRevenue: curRev,
      prevRevenue: prevRev,
      diffRevenue: diffRev,
      pctChange,
      currentTransactions: curTxn,
      prevTransactions: prevTxn,
      diffTransactions: diffTxn,
      currentAov: curAov,
      prevAov: prevAov,
      diffAov,
      status,
    });
  }

  // Declining outlets: diffRevenue < 0, sorted by biggest drop first (most negative diffRevenue)
  const declining = items
    .filter((it) => it.diffRevenue < 0)
    .sort((a, b) => a.diffRevenue - b.diffRevenue);

  // Growing outlets: diffRevenue > 0, sorted by biggest increase first
  const growing = items
    .filter((it) => it.diffRevenue > 0)
    .sort((a, b) => b.diffRevenue - a.diffRevenue);

  const stable = items.filter((it) => it.diffRevenue === 0);

  const totalDecliningRevenue = declining.reduce(
    (sum, it) => sum + Math.abs(it.diffRevenue),
    0,
  );
  const totalDecliningTxn = declining.reduce(
    (sum, it) => sum + Math.abs(it.diffTransactions < 0 ? it.diffTransactions : 0),
    0,
  );

  return {
    items,
    declining,
    growing,
    stable,
    totalDecliningRevenue,
    totalDecliningTxn,
    decliningCount: declining.length,
    growingCount: growing.length,
    stableCount: stable.length,
    totalOutlets: items.length,
  };
}
