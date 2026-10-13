"use client";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Calendar,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDateLong } from "@/lib/dashboard/aggregate";
import type { SheetSourceDTO } from "@/lib/sheet-sources";

interface SheetManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: SheetSourceDTO[];
  activeId: string | null;
  onChange: () => void; // refetch callback
}

const DEFAULT_PIN = "kacc2026";

export function SheetManagerModal({
  open,
  onOpenChange,
  sources,
  activeId,
  onChange,
}: SheetManagerModalProps) {
  const { toast } = useToast();
  const [pin, setPin] = useState(DEFAULT_PIN);
  const [pinVerified, setPinVerified] = useState(false);

  // Add form state
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SheetSourceDTO | null>(null);

  // Activate state
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // Verify PIN
  function verifyPin() {
    if (pin.trim() === DEFAULT_PIN) {
      setPinVerified(true);
    } else {
      toast({
        title: "PIN salah",
        description: "PIN admin yang Anda masukkan salah.",
        variant: "destructive",
      });
    }
  }

  async function handleAdd() {
    if (!label.trim() || !url.trim()) {
      toast({
        title: "Lengkapi form",
        description: "Label dan URL Google Sheets wajib diisi.",
        variant: "destructive",
      });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/sheet-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-PIN": pin },
        body: JSON.stringify({ label: label.trim(), url: url.trim(), note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast({
        title: "Sheet ditambahkan",
        description: `${label} berhasil ditambahkan & dijadikan active.`,
      });
      setLabel("");
      setUrl("");
      setNote("");
      onChange();
    } catch (e) {
      toast({
        title: "Gagal menambah sheet",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  }

  async function handleActivate(id: string, label: string) {
    setActivatingId(id);
    try {
      const res = await fetch(`/api/sheet-sources/activate?id=${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "X-Admin-PIN": pin },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast({
        title: "Sheet aktif diganti",
        description: `Sekarang menampilkan data dari "${label}".`,
      });
      onChange();
    } catch (e) {
      toast({
        title: "Gagal mengganti sheet aktif",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActivatingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/sheet-sources/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
        headers: { "X-Admin-PIN": pin },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast({
        title: "Sheet dihapus",
        description: `"${deleteTarget.label}" telah dihapus dari daftar.`,
      });
      setDeleteTarget(null);
      onChange();
    } catch (e) {
      toast({
        title: "Gagal menghapus sheet",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Kelola Sumber Sheet
            </SheetTitle>
            <SheetDescription>
              Tambah / ganti / hapus sheet Google Sheets. Sheet aktif = data yang
              ditampilkan di dashboard. Data lama tetap tersimpan, tidak hilang.
            </SheetDescription>
          </SheetHeader>

          {/* PIN verification gate */}
          {!pinVerified ? (
            <div className="space-y-3 rounded-lg border border-white/10 bg-card/40 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verifikasi PIN admin
              </div>
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN admin"
                onKeyDown={(e) => e.key === "Enter" && verifyPin()}
              />
              <Button
                size="sm"
                className="w-full bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                onClick={verifyPin}
              >
                Verifikasi
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Default: <code className="font-mono">kacc2026</code> (bisa diubah via env ADMIN_PIN)
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add new sheet form */}
              <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Sheet Baru
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Label (mis. &quot;November 2026&quot;)
                    </Label>
                    <Input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="November 2026"
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      URL Google Sheets
                    </Label>
                    <Input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=..."
                      className="mt-1 h-8 font-mono text-[10px]"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Paste URL lengkap dari address bar browser. sheetId &amp; gid
                      akan di-parse otomatis.
                    </p>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Catatan (opsional)
                    </Label>
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Catatan internal..."
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="w-full gap-1.5 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                    onClick={handleAdd}
                    disabled={adding}
                  >
                    {adding ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Menambahkan...
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Tambah &amp; Jadikan Aktif
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* List of existing sheets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-semibold text-foreground">
                    Sheet Terdaftar ({sources.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {sources.length === 0 && (
                    <div className="rounded-md border border-white/5 bg-card/40 p-4 text-center text-xs text-muted-foreground">
                      Belum ada sheet terdaftar.
                    </div>
                  )}
                  {sources.map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        s.isActive
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-white/10 bg-card/40 hover:border-white/20",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {s.label}
                            </span>
                            {s.isActive && (
                              <Badge
                                variant="outline"
                                className="h-4 px-1 text-[9px] border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                              >
                                AKTIF
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Hash className="h-2.5 w-2.5" />
                            <span className="font-mono">
                              {s.sheetId.slice(0, 16)}.../{s.gid}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                            {s.dataStart && s.dataEnd && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-2.5 w-2.5" />
                                {formatDateLong(s.dataStart)} → {formatDateLong(s.dataEnd)}
                              </span>
                            )}
                            {s.rowCount !== null && (
                              <span>{s.rowCount.toLocaleString("id-ID")} baris</span>
                            )}
                            {s.lastFetchedAt && (
                              <span>
                                fetch: {new Date(s.lastFetchedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            )}
                          </div>
                          {s.note && (
                            <p className="text-[10px] text-muted-foreground">
                              {s.note}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          {!s.isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 gap-1 px-2 text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                              disabled={activatingId === s.id}
                              onClick={() => handleActivate(s.id, s.label)}
                            >
                              {activatingId === s.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              Aktifkan
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 gap-1 px-2 text-[10px] border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            disabled={s.isActive && sources.length === 1}
                            onClick={() => setDeleteTarget(s)}
                          >
                            <Trash2 className="h-3 w-3" />
                            Hapus
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {sources.length > 0 && (
                <div className="rounded-md bg-amber-500/5 px-3 py-2 text-[10px] text-amber-300">
                  <AlertCircle className="mr-1 inline h-3 w-3" />
                  Pastikan struktur kolom sheet baru sama dengan sheet Okt
                  (header: Transaction Number, Opened Date, Outlet Name, dll).
                  Jangan rename/urut ulang header.
                </div>
              )}
            </div>
          )}

          <SheetFooter>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 text-xs hover:bg-white/10"
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-4 w-4" />
              Konfirmasi Hapus Sheet
            </DialogTitle>
            <DialogDescription className="text-xs">
              Anda yakin ingin menghapus sheet{" "}
              <span className="font-semibold text-foreground">
                &quot;{deleteTarget?.label}&quot;
              </span>
              ?
              <br />
              <br />
              Data Google Sheets-nya tidak dihapus (hanya dihapus dari daftar di
              dashboard). Sheet bisa ditambahkan lagi kapan saja dengan URL yang
              sama.
              {deleteTarget?.isActive && (
                <span className="mt-2 block rounded-md bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
                  Sheet ini sedang aktif - dashboard akan menampilkan sheet
                  sebelumnya (atau error jika tidak ada lainnya).
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setDeleteTarget(null)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-red-500/15 text-red-400 hover:bg-red-500/25"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
