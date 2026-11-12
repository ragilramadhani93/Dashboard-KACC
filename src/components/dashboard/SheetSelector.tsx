"use client";
import { useState } from "react";
import { Calendar, ChevronDown, Settings2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import type { SheetSourceDTO } from "@/lib/sheet-sources";

interface SheetSelectorProps {
  sources: SheetSourceDTO[];
  activeId: string | null;
  loading?: boolean;
  onActivate: (id: string) => Promise<void>;
  onOpenManager: () => void;
}

export function SheetSelector({
  sources,
  activeId,
  loading,
  onActivate,
  onOpenManager,
}: SheetSelectorProps) {
  const [switching, setSwitching] = useState<string | null>(null);
  const active = sources.find((s) => s.id === activeId);

  async function handleActivate(id: string) {
    setSwitching(id);
    await onActivate(id);
    setSwitching(null);
  }

  return (
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
            {loading ? "Memuat..." : active?.label ?? "Pilih Sheet"}
          </span>
          {active?.dataStart && active?.dataEnd && (
            <span className="hidden text-xs text-muted-foreground md:inline">
              ({active.dataStart} s/d {active.dataEnd})
            </span>
          )}
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[290px]">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          Pilih Periode Sheet
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sources.length === 0 && (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            Belum ada sheet terdaftar.
          </div>
        )}
        {sources.map((s) => (
          <DropdownMenuItem
            key={s.id}
            className="flex min-h-10 cursor-pointer items-start gap-2 px-2.5 py-2 text-xs"
            onClick={() => handleActivate(s.id)}
            disabled={switching === s.id}
          >
            <div className="flex w-full items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{s.label}</span>
                  {s.isActive && (
                    <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                  )}
                </div>
                {s.dataStart && s.dataEnd && (
                  <p className="text-xs text-muted-foreground">
                    {s.dataStart} s/d {s.dataEnd}
                  </p>
                )}
                {s.rowCount !== null && (
                  <p className="text-[11px] text-muted-foreground">
                    {s.rowCount.toLocaleString("id-ID")} baris
                  </p>
                )}
              </div>
              {switching === s.id && (
                <span className="text-xs text-primary">Memuat...</span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex min-h-10 cursor-pointer items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-primary"
          onClick={onOpenManager}
        >
          <Settings2 aria-hidden="true" className="h-3.5 w-3.5" />
          Kelola Sheet (Tambah / Hapus)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
