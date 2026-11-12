"use client";
import { useEffect, useState } from "react";
import { Calendar, Store, CreditCard, Coffee, X, ChevronDown, GitCompareArrows, RotateCcw, CalendarClock, Loader2, Filter, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  useDashboardStore,
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
    prevDateStart,
    prevDateEnd,
    outlets: selOutlets,
    payments: selPayments,
    itemCategories: selCats,
    compareEnabled,
    // Cross-sheet compare state
    crossSheetCompareEnabled,
    crossSheetLoading,
    // Outlet consistency state
    outletConsistency,
    setOutletConsistency,
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setCustomStart(dateStart);
    setCustomEnd(dateEnd);
  }, [dateStart, dateEnd]);

  const totalActiveFilters =
    selOutlets.length + selPayments.length + selCats.length;
  const advancedActiveCount =
    (compareEnabled ? 1 : 0) +
    (crossSheetCompareEnabled ? 1 : 0) +
    (outletConsistency !== "off" ? 1 : 0);

  const activeChips: Array<{ key: string; group: string; label: string; onRemove: () => void }> = [
    ...selOutlets.map((o) => ({
      key: `outlet-${o}`,
      group: "Outlet",
      label: o.replace(/^KACC\s*-\s*/i, "").trim(),
      onRemove: () => toggleOutlet(o),
    })),
    ...selPayments.map((p) => ({
      key: `payment-${p}`,
      group: "Bayar",
      label: p,
      onRemove: () => togglePayment(p),
    })),
    ...selCats.map((c) => ({
      key: `cat-${c}`,
      group: "Kategori",
      label: c,
      onRemove: () => toggleItemCategory(c),
    })),
  ];

  const activePillClass = "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15";

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Date range presets */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 gap-1.5 text-xs"
            >
              <Calendar aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">
                {PRESET_OPTIONS.find((p) => p.value === preset)?.label ?? "Pilih Rentang"}
              </span>
              <span className="text-muted-foreground">
                {dateStart === dateEnd
                  ? `(${dateStart})`
                  : `(${dateStart} s/d ${dateEnd})`}
              </span>
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
              Rentang Cepat
            </DropdownMenuLabel>
            {PRESET_OPTIONS.map((p) => (
              <DropdownMenuCheckboxItem
                key={p.value}
                checked={preset === p.value}
                onCheckedChange={() => setPreset(p.value, dataRange)}
                className="min-h-9 text-xs"
              >
                {p.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
              Rentang Kustom
            </DropdownMenuLabel>
            <div className="flex flex-col gap-2.5 p-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-date-start" className="text-xs text-muted-foreground">
                  Dari Tanggal
                </label>
                <input
                  id="filter-date-start"
                  type="date"
                  value={customStart}
                  min={dataRange.start}
                  max={dataRange.end}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="min-h-9 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-date-end" className="text-xs text-muted-foreground">
                  Sampai Tanggal
                </label>
                <input
                  id="filter-date-end"
                  type="date"
                  value={customEnd}
                  min={dataRange.start}
                  max={dataRange.end}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="min-h-9 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground"
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="mt-1 min-h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
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
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "min-h-10 gap-1.5 text-xs",
                selOutlets.length > 0 && activePillClass,
              )}
            >
              <Store aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              <span>Outlet</span>
              {selOutlets.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-semibold">
                  {selOutlets.length}
                </Badge>
              )}
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[400px] w-[280px] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border px-2.5 py-2">
              <span className="text-xs font-medium text-muted-foreground">
                {selOutlets.length} dari {outlets.length} dipilih
              </span>
              {selOutlets.length > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-red-700 hover:underline dark:text-red-400"
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
                className="min-h-9 text-xs"
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
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "min-h-10 gap-1.5 text-xs",
                selPayments.length > 0 && activePillClass,
              )}
            >
              <CreditCard aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              <span>Pembayaran</span>
              {selPayments.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-semibold">
                  {selPayments.length}
                </Badge>
              )}
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[230px]">
            <div className="flex items-center justify-between border-b border-border px-2.5 py-2">
              <span className="text-xs font-medium text-muted-foreground">
                {selPayments.length} dari {paymentMethods.length} dipilih
              </span>
              {selPayments.length > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-red-700 hover:underline dark:text-red-400"
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
                className="min-h-9 text-xs"
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
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "min-h-10 gap-1.5 text-xs",
                selCats.length > 0 && activePillClass,
              )}
            >
              <Coffee aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              <span>Kategori Menu</span>
              {selCats.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-semibold">
                  {selCats.length}
                </Badge>
              )}
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[230px]">
            <div className="flex items-center justify-between border-b border-border px-2.5 py-2">
              <span className="text-xs font-medium text-muted-foreground">
                {selCats.length} dari {itemCategories.length} dipilih
              </span>
              {selCats.length > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-red-700 hover:underline dark:text-red-400"
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
                className="min-h-9 text-xs"
              >
                {c}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Mobile toggle for secondary comparison/consistency controls */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={advancedOpen}
          className={cn(
            "min-h-10 gap-1.5 text-xs md:hidden",
            advancedActiveCount > 0 && activePillClass,
          )}
          onClick={() => setAdvancedOpen((prev) => !prev)}
        >
          <GitCompareArrows aria-hidden="true" className="h-3.5 w-3.5" />
          <span>Opsi Lanjutan</span>
          {advancedActiveCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-semibold">
              {advancedActiveCount}
            </Badge>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn("h-3.5 w-3.5 opacity-60 transition-transform", advancedOpen && "rotate-180")}
          />
        </Button>

        <div className={cn(advancedOpen ? "contents" : "hidden md:contents")}>
        {/* Compare mode toggle (within-sheet, previous N days) */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={compareEnabled}
          className={cn(
            "min-h-10 gap-1.5 text-xs",
            compareEnabled && activePillClass,
          )}
          onClick={() => setCompareEnabled(!compareEnabled)}
          title="Compare dengan periode sebelumnya dalam sheet yang sama (mis. minggu lalu)"
        >
          <GitCompareArrows aria-hidden="true" className="h-3.5 w-3.5" />
          <span>Compare Mode</span>
          {compareEnabled && (
            <span className="text-xs text-muted-foreground">
              vs {prevDateStart} s/d {prevDateEnd}
            </span>
          )}
        </Button>

        {/* Cross-sheet compare toggle (vs sheet bulan lalu, same day-of-month) */}
        {onToggleCrossSheetCompare && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={crossSheetCompareEnabled}
            className={cn(
              "min-h-10 gap-1.5 text-xs",
              crossSheetCompareEnabled && activePillClass,
            )}
            onClick={onToggleCrossSheetCompare}
            disabled={crossSheetLoading}
            title="Compare dengan tanggal yang sama di sheet bulan lalu (mis. 8-14 Okt vs 8-14 Sep)"
          >
            {crossSheetLoading ? (
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            <span>vs Bulan Lalu</span>
            {crossSheetCompareEnabled && crossSheetAvailable && (
              <span className="text-xs text-muted-foreground">
                {crossSheetPrevSourceLabel
                  ? `(${crossSheetPrevSourceLabel}, ${crossSheetPrevDateStart} s/d ${crossSheetPrevDateEnd})`
                  : `(${crossSheetPrevDateStart} s/d ${crossSheetPrevDateEnd})`}
              </span>
            )}
            {crossSheetCompareEnabled && !crossSheetAvailable && !crossSheetLoading && (
              <Badge variant="outline" className="h-5 px-1.5 text-[11px] border-destructive/40 bg-destructive/10 text-status-danger">
                N/A
              </Badge>
            )}
          </Button>
        )}

        {/* Outlet consistency filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "min-h-10 gap-1.5 text-xs",
                outletConsistency !== "off" && activePillClass,
              )}
              title="Filter outlet yang konsisten aktif sepanjang periode untuk menghindari bias outlet baru"
            >
              <Filter aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Outlet Konsisten</span>
              {outletConsistency !== "off" && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-semibold">
                  {outletConsistency === "strict" ? "100%" : ">=80%"}
                </Badge>
              )}
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[300px]">
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
              Filter Outlet Konsisten
            </DropdownMenuLabel>
            <DropdownMenuItem
              className="min-h-10 text-xs"
              onClick={() => setOutletConsistency("off")}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <div>
                  <div className="font-medium">Semua Outlet</div>
                  <div className="text-xs text-muted-foreground">
                    Tampilkan semua outlet (termasuk yang partial / baru buka)
                  </div>
                </div>
                {outletConsistency === "off" && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-10 text-xs"
              onClick={() => setOutletConsistency("permissive")}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <div>
                  <div className="font-medium">Konsisten minimal 80% hari</div>
                  <div className="text-xs text-muted-foreground">
                    Hanya outlet aktif minimal 80% hari di periode ini. Cocok untuk compare trend.
                  </div>
                </div>
                {outletConsistency === "permissive" && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-10 text-xs"
              onClick={() => setOutletConsistency("strict")}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <div>
                  <div className="font-medium">Konsisten 100% hari (strict)</div>
                  <div className="text-xs text-muted-foreground">
                    Hanya outlet aktif semua hari di periode ini. Paling apple-to-apple.
                  </div>
                </div>
                {outletConsistency === "strict" && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>

        {/* Reset all */}
        {totalActiveFilters > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-10 gap-1 text-xs text-muted-foreground hover:text-destructive"
            onClick={resetAllFilters}
          >
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            Reset Filter
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Spacer */}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Data tersedia:</span>
          <span className="font-mono text-foreground">
            {dataRange.start || "?"} s/d {dataRange.end || "?"}
          </span>
        </div>
      </div>

      {/* Dismissible active filter chips */}
      {activeChips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2.5">
          <span className="mr-1 text-[11px] font-medium text-muted-foreground">
            Filter aktif:
          </span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              aria-label={`Hapus filter ${chip.group} ${chip.label}`}
              className="inline-flex min-h-7 items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-0.5 text-xs text-primary transition-colors hover:bg-primary/20"
            >
              <span className="text-[11px] text-muted-foreground">{chip.group}:</span>
              <span className="font-medium">{chip.label}</span>
              <X aria-hidden="true" className="h-3 w-3 opacity-80" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
