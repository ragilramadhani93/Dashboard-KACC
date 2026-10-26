"use client";
import { useState } from "react";
import { Calendar, Store, CreditCard, Coffee, X, ChevronDown, GitCompareArrows, RotateCcw, CalendarClock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  useDashboardStore,
  computeCompareRange,
  type PresetRange,
} from "@/lib/dashboard/store";

interface FilterBarProps {
  dataRange: { start: string; end: string };
  outlets: string[];
  paymentMethods: string[];
  itemCategories: string[];
  /** Optional: cross-sheet compare (vs sheet bulan lalu) */
  onToggleCrossSheetCompare?: () => void;
}

const PRESET_OPTIONS: Array<{ value: PresetRange; label: string }> = [
  { value: "today", label: "Hari Ini" },
  { value: "yesterday", label: "Kemarin" },
  { value: "last7", label: "7 Hari" },
  { value: "last14", label: "14 Hari" },
  { value: "last30", label: "30 Hari" },
  { value: "mtd", label: "Bulan Berjalan" },
  { value: "all", label: "Semua Data" },
];

export function FilterBar({
  dataRange,
  outlets,
  paymentMethods,
  itemCategories,
  onToggleCrossSheetCompare,
}: FilterBarProps) {
  const {
    preset,
    dateStart,
    dateEnd,
    outlets: selOutlets,
    payments: selPayments,
    itemCategories: selCats,
    compareEnabled,
    // Cross-sheet compare state
    crossSheetCompareEnabled,
    crossSheetLoading,
    crossSheetAvailable,
    crossSheetPrevSourceLabel,
    crossSheetPrevDateStart,
    crossSheetPrevDateEnd,
    setPreset,
    setDateRange,
    toggleOutlet,
    clearOutlets,
    togglePayment,
    clearPayments,
    toggleItemCategory,
    clearItemCategories,
    setCompareEnabled,
    resetAllFilters,
  } = useDashboardStore();

  const [customStart, setCustomStart] = useState(dateStart);
  const [customEnd, setCustomEnd] = useState(dateEnd);

  const totalActiveFilters =
    selOutlets.length + selPayments.length + selCats.length;

  return (
    <div className="rounded-xl border border-white/10 bg-card/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Date range presets */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-white/10 bg-white/5 text-xs hover:bg-white/10"
            >
              <Calendar className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-medium">
                {PRESET_OPTIONS.find((p) => p.value === preset)?.label ?? "Pilih Rentang"}
              </span>
              <span className="text-muted-foreground">
                {dateStart === dateEnd
                  ? `(${dateStart})`
                  : `(${dateStart} → ${dateEnd})`}
              </span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Rentang Cepat
            </DropdownMenuLabel>
            {PRESET_OPTIONS.map((p) => (
              <DropdownMenuCheckboxItem
                key={p.value}
                checked={preset === p.value}
                onCheckedChange={() => setPreset(p.value, dataRange)}
                className="text-xs"
              >
                {p.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Custom Range
            </DropdownMenuLabel>
            <div className="flex flex-col gap-2 p-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground">Dari</label>
                <input
                  type="date"
                  value={customStart}
                  min={dataRange.start}
                  max={dataRange.end}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-foreground"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground">Sampai</label>
                <input
                  type="date"
                  value={customEnd}
                  min={dataRange.start}
                  max={dataRange.end}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-foreground"
                />
              </div>
              <Button
                size="sm"
                className="mt-1 h-7 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25"
                onClick={() => {
                  if (customStart && customEnd && customStart <= customEnd) {
                    setDateRange(customStart, customEnd);
                  }
                }}
              >
                Terapkan Rentang
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Outlet filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 border-white/10 bg-white/5 text-xs hover:bg-white/10",
                selOutlets.length > 0 && "border-emerald-500/30 bg-emerald-500/10",
              )}
            >
              <Store className="h-3.5 w-3.5 text-emerald-400" />
              <span>Outlet</span>
              {selOutlets.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">
                  {selOutlets.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[400px] w-[280px] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/5 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {selOutlets.length} dari {outlets.length} dipilih
              </span>
              {selOutlets.length > 0 && (
                <button
                  className="text-[10px] text-red-400 hover:underline"
                  onClick={clearOutlets}
                >
                  Reset
                </button>
              )}
            </div>
            {outlets.map((o) => (
              <DropdownMenuCheckboxItem
                key={o}
                checked={selOutlets.includes(o)}
                onCheckedChange={() => toggleOutlet(o)}
                className="text-xs"
              >
                {o.replace(/^KACC\s*-\s*/i, "").trim()}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Payment filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 border-white/10 bg-white/5 text-xs hover:bg-white/10",
                selPayments.length > 0 && "border-amber-500/30 bg-amber-500/10",
              )}
            >
              <CreditCard className="h-3.5 w-3.5 text-amber-400" />
              <span>Pembayaran</span>
              {selPayments.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">
                  {selPayments.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            <div className="flex items-center justify-between border-b border-white/5 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {selPayments.length} dari {paymentMethods.length} dipilih
              </span>
              {selPayments.length > 0 && (
                <button
                  className="text-[10px] text-red-400 hover:underline"
                  onClick={clearPayments}
                >
                  Reset
                </button>
              )}
            </div>
            {paymentMethods.map((p) => (
              <DropdownMenuCheckboxItem
                key={p}
                checked={selPayments.includes(p)}
                onCheckedChange={() => togglePayment(p)}
                className="text-xs"
              >
                {p}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Menu category filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 border-white/10 bg-white/5 text-xs hover:bg-white/10",
                selCats.length > 0 && "border-pink-500/30 bg-pink-500/10",
              )}
            >
              <Coffee className="h-3.5 w-3.5 text-pink-400" />
              <span>Kategori Menu</span>
              {selCats.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">
                  {selCats.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            <div className="flex items-center justify-between border-b border-white/5 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {selCats.length} dari {itemCategories.length} dipilih
              </span>
              {selCats.length > 0 && (
                <button
                  className="text-[10px] text-red-400 hover:underline"
                  onClick={clearItemCategories}
                >
                  Reset
                </button>
              )}
            </div>
            {itemCategories.map((c) => (
              <DropdownMenuCheckboxItem
                key={c}
                checked={selCats.includes(c)}
                onCheckedChange={() => toggleItemCategory(c)}
                className="text-xs"
              >
                {c}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Compare mode toggle (within-sheet, previous N days) */}
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-1.5 border-white/10 bg-white/5 text-xs hover:bg-white/10",
            compareEnabled && "border-purple-500/40 bg-purple-500/15 text-purple-300",
          )}
          onClick={() => setCompareEnabled(!compareEnabled)}
          title="Compare dengan periode sebelumnya dalam sheet yang sama (mis. minggu lalu)"
        >
          <GitCompareArrows className="h-3.5 w-3.5" />
          <span>Compare Mode</span>
          {compareEnabled && (
            <span className="text-[10px] text-muted-foreground">
              vs {useDashboardStore.getState().prevDateStart} → {useDashboardStore.getState().prevDateEnd}
            </span>
          )}
        </Button>

        {/* Cross-sheet compare toggle (vs sheet bulan lalu, same day-of-month) */}
        {onToggleCrossSheetCompare && (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5 border-white/10 bg-white/5 text-xs hover:bg-white/10",
              crossSheetCompareEnabled && "border-amber-500/40 bg-amber-500/15 text-amber-300",
            )}
            onClick={onToggleCrossSheetCompare}
            disabled={crossSheetLoading}
            title="Compare dengan tanggal yang sama di sheet bulan lalu (mis. 8-14 Okt vs 8-14 Sep)"
          >
            {crossSheetLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CalendarClock className="h-3.5 w-3.5" />
            )}
            <span>vs Bulan Lalu</span>
            {crossSheetCompareEnabled && crossSheetAvailable && (
              <span className="text-[10px] text-muted-foreground">
                {crossSheetPrevSourceLabel
                  ? `(${crossSheetPrevSourceLabel}, ${crossSheetPrevDateStart} → ${crossSheetPrevDateEnd})`
                  : `(${crossSheetPrevDateStart} → ${crossSheetPrevDateEnd})`}
              </span>
            )}
            {crossSheetCompareEnabled && !crossSheetAvailable && !crossSheetLoading && (
              <Badge variant="outline" className="h-4 px-1 text-[9px] border-red-500/40 bg-red-500/10 text-red-400">
                N/A
              </Badge>
            )}
          </Button>
        )}

        {/* Reset all */}
        {totalActiveFilters > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs text-muted-foreground hover:text-red-400"
            onClick={resetAllFilters}
          >
            <RotateCcw className="h-3 w-3" />
            Reset Filter
            <X className="h-3 w-3" />
          </Button>
        )}

        {/* Spacer */}
        <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="hidden sm:inline">Data range tersedia:</span>
          <span className="font-mono">
            {dataRange.start || "?"} → {dataRange.end || "?"}
          </span>
        </div>
      </div>
    </div>
  );
}
