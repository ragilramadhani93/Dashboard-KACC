import { NextResponse } from "next/server";

/**
 * Super simple ping endpoint - zero dependencies, zero DB calls.
 * Just returns { ok: true, timestamp }.
 *
 * Use this to verify the Next.js server is running at all.
 * If this fails with ERR_INVALID_RESPONSE, the server is NOT running
 * (build failed, crashed on startup, or OOM).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || "unknown",
  });
}
