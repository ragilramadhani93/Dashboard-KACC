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

  try {
    const res = await fetch(fetchUrl, {
      cache: "no-store",
      headers: { "User-Agent": "KACC-Dashboard/1.0" },
    });

    if (!res.ok) {
      let reason = "";
      if (res.status === 404) {
        reason =
          "Sheet tidak ditemukan (404). Cek apakah sheetId benar, atau sheet sudah di-delete.";
      } else if (res.status === 403) {
        reason =
          "Akses ditolak (403). Sheet harus di-share sebagai 'Anyone with link can view' (klik Share → General access → Anyone with the link).";
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
        },
        { status: 200 },
      );
    }

    const text = await res.text();

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sheet berhasil di-fetch tapi kosong. Mungkin gid salah (tab tidak ada) atau sheet belum punya data.",
          parsedSheetId: sheetId,
          parsedGid: gid,
          fetchUrl,
          rowCount: 0,
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
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: `Network error saat fetch: ${msg}`,
        parsedSheetId: sheetId,
        parsedGid: gid,
        fetchUrl,
      },
      { status: 200 },
    );
  }
}
