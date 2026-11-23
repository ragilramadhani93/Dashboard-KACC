import type { TransactionRecord, KpiSummary } from "@/lib/types";
import { formatRupiah, formatNumber, formatPct, cleanOutletName } from "@/lib/format";

export interface HourlyComparisonPoint {
  hour: number;
  label: string; // e.g. "08:00"
  targetRevenue: number;
  compareRevenue: number;
  diffRevenue: number;
  targetTxn: number;
  compareTxn: number;
}

export interface DailyItemComparison {
  item: string;
  category: string;
  targetQty: number;
  compareQty: number;
  diffQty: number;
  pctQtyChange: number;
  targetRevenue: number;
  compareRevenue: number;
  diffRevenue: number;
  pctRevenueChange: number;
  isZeroToday: boolean;
}

export interface DailyOutletComparison {
  outlet: string;
  targetRevenue: number;
  compareRevenue: number;
  diffRevenue: number;
  pctChange: number;
  targetTxn: number;
  compareTxn: number;
  diffTxn: number;
  isZeroToday: boolean;
}

export interface DailyComparisonResult {
  targetDate: string;
  compareDate: string;
  targetKpi: {
    revenue: number;
    transactions: number;
    items: number;
    aov: number;
    outlets: number;
    peakHour: number;
  };
  compareKpi: {
    revenue: number;
    transactions: number;
    items: number;
    aov: number;
    outlets: number;
    peakHour: number;
  };
  deltas: {
    revenue: number;
    revenuePct: number;
    transactions: number;
    transactionsPct: number;
    items: number;
    itemsPct: number;
    aov: number;
    aovPct: number;
    outlets: number;
  };
  rootCause: {
    direction: "down" | "up" | "stable";
    primaryDriver: "traffic" | "basket_size" | "balanced" | "closed_outlets";
    explanation: string;
    trafficEffect: number; // impact of transaction count difference in Rupiah
    basketEffect: number; // impact of AOV difference in Rupiah
    topDropHour: {
      hour: number;
      label: string;
      diffRevenue: number;
      targetRevenue: number;
      compareRevenue: number;
    } | null;
  };
  hourly: HourlyComparisonPoint[];
  items: {
    declining: DailyItemComparison[];
    growing: DailyItemComparison[];
    zeroToday: DailyItemComparison[];
    totalDecliningRevenue: number;
    totalDecliningQty: number;
  };
  outlets: {
    declining: DailyOutletComparison[];
    growing: DailyOutletComparison[];
    zeroToday: DailyOutletComparison[];
    totalDecliningRevenue: number;
  };
  summaryPoints: string[];
  recommendations: string[];
}

/**
 * Filter records for a specific single date
 */
function getRecordsForDate(records: TransactionRecord[], date: string): TransactionRecord[] {
  return records.filter((r) => r.status === "Close" && r.date === date);
}

/**
 * Compute single day KPI
 */
function computeSingleDayKpi(records: TransactionRecord[]) {
  let revenue = 0;
  let items = 0;
  const txnSet = new Set<string>();
  const outletSet = new Set<string>();
  const hourBuckets: Record<number, number> = {};

  for (const r of records) {
    revenue += r.grandTotal;
    items += r.qty;
    txnSet.add(r.txn);
    if (r.outlet) outletSet.add(r.outlet);
    if (r.hour >= 0) {
      hourBuckets[r.hour] = (hourBuckets[r.hour] || 0) + r.grandTotal;
    }
  }

  const transactions = txnSet.size;
  const aov = transactions > 0 ? revenue / transactions : 0;

  let peakHour = 0;
  let peakVal = -1;
  for (const h of Object.keys(hourBuckets)) {
    const v = hourBuckets[Number(h)];
    if (v > peakVal) {
      peakVal = v;
      peakHour = Number(h);
    }
  }

  return {
    revenue,
    transactions,
    items,
    aov,
    outlets: outletSet.size,
    peakHour,
    hourBuckets,
  };
}

export function computeDailyComparison(
  allRecords: TransactionRecord[],
  targetDate: string,
  compareDate: string,
): DailyComparisonResult {
  const targetRecords = getRecordsForDate(allRecords, targetDate);
  const compareRecords = getRecordsForDate(allRecords, compareDate);

  const tKpi = computeSingleDayKpi(targetRecords);
  const cKpi = computeSingleDayKpi(compareRecords);

  // Deltas
  const diffRevenue = tKpi.revenue - cKpi.revenue;
  const pctRevenueChange = cKpi.revenue > 0 ? (diffRevenue / cKpi.revenue) * 100 : tKpi.revenue > 0 ? 100 : 0;

  const diffTxn = tKpi.transactions - cKpi.transactions;
  const pctTxnChange = cKpi.transactions > 0 ? (diffTxn / cKpi.transactions) * 100 : tKpi.transactions > 0 ? 100 : 0;

  const diffItems = tKpi.items - cKpi.items;
  const pctItemsChange = cKpi.items > 0 ? (diffItems / cKpi.items) * 100 : tKpi.items > 0 ? 100 : 0;

  const diffAov = tKpi.aov - cKpi.aov;
  const pctAovChange = cKpi.aov > 0 ? (diffAov / cKpi.aov) * 100 : tKpi.aov > 0 ? 100 : 0;

  const diffOutlets = tKpi.outlets - cKpi.outlets;

  // Root cause decomposition:
  // Revenue = Txn * AOV
  // ΔRevenue ≈ (ΔTxn * PrevAOV) + (CurrTxn * ΔAOV)
  const trafficEffect = diffTxn * cKpi.aov;
  const basketEffect = tKpi.transactions * diffAov;

  let direction: "down" | "up" | "stable" = "stable";
  if (diffRevenue < -1000) direction = "down";
  else if (diffRevenue > 1000) direction = "up";

  let primaryDriver: "traffic" | "basket_size" | "balanced" | "closed_outlets" = "balanced";
  let explanation = "";

  if (direction === "down") {
    if (diffOutlets < -2) {
      primaryDriver = "closed_outlets";
      explanation = `Penurunan omzet sangat dipengaruhi oleh berkurangnya ${Math.abs(diffOutlets)} outlet aktif pada hari ini dibanding kemarin.`;
    } else if (Math.abs(trafficEffect) > Math.abs(basketEffect) * 1.5) {
      primaryDriver = "traffic";
      explanation = `Faktor utama penurunan adalah berkurangnya jumlah transaksi (traffic pembeli) sebesar ${Math.abs(diffTxn)} transaksi (${formatPct(Math.abs(pctTxnChange))}), yang berkontribusi sekitar ${formatRupiah(Math.abs(trafficEffect))} terhadap hilangnya omzet.`;
    } else if (Math.abs(basketEffect) > Math.abs(trafficEffect) * 1.5) {
      primaryDriver = "basket_size";
      explanation = `Faktor utama penurunan adalah mengecilnya nilai rata-rata belanja per struk (AOV) dari ${formatRupiah(cKpi.aov)} menjadi ${formatRupiah(tKpi.aov)} (${formatPct(pctAovChange)}), meskipun jumlah struk relatif terjaga.`;
    } else {
      primaryDriver = "balanced";
      explanation = `Penurunan terjadi secara kombinasi akibat berkurangnya volume transaksi (${diffTxn} txn) sekaligus penurunan nilai belanja per struk (${formatRupiah(diffAov)} per txn).`;
    }
  } else if (direction === "up") {
    if (Math.abs(trafficEffect) > Math.abs(basketEffect) * 1.3) {
      primaryDriver = "traffic";
      explanation = `Pertumbuhan omzet didorong oleh lonjakan transaksi (+${diffTxn} transaksi / +${formatPct(pctTxnChange)}).`;
    } else if (Math.abs(basketEffect) > Math.abs(trafficEffect) * 1.3) {
      primaryDriver = "basket_size";
      explanation = `Pertumbuhan omzet didorong oleh peningkatan nilai belanja per struk (AOV naik +${formatRupiah(diffAov)} / +${formatPct(pctAovChange)}).`;
    } else {
      primaryDriver = "balanced";
      explanation = `Kinerja positif hari ini merupakan kombinasi dari kenaikan jumlah transaksi (+${diffTxn}) dan kenaikan nilai belanja rata-rata (+${formatRupiah(diffAov)}).`;
    }
  } else {
    explanation = "Kinerja penjualan hari ini relatif stabil dan sebanding dengan hari kemarin.";
  }

  // Hourly comparison
  const hourly: HourlyComparisonPoint[] = [];
  let topDropHour: DailyComparisonResult["rootCause"]["topDropHour"] = null;
  let maxHourlyDrop = 0;

  for (let h = 6; h <= 22; h++) {
    const tRev = tKpi.hourBuckets[h] || 0;
    const cRev = cKpi.hourBuckets[h] || 0;
    const diffH = tRev - cRev;

    // Count txns in this hour
    const tTxn = new Set(targetRecords.filter((r) => r.hour === h).map((r) => r.txn)).size;
    const cTxn = new Set(compareRecords.filter((r) => r.hour === h).map((r) => r.txn)).size;

    const label = `${String(h).padStart(2, "0")}:00`;
    hourly.push({
      hour: h,
      label,
      targetRevenue: tRev,
      compareRevenue: cRev,
      diffRevenue: diffH,
      targetTxn: tTxn,
      compareTxn: cTxn,
    });

    if (diffH < -maxHourlyDrop) {
      maxHourlyDrop = Math.abs(diffH);
      topDropHour = {
        hour: h,
        label,
        diffRevenue: diffH,
        targetRevenue: tRev,
        compareRevenue: cRev,
      };
    }
  }

  // Item comparison
  const itemMap = new Map<
    string,
    {
      category: string;
      targetQty: number;
      compareQty: number;
      targetRevenue: number;
      compareRevenue: number;
    }
  >();

  for (const r of targetRecords) {
    if (!r.item) continue;
    if (!itemMap.has(r.item)) {
      itemMap.set(r.item, {
        category: r.itemCategory || "Other",
        targetQty: 0,
        compareQty: 0,
        targetRevenue: 0,
        compareRevenue: 0,
      });
    }
    const entry = itemMap.get(r.item)!;
    entry.targetQty += r.qty;
    entry.targetRevenue += r.grandTotal;
  }

  for (const r of compareRecords) {
    if (!r.item) continue;
    if (!itemMap.has(r.item)) {
      itemMap.set(r.item, {
        category: r.itemCategory || "Other",
        targetQty: 0,
        compareQty: 0,
        targetRevenue: 0,
        compareRevenue: 0,
      });
    }
    const entry = itemMap.get(r.item)!;
    entry.compareQty += r.qty;
    entry.compareRevenue += r.grandTotal;
  }

  const allItems: DailyItemComparison[] = [];
  for (const [item, e] of itemMap.entries()) {
    const diffQty = e.targetQty - e.compareQty;
    const diffRev = e.targetRevenue - e.compareRevenue;
    const pctQty = e.compareQty > 0 ? (diffQty / e.compareQty) * 100 : e.targetQty > 0 ? 100 : 0;
    const pctRev = e.compareRevenue > 0 ? (diffRev / e.compareRevenue) * 100 : e.targetRevenue > 0 ? 100 : 0;
    const isZeroToday = e.compareQty > 0 && e.targetQty === 0;

    allItems.push({
      item,
      category: e.category,
      targetQty: e.targetQty,
      compareQty: e.compareQty,
      diffQty,
      pctQtyChange: pctQty,
      targetRevenue: e.targetRevenue,
      compareRevenue: e.compareRevenue,
      diffRevenue: diffRev,
      pctRevenueChange: pctRev,
      isZeroToday,
    });
  }

  const decliningItems = allItems
    .filter((it) => it.diffRevenue < -100 || it.diffQty < 0)
    .sort((a, b) => a.diffRevenue - b.diffRevenue);

  const growingItems = allItems
    .filter((it) => it.diffRevenue > 100 || it.diffQty > 0)
    .sort((a, b) => b.diffRevenue - a.diffRevenue);

  const zeroTodayItems = allItems
    .filter((it) => it.isZeroToday)
    .sort((a, b) => b.compareQty - a.compareQty);

  const totalDecliningRevenue = decliningItems.reduce((s, it) => s + Math.abs(it.diffRevenue), 0);
  const totalDecliningQty = decliningItems.reduce((s, it) => s + Math.abs(it.diffQty < 0 ? it.diffQty : 0), 0);

  // Outlet comparison
  const outletMap = new Map<
    string,
    {
      targetRevenue: number;
      compareRevenue: number;
      targetTxnSet: Set<string>;
      compareTxnSet: Set<string>;
    }
  >();

  for (const r of targetRecords) {
    if (!r.outlet) continue;
    if (!outletMap.has(r.outlet)) {
      outletMap.set(r.outlet, {
        targetRevenue: 0,
        compareRevenue: 0,
        targetTxnSet: new Set(),
        compareTxnSet: new Set(),
      });
    }
    const e = outletMap.get(r.outlet)!;
    e.targetRevenue += r.grandTotal;
    e.targetTxnSet.add(r.txn);
  }

  for (const r of compareRecords) {
    if (!r.outlet) continue;
    if (!outletMap.has(r.outlet)) {
      outletMap.set(r.outlet, {
        targetRevenue: 0,
        compareRevenue: 0,
        targetTxnSet: new Set(),
        compareTxnSet: new Set(),
      });
    }
    const e = outletMap.get(r.outlet)!;
    e.compareRevenue += r.grandTotal;
    e.compareTxnSet.add(r.txn);
  }

  const allOutlets: DailyOutletComparison[] = [];
  for (const [outlet, e] of outletMap.entries()) {
    const diffRev = e.targetRevenue - e.compareRevenue;
    const pct = e.compareRevenue > 0 ? (diffRev / e.compareRevenue) * 100 : e.targetRevenue > 0 ? 100 : 0;
    const targetTxn = e.targetTxnSet.size;
    const compareTxn = e.compareTxnSet.size;
    const diffTxn = targetTxn - compareTxn;
    const isZeroToday = compareTxn > 0 && targetTxn === 0;

    allOutlets.push({
      outlet,
      targetRevenue: e.targetRevenue,
      compareRevenue: e.compareRevenue,
      diffRevenue: diffRev,
      pctChange: pct,
      targetTxn,
      compareTxn,
      diffTxn,
      isZeroToday,
    });
  }

  const decliningOutlets = allOutlets
    .filter((o) => o.diffRevenue < -100)
    .sort((a, b) => a.diffRevenue - b.diffRevenue);

  const growingOutlets = allOutlets
    .filter((o) => o.diffRevenue > 100)
    .sort((a, b) => b.diffRevenue - a.diffRevenue);

  const zeroTodayOutlets = allOutlets
    .filter((o) => o.isZeroToday)
    .sort((a, b) => b.compareRevenue - a.compareRevenue);

  const totalOutletDecliningRevenue = decliningOutlets.reduce((s, o) => s + Math.abs(o.diffRevenue), 0);

  // Generate actionable summary points
  const summaryPoints: string[] = [];
  if (direction === "down") {
    summaryPoints.push(
      `Omzet harian turun sebesar -${formatRupiah(Math.abs(diffRevenue))} (${formatPct(Math.abs(pctRevenueChange))}) dibanding hari kemarin (${formatRupiah(tKpi.revenue)} vs ${formatRupiah(cKpi.revenue)}).`,
    );
    summaryPoints.push(explanation);
    if (topDropHour) {
      summaryPoints.push(
        `Waktu penurunan terdalam terjadi pada jam ${topDropHour.label} dengan kontraksi omzet sebesar -${formatRupiah(Math.abs(topDropHour.diffRevenue))}.`,
      );
    }
    if (decliningItems.length > 0) {
      const top3Items = decliningItems.slice(0, 3).map((it) => `${it.item} (-${Math.abs(it.diffQty)} cup / -${formatRupiah(Math.abs(it.diffRevenue))})`).join(", ");
      summaryPoints.push(`Menu yang paling membebani penurunan: ${top3Items}.`);
    }
    if (zeroTodayItems.length > 0) {
      summaryPoints.push(
        `Terdapat ${zeroTodayItems.length} menu yang terjual kemarin namun mencatat 0 penjualan hari ini (indikasi kuat stock-out / bahan habis).`,
      );
    }
    if (decliningOutlets.length > 0) {
      const topOutlet = cleanOutletName(decliningOutlets[0].outlet);
      summaryPoints.push(
        `Outlet dengan kontraksi terbesar adalah ${topOutlet} dengan penurunan omzet -${formatRupiah(Math.abs(decliningOutlets[0].diffRevenue))} (-${Math.abs(decliningOutlets[0].diffTxn)} transaksi).`,
      );
    }
  } else if (direction === "up") {
    summaryPoints.push(
      `Omzet harian tumbuh sebesar +${formatRupiah(diffRevenue)} (+${formatPct(pctRevenueChange)}) dibanding hari kemarin.`,
    );
    summaryPoints.push(explanation);
    if (growingItems.length > 0) {
      const top3Items = growingItems.slice(0, 3).map((it) => `${it.item} (+${it.diffQty} cup)`).join(", ");
      summaryPoints.push(`Pendorong pertumbuhan utama berasal dari menu: ${top3Items}.`);
    }
  } else {
    summaryPoints.push("Performa penjualan hari ini stabil dan konsisten dengan hari kemarin.");
  }

  // Recommendations
  const recommendations: string[] = [];
  if (direction === "down") {
    if (zeroTodayItems.length > 0) {
      recommendations.push(
        `Segera lakukan pengecekan fisik stok bahan baku untuk ${zeroTodayItems.slice(0, 2).map((i) => i.item).join(" dan ")} di outlet yang terdampak.`,
      );
    }
    if (primaryDriver === "traffic" && topDropHour) {
      recommendations.push(
        `Evaluasi antrian dan kecepatan saji (speed of service) pada jam sibuk ${topDropHour.label} untuk menghindari pelanggan batal transaksi (walk-out).`,
      );
    }
    if (primaryDriver === "basket_size") {
      recommendations.push(
        "Terapkan briefing kasir untuk aktif menawarkan add-on pastry / snack (cross-selling) guna mendongkrak kembali nilai AOV.",
      );
    }
    if (decliningOutlets.length > 0) {
      recommendations.push(
        `Lakukan koordinasi dengan store supervisor di ${cleanOutletName(decliningOutlets[0].outlet)} untuk mengevaluasi penyebab penurunan penjualan hari ini.`,
      );
    }
  } else {
    recommendations.push("Pertahankan ketersediaan stok menu pendorong utama dan kelancaran alur kasir pada jam sibuk.");
    recommendations.push("Jadikan pola penjualan hari ini sebagai benchmark operasional untuk hari berikutnya.");
  }

  return {
    targetDate,
    compareDate,
    targetKpi: {
      revenue: tKpi.revenue,
      transactions: tKpi.transactions,
      items: tKpi.items,
      aov: tKpi.aov,
      outlets: tKpi.outlets,
      peakHour: tKpi.peakHour,
    },
    compareKpi: {
      revenue: cKpi.revenue,
      transactions: cKpi.transactions,
      items: cKpi.items,
      aov: cKpi.aov,
      outlets: cKpi.outlets,
      peakHour: cKpi.peakHour,
    },
    deltas: {
      revenue: diffRevenue,
      revenuePct: pctRevenueChange,
      transactions: diffTxn,
      transactionsPct: pctTxnChange,
      items: diffItems,
      itemsPct: pctItemsChange,
      aov: diffAov,
      aovPct: pctAovChange,
      outlets: diffOutlets,
    },
    rootCause: {
      direction,
      primaryDriver,
      explanation,
      trafficEffect,
      basketEffect,
      topDropHour,
    },
    hourly,
    items: {
      declining: decliningItems,
      growing: growingItems,
      zeroToday: zeroTodayItems,
      totalDecliningRevenue,
      totalDecliningQty,
    },
    outlets: {
      declining: decliningOutlets,
      growing: growingOutlets,
      zeroToday: zeroTodayOutlets,
      totalDecliningRevenue: totalOutletDecliningRevenue,
    },
    summaryPoints,
    recommendations,
  };
}
