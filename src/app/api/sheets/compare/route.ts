import { NextResponse } from "next/server";
import {
  computePrevMonthRange,
  fetchPrevMonthCompare,
} from "@/lib/dashboard/cross-sheet-compare";
import {
  applyFilter,
  computeKpi,
  computeDailyTrend,
  type FilterState,
} from "@/lib/dashboard/aggregate";
import type { KpiSummary, TrendPoint } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

interface CompareRequest {
  activeSourceId: string;
  currentDateRange: { start: string; end: string };
  filters?: Partial<FilterState>;
}

export interface CompareResponse {
  available: boolean;
  unavailableReason?: string;
  prevSource?: {
    id: string;
    label: string;
    sheetId: string;
    gid: string;
    dataStart: string | null;
    dataEnd: string | null;
  };
  prevDateRange: { start: string; end: string };
  prevKpi?: KpiSummary;
  prevDailyTrend?: TrendPoint[];
  recordCount: number;
}

export async function POST(request: Request) {
  let body: CompareRequest;
  try {
    body = (await request.json()) as CompareRequest;
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  if (!body.activeSourceId) {
    return NextResponse.json({ error: "activeSourceId wajib" }, { status: 400 });
  }
  if (!body.currentDateRange?.start || !body.currentDateRange?.end) {
    return NextResponse.json({ error: "currentDateRange.start & end wajib" }, { status: 400 });
  }

  try {
    const result = await fetchPrevMonthCompare(
      body.activeSourceId,
      body.currentDateRange,
    );

    if (!result.available) {
      const response: CompareResponse = {
        available: false,
        unavailableReason: result.unavailableReason,
        prevDateRange: result.prevDateRange,
        recordCount: 0,
      };
      return NextResponse.json(response);
    }

    // Apply same filters (outlets, payments, categories) to prev records,
    // but with the prev-month date range
    const filterState: FilterState = {
      dateStart: result.prevDateRange.start,
      dateEnd: result.prevDateRange.end,
      outlets: body.filters?.outlets ?? [],
      payments: body.filters?.payments ?? [],
      itemCategories: body.filters?.itemCategories ?? [],
      menuTypes: body.filters?.menuTypes ?? [],
    };
    const filtered = applyFilter(result.prevRecords, filterState);
    const prevKpi = computeKpi(filtered);
    const prevDailyTrend = computeDailyTrend(filtered);

    const response: CompareResponse = {
      available: true,
      prevSource: result.prevSource
        ? {
            id: result.prevSource.id,
            label: result.prevSource.label,
            sheetId: result.prevSource.sheetId,
            gid: result.prevSource.gid,
            dataStart: result.prevSource.dataStart,
            dataEnd: result.prevSource.dataEnd,
          }
        : undefined,
      prevDateRange: result.prevDateRange,
      prevKpi,
      prevDailyTrend,
      recordCount: filtered.length,
    };
    return NextResponse.json(response);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Cross-sheet compare failed: ${msg}` },
      { status: 500 },
    );
  }
}

// Re-export for use elsewhere
export { computePrevMonthRange };
