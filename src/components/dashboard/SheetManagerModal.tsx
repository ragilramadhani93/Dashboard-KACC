"use client";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
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
  FlaskConical,
  XCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDateLong } from "@/lib/dashboard/aggregate";
import { parseSheetUrl, type SheetSourceDTO } from "@/lib/sheet-sources";

interface SheetManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: SheetSourceDTO[];
  activeId: string | null;
  onChange: () => void;
}

const DEFAULT_PIN = "kacc2026";

interface TestResult {
  ok: boolean;
  error?: string;
  message?: string;
  parsedSheetId?: string | null;
  parsedGid?: string | null;
  rowCount?: number;
  fetchUrl?: string;
  actualHeaders?: string[];
  missingHeaders?: string[];
}

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

  // Advanced mode (manual sheetId/gid override)
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manualSheetId, setManualSheetId] = useState("");
  const [manualGid, setManualGid] = useState("");

  // Test fetch state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SheetSourceDTO | null>(null);

  // Activate state
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // Live parse URL preview
  const parsedUrl = url.trim() ? parseSheetUrl(url.trim()) : null;

  // Reset test result when URL changes
  useEffect(() => {
    setTestResult(null);
  }, [url, manualSheetId, manualGid]);

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

  // Test fetch the sheet URL
  async function handleTestFetch() {
    if (!url.trim() && !manualSheetId.trim()) {
      toast({
        title: "Isi URL dulu",
        description: "Masukkan URL Google Sheets atau manual sheetId untuk di-test.",
        variant: "destructive",
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const payload = manualSheetId.trim()
        ? { sheetId: manualSheetId.trim(), gid: manualGid.trim() || "0" }
        : { url: url.trim() };
      const res = await fetch("/api/sheet-sources/test-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-PIN": pin },
        body: JSON.stringify(payload),
      });
      // Handle non-OK HTTP responses (server error, 500, etc)
      if (!res.ok) {
        let errDetail = `HTTP ${res.status}`;
        try {
          const errBody = await res.json();
          errDetail = errBody?.error || errDetail;
        } catch {
          // response not JSON
        }
        setTestResult({
          ok: false,
          error: `Server error: ${errDetail}. ${
            res.status === 401
              ? "PIN admin salah."
              : res.status >= 500
                ? "Server production bermasalah. Cek /api/health."
                : ""
          }`,
        });
        toast({
          title: "Test fetch gagal",
          description: errDetail,
          variant: "destructive",
        });
        return;
      }
      const data: TestResult = await res.json();
      setTestResult(data);
      if (data.ok) {
        toast({
          title: "Sheet valid!",
          description: data.message,
        });
      } else {
        toast({
          title: "Test fetch gagal",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setTestResult({ ok: false, error: `Network: ${msg}` });
      toast({
        title: "Test fetch gagal",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleAdd() {
    if (!label.trim()) {
      toast({
        title: "Label wajib",
        description: "Isi label dulu (mis. 'September 2026').",
        variant: "destructive",
      });
      return;
    }
    const hasUrl = url.trim();
    const hasManual = manualSheetId.trim();
    if (!hasUrl && !hasManual) {
      toast({
        title: "URL / sheetId wajib",
        description: "Isi URL Google Sheets atau manual sheetId di Advanced.",
        variant: "destructive",
      });
      return;
    }

    // If test hasn't been run or failed, warn the user
    if (!testResult || !testResult.ok) {
      toast({
        title: "Test fetch dulu",
        description:
          "Sebelum simpan, klik 'Test Fetch' untuk pastikan sheet bisa diakses & formatnya benar.",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/sheet-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-PIN": pin },
        body: JSON.stringify({
          label: label.trim(),
          url: url.trim() || undefined,
          sheetId: manualSheetId.trim() || undefined,
          gid: manualGid.trim() || undefined,
          note: note.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast({
        title: "Sheet ditambahkan",
        description: `${label} berhasil ditambahkan & dijadikan active.`,
      });
      // Reset form
      setLabel("");
      setUrl("");
      setNote("");
      setManualSheetId("");
      setManualGid("");
      setTestResult(null);
      setAdvancedOpen(false);
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
                      Label (mis. &quot;September 2026&quot;)
                    </Label>
                    <Input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="September 2026"
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      URL Google Sheets (paste lengkap dari address bar)
                    </Label>
                    <Input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=..."
                      className="mt-1 h-8 font-mono text-[10px]"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Tip: buka tab Google Sheets yang berisi data, copy URL dari
                      address bar (termasuk #gid=...), paste di sini.
                    </p>
                  </div>

                  {/* Live URL parse preview */}
                  {url.trim() && (
                    <div className="rounded-md bg-white/5 px-2 py-1.5 text-[10px]">
                      {parsedUrl ? (
                        <div className="flex flex-wrap items-center gap-1 text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Parsed:</span>
                          <Badge variant="outline" className="h-4 px-1 text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                            <span className="font-mono">sheetId: {parsedUrl.sheetId.slice(0, 16)}...</span>
                          </Badge>
                          <Badge variant="outline" className="h-4 px-1 text-[9px] border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                            <span className="font-mono">gid: {parsedUrl.gid}</span>
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-300">
                          <AlertCircle className="h-3 w-3" />
                          <span>
                            URL tidak dikenali. Pastikan format /d/{`{ID}`}/edit#gid=
                            atau gunakan Advanced di bawah untuk input manual.
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Advanced toggle for manual sheetId/gid */}
                  <button
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => setAdvancedOpen(!advancedOpen)}
                  >
                    {advancedOpen ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Advanced (input manual sheetId / gid)
                  </button>
                  {advancedOpen && (
                    <div className="space-y-2 rounded-md bg-white/5 p-2">
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Manual sheetId
                        </Label>
                        <Input
                          value={manualSheetId}
                          onChange={(e) => setManualSheetId(e.target.value)}
                          placeholder="1A2B3C... (44 chars)"
                          className="mt-1 h-8 font-mono text-[10px]"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Manual gid (tab ID, angka)
                        </Label>
                        <Input
                          value={manualGid}
                          onChange={(e) => setManualGid(e.target.value)}
                          placeholder="0 (default tab) atau 123456789"
                          className="mt-1 h-8 font-mono text-[10px]"
                        />
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          gid ada di URL setelah <code className="font-mono">#gid=</code>.
                          Kalau tab cuma 1, biasanya gid=0.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Test Fetch button */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-cyan-500/30 bg-cyan-500/10 text-xs text-cyan-300 hover:bg-cyan-500/20"
                      onClick={handleTestFetch}
                      disabled={testing || (!url.trim() && !manualSheetId.trim())}
                    >
                      {testing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <FlaskConical className="h-3.5 w-3.5" />
                          Test Fetch
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-500/15 text-xs text-emerald-300 hover:bg-emerald-500/25"
                      onClick={handleAdd}
                      disabled={adding}
                    >
                      {adding ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          Tambah &amp; Aktifkan
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Test result display */}
                  {testResult && (
                    <div
                      className={cn(
                        "rounded-md border px-3 py-2 text-[11px]",
                        testResult.ok
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-red-500/30 bg-red-500/10 text-red-300",
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        {testResult.ok ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        )}
                        <div className="flex-1 space-y-1">
                          <p className="font-semibold">
                            {testResult.ok ? "Sheet valid!" : "Test fetch gagal"}
                          </p>
                          <p className="leading-relaxed">
                            {testResult.ok ? testResult.message : testResult.error}
                          </p>
                          {testResult.rowCount !== undefined && (
                            <p className="text-[10px] opacity-80">
                              Row count: {testResult.rowCount.toLocaleString("id-ID")}
                            </p>
                          )}
                          {testResult.missingHeaders && testResult.missingHeaders.length > 0 && (
                            <p className="text-[10px] opacity-80">
                              Kolom hilang: {testResult.missingHeaders.join(", ")}
                            </p>
                          )}
                          {testResult.actualHeaders && (
                            <p className="text-[10px] opacity-80">
                              Headers ({testResult.actualHeaders.length}):{" "}
                              {testResult.actualHeaders.slice(0, 6).join(", ")}
                              {testResult.actualHeaders.length > 6 ? ", ..." : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

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
