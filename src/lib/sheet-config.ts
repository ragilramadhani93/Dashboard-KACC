/**
 * Google Sheets source config.
 * Sheet: KACC daily transactions (auto-updated daily by ops team).
 */
export const SHEET_CONFIG = {
  sheetId: "1BBio_q7gdfyXUUtoPGdTestAECyQIg459Q83vRMrs5Y",
  gid: "1880411456",
} as const;

export function buildCsvUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_CONFIG.sheetId}/export?format=csv&gid=${SHEET_CONFIG.gid}`;
}
