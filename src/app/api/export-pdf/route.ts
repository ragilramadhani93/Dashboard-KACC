import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { writeFile, readFile, mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SCRIPT_PATH = "/home/z/my-project/scripts/generate_pdf.py";
const PYTHON_BIN = "python3";

interface PdfRequestPayload {
  meta: unknown;
  filters: unknown;
  kpi: unknown;
  prevKpi: unknown | null;
  dailyTrend: unknown[];
  topOutlets: unknown[];
  topItems: unknown[];
  paymentMix: unknown[];
  hourly: unknown[];
  insight: unknown;
}

function runPython(scriptPath: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [scriptPath, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

export async function POST(request: Request) {
  let payload: PdfRequestPayload;
  try {
    payload = (await request.json()) as PdfRequestPayload;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const tmpDir = join(tmpdir(), "kacc-pdf");
  await mkdir(tmpDir, { recursive: true });
  const id = randomBytes(8).toString("hex");
  const inPath = join(tmpDir, `in-${id}.json`);
  const outPath = join(tmpDir, `out-${id}.pdf`);

  try {
    await writeFile(inPath, JSON.stringify(payload), "utf-8");
    const result = await runPython(SCRIPT_PATH, [inPath, outPath]);
    if (result.code !== 0) {
      return NextResponse.json(
        { error: "PDF generation failed", stderr: result.stderr.slice(0, 4000) },
        { status: 500 },
      );
    }
    const pdfBuffer = await readFile(outPath);
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
  } finally {
    // Cleanup
    await Promise.allSettled([unlink(inPath), unlink(outPath)]);
  }
}
