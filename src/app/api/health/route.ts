import { NextResponse } from "next/server";
import {
  ensureSeedSheet,
  getActiveSheetSource,
  listSheetSources,
} from "@/lib/sheet-sources";
import { parseCsvToObjects } from "@/lib/csv-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health check endpoint for diagnosing production issues.
 *
 * Usage: GET /api/health
 * Returns JSON with detailed status of:
 * - Database connection & sheet sources count
 * - Active sheet source metadata
 * - Google Sheets fetch test (can production server reach Google?)
 * - Environment info (NODE_ENV, DATABASE_URL presence, build ID)
 *
 * No auth required - safe to expose for debugging.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string; data?: unknown }> = {};
  const startedAt = Date.now();

  // 1. Database connection test
  try {
    await ensureSeedSheet();
    const sources = await listSheetSources();
    checks.database = {
      ok: true,
      detail: `Connected. ${sources.length} sheet sources registered.`,
      data: {
        count: sources.length,
        sources: sources.map((s) => ({
          id: s.id,
          label: s.label,
          isActive: s.isActive,
          hasMetadata: !!(s.dataStart && s.dataEnd),
          dataStart: s.dataStart,
          dataEnd: s.dataEnd,
          rowCount: s.rowCount,
          lastFetchedAt: s.lastFetchedAt,
        })),
      },
    };
  } catch (e) {
    checks.database = {
      ok: false,
      detail: `Database error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // 2. Active sheet source
  try {
    const active = await getActiveSheetSource();
    checks.activeSheet = {
      ok: !!active,
      detail: active
        ? `Active sheet: ${active.label} (sheetId=${active.sheetId.slice(0, 12)}..., gid=${active.gid})`
        : "No active sheet source set",
      data: active
        ? {
            id: active.id,
            label: active.label,
            sheetId: active.sheetId,
            gid: active.gid,
            dataStart: active.dataStart,
            dataEnd: active.dataEnd,
            rowCount: active.rowCount,
            lastFetchedAt: active.lastFetchedAt,
          }
        : null,
    };
  } catch (e) {
    checks.activeSheet = {
      ok: false,
      detail: `Error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // 3. Google Sheets fetch test (network connectivity)
  try {
    const active = await getActiveSheetSource();
    if (!active) {
      checks.googleSheetsFetch = {
        ok: false,
        detail: "Cannot test - no active sheet source",
      };
    } else {
      const fetchUrl = `https://docs.google.com/spreadsheets/d/${active.sheetId}/export?format=csv&gid=${active.gid}`;
      const fetchStart = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
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
      const contentType = res.headers.get("content-type") || "";
      const contentLength = res.headers.get("content-length") || "unknown";

      if (res.ok) {
        // Try to read first 500 bytes to verify it's CSV, not HTML error page
        const text = await res.text();
        const preview = text.slice(0, 200);
        const isLikelyCsv = preview.includes(",") && !preview.toLowerCase().includes("<!doctype html");
        checks.googleSheetsFetch = {
          ok: isLikelyCsv,
          detail: isLikelyCsv
            ? `OK - HTTP ${res.status}, ${text.length} bytes, ${fetchMs}ms`
            : `Got HTTP ${res.status} but response is NOT CSV (likely HTML error page). First 200 chars: ${preview.replace(/\n/g, " ")}`,
          data: {
            httpStatus: res.status,
            contentType,
            contentLength,
            fetchMs,
            responseSize: text.length,
            firstChars: preview.replace(/\n/g, "\\n").slice(0, 150),
          },
        };
      } else {
        let reason = "";
        if (res.status === 403) {
          reason = " - Sheet must be shared as 'Anyone with link can view'";
        } else if (res.status === 404) {
          reason = " - Sheet not found, check sheetId or sheet may be deleted";
        } else if (res.status === 401) {
          reason = " - Authentication required";
        }
        checks.googleSheetsFetch = {
          ok: false,
          detail: `Failed - HTTP ${res.status}${reason} (${fetchMs}ms)`,
          data: {
            httpStatus: res.status,
            contentType,
            fetchMs,
            fetchUrl,
          },
        };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    checks.googleSheetsFetch = {
      ok: false,
      detail: `Network error: ${msg}`,
    };
  }

  // 4. Environment info
  checks.environment = {
    ok: true,
    data: {
      nodeEnv: process.env.NODE_ENV || "undefined",
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlValue: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.replace(/\/\/[^@]*@/, "//***@")
        : "(not set - using default)",
      hasAdminPin: !!process.env.ADMIN_PIN,
      buildId: process.env.NEXT_PUBLIC_BUILD_ID || "(not set)",
      platform: process.platform,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    },
  };

  // 5. CSV parser test
  try {
    const testCsv = "a,b,c\n1,2,3\n4,5,6";
    const result = parseCsvToObjects(testCsv);
    checks.csvParser = {
      ok: result.records.length === 2,
      detail: `OK - parsed ${result.records.length} records from test CSV`,
    };
  } catch (e) {
    checks.csvParser = {
      ok: false,
      detail: `Error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Overall status
  const allOk = Object.values(checks).every((c) => c.ok);
  const durationMs = Date.now() - startedAt;

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "unhealthy",
      overallOk: allOk,
      checks,
      meta: {
        durationMs,
        timestamp: new Date().toISOString(),
        serverTime: Date.now(),
      },
    },
    { status: allOk ? 200 : 503 },
  );
}
