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
          variant="outline"
          size="sm"
          className="gap-1.5 border-white/10 bg-white/5 text-xs hover:bg-white/10"
        >
          <Calendar className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-medium">
            {loading ? "Memuat..." : active?.label ?? "Pilih Sheet"}
          </span>
          {active?.dataStart && active?.dataEnd && (
            <span className="hidden text-[10px] text-muted-foreground md:inline">
              ({active.dataStart} → {active.dataEnd})
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px]">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Pilih Periode Sheet
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sources.length === 0 && (
          <div className="px-2 py-3 text-center text-[10px] text-muted-foreground">
            Belum ada sheet terdaftar.
          </div>
        )}
        {sources.map((s) => (
          <DropdownMenuItem
            key={s.id}
            className="flex cursor-pointer items-start gap-2 px-2 py-2 text-xs"
            onClick={() => handleActivate(s.id)}
            disabled={switching === s.id}
          >
            <div className="flex w-full items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{s.label}</span>
                  {s.isActive && (
                    <Check className="h-3 w-3 text-emerald-400" />
                  )}
                </div>
                {s.dataStart && s.dataEnd && (
                  <p className="text-[10px] text-muted-foreground">
                    {s.dataStart} → {s.dataEnd}
                  </p>
                )}
                {s.rowCount !== null && (
                  <p className="text-[9px] text-muted-foreground">
                    {s.rowCount.toLocaleString("id-ID")} baris
                  </p>
                )}
              </div>
              {switching === s.id && (
                <span className="text-[10px] text-cyan-300">switching...</span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-1.5 px-2 py-2 text-xs text-emerald-300"
          onClick={onOpenManager}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Kelola Sheet (add / delete)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
