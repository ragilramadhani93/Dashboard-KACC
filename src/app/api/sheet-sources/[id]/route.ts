import { NextResponse } from "next/server";
import { deleteSheetSource, updateSheetSource } from "@/lib/sheet-sources";
import { verifyAdminPin } from "@/lib/admin-auth";
import { clearSheetCache } from "@/app/api/sheets/route";

export const dynamic = "force-dynamic";

interface PatchBody {
  label?: string;
  note?: string | null;
}

// PATCH /api/sheet-sources/[id] - update label / note
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = verifyAdminPin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await params;
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }
  const updated = await updateSheetSource(id, {
    label: body.label?.trim() || undefined,
    note: body.note === null ? null : body.note?.trim() || undefined,
  });
  if (!updated) {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json({ source: updated });
}

// DELETE /api/sheet-sources/[id] - delete a sheet source
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = verifyAdminPin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await params;
  try {
    await deleteSheetSource(id);
    clearSheetCache(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
