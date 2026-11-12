import { NextResponse } from "next/server";
import {
  createSheetSource,
  listSheetSources,
  parseSheetUrl,
} from "@/lib/sheet-sources";
import { verifyAdminPin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET - list all sheet sources (no auth needed)
export async function GET() {
  try {
    const sources = await listSheetSources();
    return NextResponse.json({ sources });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Database error: ${msg}` },
      { status: 503 },
    );
  }
}

// POST - add a new sheet source (requires admin PIN)
interface CreateBody {
  label?: string;
  url?: string;          // accept full Google Sheets URL
  sheetId?: string;      // or raw sheetId
  gid?: string;
  note?: string;
  activate?: boolean;
}

export async function POST(request: Request) {
  const auth = verifyAdminPin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  if (!body.label?.trim()) {
    return NextResponse.json({ error: "Label wajib diisi" }, { status: 400 });
  }

  // Resolve sheetId + gid from either URL or raw values
  let sheetId: string | undefined;
  let gid: string | undefined;

  if (body.url?.trim()) {
    const parsed = parseSheetUrl(body.url);
    if (!parsed) {
      return NextResponse.json(
        { error: "URL Google Sheets tidak valid. Pastikan format: https://docs.google.com/spreadsheets/d/{ID}/edit#gid={GID}" },
        { status: 400 },
      );
    }
    sheetId = parsed.sheetId;
    gid = parsed.gid;
  } else if (body.sheetId?.trim()) {
    sheetId = body.sheetId.trim();
    gid = body.gid?.trim() || "0";
  } else {
    return NextResponse.json(
      { error: "Harus isi 'url' atau 'sheetId'" },
      { status: 400 },
    );
  }

  try {
    const created = await createSheetSource({
      label: body.label.trim(),
      sheetId,
      gid,
      note: body.note?.trim() || undefined,
      activate: body.activate,
    });
    return NextResponse.json({ source: created }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
