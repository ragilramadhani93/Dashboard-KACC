/**
 * Admin PIN verification.
 *
 * Default PIN: "kacc2026" (can be overridden via ADMIN_PIN env var).
 * Client should send PIN via `X-Admin-PIN` header on mutating requests.
 */

const DEFAULT_PIN = "kacc2026";

export function getExpectedPin(): string {
  return process.env.ADMIN_PIN?.trim() || DEFAULT_PIN;
}

/**
 * Verify that the request carries the correct admin PIN.
 * Reads from `X-Admin-PIN` header (preferred) or `pin` query param (fallback).
 *
 * Returns { ok: true } on success, { ok: false, error } on failure.
 */
export function verifyAdminPin(request: Request): { ok: boolean; error?: string } {
  const expected = getExpectedPin();
  const headerPin = request.headers.get("x-admin-pin");
  const queryPin = new URL(request.url).searchParams.get("pin");
  const provided = headerPin ?? queryPin;

  if (!provided) {
    return { ok: false, error: "PIN admin wajib dikirim (header X-Admin-PIN)" };
  }
  if (provided !== expected) {
    return { ok: false, error: "PIN admin salah" };
  }
  return { ok: true };
}
