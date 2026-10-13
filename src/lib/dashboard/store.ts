"use client";
import { create } from "zustand";
import type { FilterState, CompareState } from "./aggregate";

export type PresetRange = "today" | "yesterday" | "last7" | "last14" | "last30" | "mtd" | "all";

interface DashboardStoreState {
  // Filter state
  preset: PresetRange;
  dateStart: string;
  dateEnd: string;
  outlets: string[];
  payments: string[];
  itemCategories: string[];
  menuTypes: string[];

  // Compare mode
  compareEnabled: boolean;
  prevDateStart: string;
  prevDateEnd: string;

  // Insight state
  insightLoading: boolean;
  insightNarrative: string;
  insightHighlights: string[];
  insightAlerts: string[];
  insightGeneratedAt: string | null;

  // Actions
  setPreset: (preset: PresetRange, dateRange: { start: string; end: string }) => void;
  setDateRange: (start: string, end: string) => void;
  toggleOutlet: (outlet: string) => void;
  setOutlets: (outlets: string[]) => void;
  clearOutlets: () => void;
  togglePayment: (payment: string) => void;
  setPayments: (payments: string[]) => void;
  clearPayments: () => void;
  toggleItemCategory: (category: string) => void;
  setItemCategories: (cats: string[]) => void;
  clearItemCategories: () => void;
  setCompareEnabled: (enabled: boolean) => void;
  setCompareRange: (prevStart: string, prevEnd: string) => void;

  setInsight: (data: {
    narrative: string;
    highlights: string[];
    alerts: string[];
    generatedAt: string;
  }) => void;
  setInsightLoading: (loading: boolean) => void;

  getFilter: () => FilterState;
  getCompare: () => CompareState;
  resetAllFilters: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, days: number): string {
  if (!dateStr) return "";
  const t = Date.parse(dateStr + "T00:00:00Z");
  if (isNaN(t)) return "";
  return new Date(t + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function computePresetRange(
  preset: PresetRange,
  dataRange: { start: string; end: string },
): { start: string; end: string } {
  const todayStr = dataRange.end || today();
  switch (preset) {
    case "today":
      return { start: todayStr, end: todayStr };
    case "yesterday":
      return { start: shiftDate(todayStr, -1), end: shiftDate(todayStr, -1) };
    case "last7":
      return { start: shiftDate(todayStr, -6), end: todayStr };
    case "last14":
      return { start: shiftDate(todayStr, -13), end: todayStr };
    case "last30":
      return { start: shiftDate(todayStr, -29), end: todayStr };
    case "mtd":
      return { start: todayStr.slice(0, 8) + "01", end: todayStr };
    case "all":
      return { start: dataRange.start || todayStr, end: todayStr };
    default:
      return { start: shiftDate(todayStr, -6), end: todayStr };
  }
}

export function computeCompareRange(
  currentStart: string,
  currentEnd: string,
): { prevStart: string; prevEnd: string } {
  if (!currentStart || !currentEnd) {
    return { prevStart: "", prevEnd: "" };
  }
  const startT = Date.parse(currentStart + "T00:00:00Z");
  const endT = Date.parse(currentEnd + "T00:00:00Z");
  if (isNaN(startT) || isNaN(endT)) return { prevStart: "", prevEnd: "" };
  const spanMs = endT - startT + 24 * 60 * 60 * 1000;
  const prevEndT = startT - 24 * 60 * 60 * 1000;
  const prevStartT = prevEndT - spanMs + 24 * 60 * 60 * 1000;
  return {
    prevStart: new Date(prevStartT).toISOString().slice(0, 10),
    prevEnd: new Date(prevEndT).toISOString().slice(0, 10),
  };
}

export const useDashboardStore = create<DashboardStoreState>((set, get) => ({
  preset: "last7",
  dateStart: "",
  dateEnd: "",
  outlets: [],
  payments: [],
  itemCategories: [],
  menuTypes: [],

  compareEnabled: false,
  prevDateStart: "",
  prevDateEnd: "",

  insightLoading: false,
  insightNarrative: "",
  insightHighlights: [],
  insightAlerts: [],
  insightGeneratedAt: null,

  setPreset: (preset, dataRange) => {
    const range = computePresetRange(preset, dataRange);
    const compare = computeCompareRange(range.start, range.end);
    set({
      preset,
      dateStart: range.start,
      dateEnd: range.end,
      prevDateStart: compare.prevStart,
      prevDateEnd: compare.prevEnd,
    });
  },
  setDateRange: (start, end) => {
    const compare = computeCompareRange(start, end);
    set({
      dateStart: start,
      dateEnd: end,
      preset: "all",
      prevDateStart: compare.prevStart,
      prevDateEnd: compare.prevEnd,
    });
  },
  toggleOutlet: (outlet) => {
    const cur = get().outlets;
    if (cur.includes(outlet)) {
      set({ outlets: cur.filter((o) => o !== outlet) });
    } else {
      set({ outlets: [...cur, outlet] });
    }
  },
  setOutlets: (outlets) => set({ outlets }),
  clearOutlets: () => set({ outlets: [] }),

  togglePayment: (payment) => {
    const cur = get().payments;
    if (cur.includes(payment)) {
      set({ payments: cur.filter((p) => p !== payment) });
    } else {
      set({ payments: [...cur, payment] });
    }
  },
  setPayments: (payments) => set({ payments }),
  clearPayments: () => set({ payments: [] }),

  toggleItemCategory: (category) => {
    const cur = get().itemCategories;
    if (cur.includes(category)) {
      set({ itemCategories: cur.filter((c) => c !== category) });
    } else {
      set({ itemCategories: [...cur, category] });
    }
  },
  setItemCategories: (cats) => set({ itemCategories: cats }),
  clearItemCategories: () => set({ itemCategories: [] }),

  setCompareEnabled: (enabled) => set({ compareEnabled: enabled }),
  setCompareRange: (prevStart, prevEnd) =>
    set({ prevDateStart: prevStart, prevDateEnd: prevEnd }),

  setInsight: (data) =>
    set({
      insightNarrative: data.narrative,
      insightHighlights: data.highlights,
      insightAlerts: data.alerts,
      insightGeneratedAt: data.generatedAt,
      insightLoading: false,
    }),
  setInsightLoading: (loading) => set({ insightLoading: loading }),

  getFilter: () => ({
    dateStart: get().dateStart,
    dateEnd: get().dateEnd,
    outlets: get().outlets,
    payments: get().payments,
    itemCategories: get().itemCategories,
    menuTypes: get().menuTypes,
  }),
  getCompare: () => ({
    enabled: get().compareEnabled,
    prevDateStart: get().prevDateStart,
    prevDateEnd: get().prevDateEnd,
  }),
  resetAllFilters: () =>
    set({
      outlets: [],
      payments: [],
      itemCategories: [],
      menuTypes: [],
    }),
}));
