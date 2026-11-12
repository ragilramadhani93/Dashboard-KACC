import { NextResponse } from "next/server";
import { buildPdfReport, type PdfReportPayload } from "@/lib/pdf-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let payload: PdfReportPayload;
  try {
    payload = (await request.json()) as PdfReportPayload;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  try {
    const pdfBuffer = buildPdfReport(payload);
    const filename = `kacc-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `PDF export failed: ${message}` },
      { status: 500 },
    );
  }
}
