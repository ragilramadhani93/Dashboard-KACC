import { NextResponse } from "next/server";
import { parseSheetUrl } from "@/lib/sheet-sources";
import { parseCsvToObjects } from "@/lib/csv-parser";
import { verifyAdminPin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

interface TestBody {
  url?: string;
  sheetId?: string;
  gid?: string;
}

export async function POST(request: Request) {
  const auth = verifyAdminPin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: TestBody;
  try {
    body = (await request.json()) as TestBody;
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  // Resolve sheetId + gid from URL or raw values
  let sheetId: string | undefined;
  let gid: string | undefined;

  if (body.url?.trim()) {
    const parsed = parseSheetUrl(body.url);
    if (!parsed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "URL Google Sheets tidak valid. Pastikan format: https://docs.google.com/spreadsheets/d/{ID}/edit#gid={GID}",
          parsedSheetId: null,
          parsedGid: null,
        },
        { status: 200 },
      );
    }
    sheetId = parsed.sheetId;
    gid = parsed.gid;
  } else if (body.sheetId?.trim()) {
    sheetId = body.sheetId.trim();
    gid = body.gid?.trim() || "0";
  } else {
    return NextResponse.json(
      { ok: false, error: "Harus isi 'url' atau 'sheetId'" },
      { status: 200 },
    );
  }

  const fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const fetchStart = Date.now();

  try {
    // Use AbortController for timeout compatibility across runtimes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
      res = await fetch(fetchUrl, {
        cache: "no-store",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/csv,application/csv,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    const fetchMs = Date.now() - fetchStart;

    if (!res.ok) {
      let reason = "";
      if (res.status === 404) {
        reason =
          "Sheet tidak ditemukan (404). Cek apakah sheetId benar (44 karakter), atau sheet sudah di-delete. Tips: buka sheet di Google Sheets, copy URL dari address bar.";
      } else if (res.status === 403) {
        reason =
          "Akses ditolak (403). Sheet harus di-share sebagai 'Anyone with link can view' (klik tombol Share kanan atas → General access → Anyone with the link → Viewer).";
      } else if (res.status === 401) {
        reason = "Authentication required (401). Sheet private - set sharing ke 'Anyone with link can view'.";
      } else if (res.status === 429) {
        reason = "Rate limited (429). Google membatasi request. Tunggu 1-2 menit lalu coba lagi.";
      } else if (res.status >= 500) {
        reason = `Google server error (${res.status}). Coba lagi nanti.`;
      } else {
        reason = `HTTP ${res.status}`;
      }
      return NextResponse.json(
        {
          ok: false,
          error: `Gagal fetch sheet: ${reason}`,
          parsedSheetId: sheetId,
          parsedGid: gid,
          fetchUrl,
          httpStatus: res.status,
          fetchMs,
        },
        { status: 200 },
      );
    }

    const text = await res.text();

    // Detect HTML response (private sheet redirect ke login page)
    if (text.startsWith("<") || text.toLowerCase().includes("<!doctype html")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sheet PRIVATE - response bukan CSV tapi HTML login page Google. Set sharing ke 'Anyone with link can view' di Google Sheets (tombol Share → General access → Anyone with the link).",
          parsedSheetId: sheetId,
          parsedGid: gid,
          fetchUrl,
          httpStatus: res.status,
          fetchMs,
          responsePreview: text.slice(0, 200),
        },
        { status: 200 },
      );
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sheet berhasil di-fetch tapi kosong. Mungkin gid salah (tab tidak ada) atau sheet belum punya data. Tips: buka sheet di Google Sheets, klik tab yang benar, copy URL dengan #gid= yang benar.",
          parsedSheetId: sheetId,
          parsedGid: gid,
          fetchUrl,
          rowCount: 0,
          fetchMs,
        },
        { status: 200 },
      );
    }

    const { headers, records } = parseCsvToObjects(text);

    // Expected headers from KACC sheet
    const expectedHeaders = [
      "Transaction Number",
      "Opened Date",
      "Outlet Name",
      "Payment Method",
      "Item Name",
      "Qty",
      "Grand Total Final",
    ];
    const missingHeaders = expectedHeaders.filter(
      (h) => !headers.includes(h),
    );

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Header kolom tidak lengkap. Kolom yang hilang: ${missingHeaders.join(", ")}. Pastikan struktur sheet sama persis dengan sheet Oktober (jangan rename/urut ulang header).`,
          parsedSheetId: sheetId,
          parsedGid: gid,
          fetchUrl,
          actualHeaders: headers,
          missingHeaders,
          rowCount: records.length,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Sheet valid! ${records.length} baris terdeteksi, semua header kolom KACC ada.`,
      parsedSheetId: sheetId,
      parsedGid: gid,
      fetchUrl,
      rowCount: records.length,
      headers,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const fetchMs = Date.now() - fetchStart;
    let hint = "";
    if (msg.includes("timeout") || msg.includes("abort")) {
      hint = " (timeout 20s - server tidak bisa reach Google Sheets, atau sheet terlalu besar)";
    } else if (msg.includes("ENOTFOUND") || msg.includes("getaddrinfo")) {
      hint = " (DNS resolution gagal - server tidak punya akses internet ke Google)";
    } else if (msg.includes("ECONNREFUSED") || msg.includes("ECONNRESET")) {
      hint = " (connection refused/reset - firewall block atau network issue)";
    }
    return NextResponse.json(
      {
        ok: false,
        error: `Network error saat fetch: ${msg}${hint}`,
        parsedSheetId: sheetId,
        parsedGid: gid,
        fetchUrl,
        fetchMs,
        errorType: e instanceof Error ? e.name : "Unknown",
      },
      { status: 200 },
    );
  }
}
