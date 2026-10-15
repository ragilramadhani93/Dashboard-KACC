"use client";
import { useMemo } from "react";
import { Clock, Coffee, Store, CreditCard, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  formatRupiah,
  formatNumber,
  formatPct,
} from "@/lib/format";
import { formatDateLong } from "@/lib/dashboard/aggregate";
import type { TransactionRecord } from "@/lib/types";

interface HourlyDrilldownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hour 0-23 that was clicked. Null if closed. */
  hour: number | null;
  /** All filtered records for the current date range & filters. */
  records: TransactionRecord[];
  /** Date range being viewed (for context in header). */
  dateRange: { start: string; end: string };
}

interface ItemRow {
  item: string;
  category: string;
  qty: number;
  revenue: number;
  transactions: number;
}

interface OutletRow {
  outlet: string;
  revenue: number;
  transactions: number;
  items: number;
}

interface PaymentRow {
  payment: string;
  revenue: number;
  transactions: number;
  share: number;
}

const categoryColor: Record<string, string> = {
  Coffee: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  "Non-Coffee": "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  Packaging: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  Merchandise: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  Other: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

export function HourlyDrilldownDialog({
  open,
  onOpenChange,
  hour,
  records,
  dateRange,
}: HourlyDrilldownDialogProps) {
  const hourRecords = useMemo(() => {
    if (hour === null) return [];
    return records.filter((r) => r.hour === hour && r.status === "Close");
  }, [records, hour]);

  // Aggregate items
  const itemsAgg = useMemo<ItemRow[]>(() => {
    const map = new Map<string, ItemRow>();
    for (const r of hourRecords) {
      if (!map.has(r.item)) {
        map.set(r.item, {
          item: r.item,
          category: r.itemCategory,
          qty: 0,
          revenue: 0,
          transactions: 0,
        });
      }
      const e = map.get(r.item)!;
      e.qty += r.qty;
      e.revenue += r.grandTotal;
      e.transactions += 1;
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }, [hourRecords]);

  // Aggregate outlets
  const outletsAgg = useMemo<OutletRow[]>(() => {
    const map = new Map<string, { revenue: number; transactions: Set<string>; items: number }>();
    for (const r of hourRecords) {
      if (!map.has(r.outlet)) {
        map.set(r.outlet, { revenue: 0, transactions: new Set(), items: 0 });
      }
      const e = map.get(r.outlet)!;
      e.revenue += r.grandTotal;
      e.transactions.add(r.txn);
      e.items += r.qty;
    }
    return [...map.entries()]
      .map(([outlet, e]) => ({
        outlet,
        revenue: e.revenue,
        transactions: e.transactions.size,
        items: e.items,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [hourRecords]);

  // Aggregate payments
  const paymentsAgg = useMemo<PaymentRow[]>(() => {
    const map = new Map<string, { revenue: number; transactions: Set<string> }>();
    let totalRev = 0;
    for (const r of hourRecords) {
      if (!map.has(r.payment)) {
        map.set(r.payment, { revenue: 0, transactions: new Set() });
      }
      const e = map.get(r.payment)!;
      e.revenue += r.grandTotal;
      e.transactions.add(r.txn);
      totalRev += r.grandTotal;
    }
    return [...map.entries()]
      .map(([payment, e]) => ({
        payment,
        revenue: e.revenue,
        transactions: e.transactions.size,
        share: totalRev > 0 ? (e.revenue / totalRev) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [hourRecords]);

  const totals = useMemo(() => {
    const revenue = hourRecords.reduce((s, r) => s + r.grandTotal, 0);
    const items = hourRecords.reduce((s, r) => s + r.qty, 0);
    const txnSet = new Set(hourRecords.map((r) => r.txn));
    const transactions = txnSet.size;
    const aov = transactions > 0 ? revenue / transactions : 0;
    return { revenue, items, transactions, aov };
  }, [hourRecords]);

  const hourStr = hour !== null ? `${String(hour).padStart(2, "0")}:00` : "";
  const hourEnd = hour !== null ? `${String((hour + 1) % 24).padStart(2, "0")}:00` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-purple-300" />
            Drill-down Jam {hourStr} - {hourEnd}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Periode: {formatDateLong(dateRange.start)} → {formatDateLong(dateRange.end)}.
            Menampilkan {formatNumber(hourRecords.length)} line items dari{" "}
            {formatNumber(totals.transactions)} transaksi unik.
          </DialogDescription>
        </DialogHeader>

        {/* Summary KPI */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Revenue
            </div>
            <div className="text-sm font-bold tabular-nums text-emerald-300">
              {formatRupiah(totals.revenue, false)}
            </div>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Transaksi
            </div>
            <div className="text-sm font-bold tabular-nums text-cyan-300">
              {formatNumber(totals.transactions)}
            </div>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Item Terjual
            </div>
            <div className="text-sm font-bold tabular-nums text-amber-300">
              {formatNumber(totals.items)}
            </div>
          </div>
          <div className="rounded-lg border border-pink-500/20 bg-pink-500/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              AOV
            </div>
            <div className="text-sm font-bold tabular-nums text-pink-300">
              {formatRupiah(totals.aov, false)}
            </div>
          </div>
        </div>

        {/* Top Items */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Coffee className="h-3.5 w-3.5 text-pink-300" />
            Top Item Terjual di Jam {hourStr}
            <span className="text-[10px] text-muted-foreground">
              ({itemsAgg.length} item unik)
            </span>
          </h3>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-white/5">
            <table className="w-full">
              <thead className="sticky top-0 border-b border-white/5 bg-card/80 backdrop-blur">
                <tr>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    #
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Item
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Kategori
                  </th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Qty
                  </th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {itemsAgg.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-center text-xs text-muted-foreground">
                      Tidak ada data item untuk jam ini
                    </td>
                  </tr>
                )}
                {itemsAgg.slice(0, 50).map((it, i) => {
                  const maxQty = itemsAgg[0]?.qty || 1;
                  const barWidth = (it.qty / maxQty) * 100;
                  return (
                    <tr
                      key={it.item}
                      className="border-b border-white/5 transition-colors hover:bg-white/5"
                    >
                      <td className="px-2 py-1.5 text-[10px] font-mono text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-foreground" title={it.item}>
                            {it.item}
                          </span>
                          <div className="hidden sm:block h-1 w-16 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-pink-400/70"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
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
                      <td className="px-2 py-1.5 text-right text-[11px] font-bold tabular-nums text-amber-300">
                        {formatNumber(it.qty)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-[11px] font-bold tabular-nums text-foreground">
                        {formatRupiah(it.revenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Top Outlets + Payment mix side-by-side */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Store className="h-3.5 w-3.5 text-cyan-300" />
              Kontribusi Outlet
              <span className="text-[10px] text-muted-foreground">
                ({outletsAgg.length} outlet)
              </span>
            </h3>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-white/5">
              <table className="w-full">
                <thead className="sticky top-0 border-b border-white/5 bg-card/80 backdrop-blur">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Outlet
                    </th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Revenue
                    </th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Txn
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {outletsAgg.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-2 py-4 text-center text-[10px] text-muted-foreground">
                        Tidak ada data outlet
                      </td>
                    </tr>
                  )}
                  {outletsAgg.slice(0, 15).map((o) => {
                    const outletName = o.outlet.replace(/^KACC\s*-\s*/i, "").trim();
                    return (
                      <tr
                        key={o.outlet}
                        className="border-b border-white/5 transition-colors hover:bg-white/5"
                      >
                        <td className="px-2 py-1.5 text-[11px] text-foreground" title={o.outlet}>
                          {outletName}
                        </td>
                        <td className="px-2 py-1.5 text-right text-[11px] font-bold tabular-nums text-foreground">
                          {formatRupiah(o.revenue)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatNumber(o.transactions)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <CreditCard className="h-3.5 w-3.5 text-amber-300" />
              Mix Pembayaran
            </h3>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-white/5">
              <table className="w-full">
                <thead className="sticky top-0 border-b border-white/5 bg-card/80 backdrop-blur">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Payment
                    </th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Revenue
                    </th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsAgg.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-2 py-4 text-center text-[10px] text-muted-foreground">
                        Tidak ada data payment
                      </td>
                    </tr>
                  )}
                  {paymentsAgg.map((p) => (
                    <tr
                      key={p.payment}
                      className="border-b border-white/5 transition-colors hover:bg-white/5"
                    >
                      <td className="px-2 py-1.5 text-[11px] text-foreground">
                        {p.payment}
                      </td>
                      <td className="px-2 py-1.5 text-right text-[11px] font-bold tabular-nums text-foreground">
                        {formatRupiah(p.revenue)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                        {formatPct(p.share)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Footer hint */}
        <div className="rounded-md bg-purple-500/5 px-3 py-2 text-[10px] text-purple-300">
          <TrendingUp className="mr-1 inline h-3 w-3" />
          Data ini hanya untuk jam {hourStr} - {hourEnd} (range periode aktif).
          Tutup dialog untuk lihat jam lain.
        </div>
      </DialogContent>
    </Dialog>
  );
}
