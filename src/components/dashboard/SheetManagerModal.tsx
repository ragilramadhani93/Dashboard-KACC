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
  Eye,
  EyeOff,
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
  const [showPin, setShowPin] = useState(false);
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
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-primary" />
              Kelola Sumber Sheet
            </SheetTitle>
            <SheetDescription>
              Tambah, ganti, atau hapus sheet Google Sheets. Sheet aktif menentukan data yang
              ditampilkan di dashboard. Data sumber lama tetap tersimpan.
            </SheetDescription>
          </SheetHeader>

          {/* PIN verification gate */}
          {!pinVerified ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyPin();
              }}
              className="space-y-3 rounded-lg border border-border bg-muted/40 p-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="admin-pin-input" className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                  PIN Admin
                </Label>
                <div className="relative">
                  <Input
                    id="admin-pin-input"
                    type={showPin ? "text" : "password"}
                    autoComplete="current-password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Masukkan PIN admin"
                    className="h-10 pr-11 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    aria-label={showPin ? "Sembunyikan PIN" : "Tampilkan PIN"}
                    className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                  >
                    {showPin ? (
                      <EyeOff aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                size="sm"
                className="min-h-10 w-full bg-primary text-xs text-primary-foreground hover:bg-primary/90"
              >
                Verifikasi PIN
              </Button>
              <p className="text-xs text-muted-foreground">
                Default: <code className="font-mono text-foreground">kacc2026</code> (dapat diubah via env ADMIN_PIN)
              </p>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Add new sheet form */}
              <div className="space-y-3 rounded-lg border border-primary/35 bg-primary/[0.04] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Tambah Sheet Baru
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="sheet-label" className="text-xs font-medium text-foreground">
                      Label (mis. &quot;September 2026&quot;)
                    </Label>
                    <Input
                      id="sheet-label"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="September 2026"
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sheet-url" className="text-xs font-medium text-foreground">
                      URL Google Sheets (salin lengkap dari address bar)
                    </Label>
                    <Input
                      id="sheet-url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=..."
                      className="mt-1 h-9 font-mono text-xs"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Buka tab Google Sheets yang berisi data, lalu salin URL lengkap termasuk <code className="font-mono">#gid=...</code>.
                    </p>
                  </div>

                  {/* Live URL parse preview */}
                  {url.trim() && (
                    <div className="rounded-md border border-border bg-muted/50 px-2.5 py-2 text-xs">
                      {parsedUrl ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                          <span>Terbaca:</span>
                          <Badge variant="outline" className="h-5 px-1.5 text-[11px] border-emerald-700/30 bg-emerald-700/10 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
                            <span className="font-mono">sheetId: {parsedUrl.sheetId.slice(0, 16)}...</span>
                          </Badge>
                          <Badge variant="outline" className="h-5 px-1.5 text-[11px] border-primary/35 bg-primary/10 text-primary">
                            <span className="font-mono">gid: {parsedUrl.gid}</span>
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                          <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            URL tidak dikenali. Pastikan format /d/{`{ID}`}/edit#gid=
                            atau gunakan opsi lanjutan di bawah.
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Advanced toggle for manual sheetId/gid */}
                  <button
                    type="button"
                    aria-expanded={advancedOpen}
                    className="flex min-h-9 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => setAdvancedOpen(!advancedOpen)}
                  >
                    {advancedOpen ? (
                      <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                    )}
                    Opsi Lanjutan (input manual sheetId / gid)
                  </button>
                  {advancedOpen && (
                    <div className="space-y-2.5 rounded-md border border-border bg-muted/40 p-3">
                      <div>
                        <Label htmlFor="manual-sheet-id" className="text-xs font-medium text-foreground">
                          Manual sheetId
                        </Label>
                        <Input
                          id="manual-sheet-id"
                          value={manualSheetId}
                          onChange={(e) => setManualSheetId(e.target.value)}
                          placeholder="1A2B3C... (44 karakter)"
                          className="mt-1 h-9 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="manual-gid" className="text-xs font-medium text-foreground">
                          Manual gid (tab ID, angka)
                        </Label>
                        <Input
                          id="manual-gid"
                          value={manualGid}
                          onChange={(e) => setManualGid(e.target.value)}
                          placeholder="0 (default tab) atau 123456789"
                          className="mt-1 h-9 font-mono text-xs"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          gid berada di URL setelah <code className="font-mono">#gid=</code> (tab pertama biasanya 0).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Test Fetch + Save buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-10 gap-1.5 text-xs"
                      onClick={handleTestFetch}
                      disabled={testing || (!url.trim() && !manualSheetId.trim())}
                    >
                      {testing ? (
                        <>
                          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                          Menguji...
                        </>
                      ) : (
                        <>
                          <FlaskConical aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                          Test Fetch
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-10 gap-1.5 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                      onClick={handleAdd}
                      disabled={adding}
                    >
                      {adding ? (
                        <>
                          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                          Tambah &amp; Aktifkan
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Test result display */}
                  {testResult && (
                    <div
                      role="status"
                      className={cn(
                        "rounded-md border px-3 py-2 text-xs",
                        testResult.ok
                          ? "border-emerald-700/35 bg-emerald-700/10 text-emerald-800 dark:border-emerald-400/35 dark:bg-emerald-400/10 dark:text-emerald-300"
                          : "border-destructive/35 bg-destructive/10 text-red-700 dark:text-red-300",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {testResult.ok ? (
                          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                        ) : (
                          <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                        )}
                        <div className="flex-1 space-y-1">
                          <p className="font-semibold">
                            {testResult.ok ? "Sheet valid!" : "Test fetch gagal"}
                          </p>
                          <p className="leading-relaxed">
                            {testResult.ok ? testResult.message : testResult.error}
                          </p>
                          {testResult.rowCount !== undefined && (
                            <p className="text-xs opacity-90">
                              Jumlah baris: {testResult.rowCount.toLocaleString("id-ID")}
                            </p>
                          )}
                          {testResult.missingHeaders && testResult.missingHeaders.length > 0 && (
                            <p className="text-xs opacity-90">
                              Kolom hilang: {testResult.missingHeaders.join(", ")}
                            </p>
                          )}
                          {testResult.actualHeaders && (
                            <p className="text-xs opacity-90">
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
                    <Label htmlFor="sheet-note" className="text-xs font-medium text-foreground">
                      Catatan (opsional)
                    </Label>
                    <Input
                      id="sheet-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Catatan internal..."
                      className="mt-1 h-9 text-xs"
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
                    <div className="rounded-lg border border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
                      Belum ada sheet terdaftar.
                    </div>
                  )}
                  {sources.map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        s.isActive
                          ? "border-primary/45 bg-primary/[0.05]"
                          : "border-border bg-card",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {s.label}
                            </span>
                            {s.isActive && (
                              <Badge
                                variant="outline"
                                className="h-5 px-1.5 text-[11px] font-semibold border-emerald-700/35 bg-emerald-700/10 text-emerald-800 dark:border-emerald-400/35 dark:bg-emerald-400/10 dark:text-emerald-300"
                              >
                                AKTIF
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Hash aria-hidden="true" className="h-3 w-3" />
                            <span className="truncate font-mono">
                              {s.sheetId.slice(0, 16)}.../{s.gid}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {s.dataStart && s.dataEnd && (
                              <span className="flex items-center gap-1">
                                <Calendar aria-hidden="true" className="h-3 w-3" />
                                {formatDateLong(s.dataStart)} s/d {formatDateLong(s.dataEnd)}
                              </span>
                            )}
                            {s.rowCount !== null && (
                              <span>{s.rowCount.toLocaleString("id-ID")} baris</span>
                            )}
                            {s.lastFetchedAt && (
                              <span>
                                Fetch: {new Date(s.lastFetchedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            )}
                          </div>
                          {s.note && (
                            <p className="text-xs text-muted-foreground">
                              {s.note}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-row gap-1.5 sm:flex-col">
                          {!s.isActive && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="min-h-9 gap-1 px-2.5 text-xs border-emerald-700/35 bg-emerald-700/10 text-emerald-800 hover:bg-emerald-700/20 dark:border-emerald-400/35 dark:bg-emerald-400/10 dark:text-emerald-300"
                              disabled={activatingId === s.id}
                              onClick={() => handleActivate(s.id, s.label)}
                            >
                              {activatingId === s.id ? (
                                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                              )}
                              Aktifkan
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-9 gap-1 px-2.5 text-xs border-destructive/35 bg-destructive/10 text-red-700 hover:bg-destructive/20 dark:text-red-400"
                            disabled={s.isActive && sources.length === 1}
                            onClick={() => setDeleteTarget(s)}
                          >
                            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                            Hapus
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {sources.length > 0 && (
                <div className="rounded-lg border border-amber-600/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />
                  Pastikan struktur kolom sheet baru sama dengan sheet Okt
                  (Transaction Number, Opened Date, Outlet Name, dll) dan jangan ubah nama header.
                </div>
              )}
            </div>
          )}

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 text-xs"
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
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle aria-hidden="true" className="h-4 w-4" />
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
              Data Google Sheets tidak dihapus (hanya dihapus dari daftar di
              dashboard) dan bisa ditambahkan kembali kapan saja dengan URL yang sama.
              {deleteTarget?.isActive && (
                <span className="mt-2 block rounded-md border border-amber-600/25 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                  Sheet ini sedang aktif: dashboard akan beralih ke sheet sebelumnya atau meminta sumber baru.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 text-xs"
              onClick={() => setDeleteTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-h-10 gap-1.5 bg-destructive text-xs text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
