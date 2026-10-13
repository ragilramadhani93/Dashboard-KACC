import { NextResponse } from "next/server";
import { activateSheetSource } from "@/lib/sheet-sources";
import { verifyAdminPin } from "@/lib/admin-auth";
import { clearSheetCache } from "@/app/api/sheets/route";

export const dynamic = "force-dynamic";

// POST /api/sheet-sources/activate?id=<sheetSourceId>
// Marks the given sheet source as active (deactivates all others).
// Clears the cache so the next dashboard fetch reads the new sheet.
export async function POST(request: Request) {
  const auth = verifyAdminPin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Param 'id' wajib" }, { status: 400 });
  }
  const updated = await activateSheetSource(id);
  if (!updated) {
    return NextResponse.json({ error: "Sheet source tidak ditemukan" }, { status: 404 });
  }
  // Clear all caches - new active sheet will be fetched fresh
  clearSheetCache();
  return NextResponse.json({ source: updated });
}
