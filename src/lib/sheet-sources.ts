/**
 * Data access layer for SheetSource management.
 *
 * A SheetSource represents one Google Sheet tab that contains KACC transaction
 * records (typically 1 sheet per month). Only one source can be `isActive`
 * at a time - that's the one the dashboard fetches.
 */
import { db } from "@/lib/db";

export interface SheetSourceDTO {
  id: string;
  label: string;
  sheetId: string;
  gid: string;
  isActive: boolean;
  note: string | null;
  dataStart: string | null;
  dataEnd: string | null;
  rowCount: number | null;
  lastFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDTO(s: {
  id: string;
  label: string;
  sheetId: string;
  gid: string;
  isActive: boolean;
  note: string | null;
  dataStart: string | null;
  dataEnd: string | null;
  rowCount: number | null;
  lastFetchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SheetSourceDTO {
  return {
    id: s.id,
    label: s.label,
    sheetId: s.sheetId,
    gid: s.gid,
    isActive: s.isActive,
    note: s.note,
    dataStart: s.dataStart,
    dataEnd: s.dataEnd,
    rowCount: s.rowCount,
    lastFetchedAt: s.lastFetchedAt ? s.lastFetchedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function listSheetSources(): Promise<SheetSourceDTO[]> {
  const rows = await db.sheetSource.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toDTO);
}

export async function getActiveSheetSource(): Promise<SheetSourceDTO | null> {
  const row = await db.sheetSource.findFirst({
    where: { isActive: true },
  });
  return row ? toDTO(row) : null;
}

export async function getSheetSourceById(id: string): Promise<SheetSourceDTO | null> {
  const row = await db.sheetSource.findUnique({ where: { id } });
  return row ? toDTO(row) : null;
}

/**
 * Activate a sheet source. Deactivates all others first.
 */
export async function activateSheetSource(id: string): Promise<SheetSourceDTO | null> {
  // Deactivate all in a transaction
  await db.$transaction([
    db.sheetSource.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    db.sheetSource.update({ where: { id }, data: { isActive: true, updatedAt: new Date() } }),
  ]);
  return getSheetSourceById(id);
}

/**
 * Update cached metadata (date range, row count, last fetched) for a sheet.
 */
export async function updateSheetSourceMetadata(
  id: string,
  metadata: {
    dataStart: string;
    dataEnd: string;
    rowCount: number;
    lastFetchedAt: Date;
  },
): Promise<void> {
  await db.sheetSource.update({
    where: { id },
    data: {
      dataStart: metadata.dataStart,
      dataEnd: metadata.dataEnd,
      rowCount: metadata.rowCount,
      lastFetchedAt: metadata.lastFetchedAt,
      updatedAt: new Date(),
    },
  });
}

export interface CreateSheetSourceInput {
  label: string;
  sheetId: string;
  gid: string;
  note?: string;
  /** If true, this sheet becomes the active one (deactivates others). Default: true. */
  activate?: boolean;
}

export async function createSheetSource(
  input: CreateSheetSourceInput,
): Promise<SheetSourceDTO> {
  const activate = input.activate ?? true;
  if (activate) {
    await db.sheetSource.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
  }
  const row = await db.sheetSource.create({
    data: {
      label: input.label,
      sheetId: input.sheetId,
      gid: input.gid,
      note: input.note ?? null,
      isActive: activate,
    },
  });
  return toDTO(row);
}

export async function deleteSheetSource(id: string): Promise<void> {
  await db.sheetSource.delete({ where: { id } });
}

/**
 * Update label / note for a sheet.
 */
export async function updateSheetSource(
  id: string,
  patch: { label?: string; note?: string | null },
): Promise<SheetSourceDTO | null> {
  const row = await db.sheetSource.update({
    where: { id },
    data: { ...patch, updatedAt: new Date() },
  });
  return toDTO(row);
}

/**
 * Parse a Google Sheets URL into sheetId + gid.
 * Accepts both the edit URL and the export URL formats.
 *
 * Examples accepted:
 *   https://docs.google.com/spreadsheets/d/ABC/edit#gid=123
 *   https://docs.google.com/spreadsheets/d/ABC/edit?gid=123#gid=123
 *   https://docs.google.com/spreadsheets/d/ABC/export?format=csv&gid=123
 *   Or just bare: ABC 123
 */
export function parseSheetUrl(input: string): { sheetId: string; gid: string } | null {
  const s = (input || "").trim();
  if (!s) return null;

  // Bare format: "sheetId gid"
  const bare = s.match(/^([a-zA-Z0-9_-]{20,})\s+([0-9]+)$/);
  if (bare) {
    return { sheetId: bare[1], gid: bare[2] };
  }
  // Bare sheetId only
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) {
    return { sheetId: s, gid: "0" };
  }

  // Edit URL: /d/{sheetId}/edit?#gid={gid}
  let m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})\/edit(?:[?#].*?(?:^|&|#|;)gid=([0-9]+))/);
  if (m) return { sheetId: m[1], gid: m[2] };

  m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})\/edit/);
  if (m) {
    const gidMatch = s.match(/[?#&;]gid=([0-9]+)/);
    return { sheetId: m[1], gid: gidMatch ? gidMatch[1] : "0" };
  }

  // Export URL: /d/{sheetId}/export?...gid={gid}
  m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})\/export/);
  if (m) {
    const gidMatch = s.match(/[?#&;]gid=([0-9]+)/);
    return { sheetId: m[1], gid: gidMatch ? gidMatch[1] : "0" };
  }

  // Generic: extract sheetId and gid from anywhere
  const idMatch = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  const gidMatch = s.match(/[?#&;]gid=([0-9]+)/);
  if (idMatch) {
    return { sheetId: idMatch[1], gid: gidMatch ? gidMatch[1] : "0" };
  }

  return null;
}

/**
 * Ensure the seed sheet (October 2026) exists in DB.
 * Idempotent - safe to call on every server boot.
 */
export async function ensureSeedSheet(): Promise<void> {
  const count = await db.sheetSource.count();
  if (count > 0) return;
  await db.sheetSource.create({
    data: {
      label: "Oktober 2026",
      sheetId: "1BBio_q7gdfyXUUtoPGdTestAECyQIg459Q83vRMrs5Y",
      gid: "1880411456",
      note: "Sheet awal (auto-seed)",
      isActive: true,
    },
  });
}
