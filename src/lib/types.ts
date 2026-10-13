/**
 * Domain types & shared interfaces for the KACC dashboard.
 */

export interface TransactionRecord {
  /** Transaction number (unique per bill, shared across line items) */
  txn: string;
  /** Opened date ISO */
  openedAt: string;
  /** Closed date ISO */
  closedAt: string;
  /** Date only (YYYY-MM-DD) derived from openedAt */
  date: string;
  /** Hour (0-23) derived from openedAt */
  hour: number;
  /** Outlet name */
  outlet: string;
  /** Payment method (normalized, bullet stripped) */
  payment: string;
  /** Transaction type: Takeaway / Delivery */
  txnType: string;
  /** Status: Close / Void / Open */
  status: string;
  /** Menu code */
  menuCode: string;
  /** Item name */
  item: string;
  /** Menu type */
  menuType: string;
  /** Quantity */
  qty: number;
  /** Unit price */
  price: number;
  /** Sub total for this line */
  subTotal: number;
  /** Discount applied to this line item */
  discountItem: number;
  /** Discount applied to transaction */
  discountTrans: number;
  /** Tax */
  tax: number;
  /** Rounding adjustment */
  rounding: number;
  /** Grand total final for this line */
  grandTotal: number;
  /** Payment detail string (e.g. "DANA (Rp 8.000)") */
  paymentDetail: string;
  /** Item category (derived: coffee / non-coffee / packaging / other) */
  itemCategory: string;
}

export interface DashboardMeta {
  lastUpdated: string;
  rowCount: number;
  dateRange: { start: string; end: string };
  outlets: string[];
  paymentMethods: string[];
  menuTypes: string[];
  items: string[];
  itemCategories: string[];
  source: string;
  cachedAt: string;
  /** ID of the active SheetSource (so client knows which sheet is being viewed). */
  sheetSourceId?: string | null;
}

export interface DashboardData {
  meta: DashboardMeta;
  records: TransactionRecord[];
}

export interface KpiSummary {
  revenue: number;
  transactions: number;
  items: number;
  outlets: number;
  aov: number;
  avgItemsPerTxn: number;
  uniqueItemTypes: number;
  peakHour: number;
}

export interface TrendPoint {
  date: string;
  revenue: number;
  transactions: number;
  items: number;
}

export interface OutletAgg {
  outlet: string;
  revenue: number;
  transactions: number;
  items: number;
  avgPerTxn: number;
}

export interface ItemAgg {
  item: string;
  category: string;
  qty: number;
  revenue: number;
  transactions: number;
}

export interface PaymentAgg {
  payment: string;
  revenue: number;
  transactions: number;
  share: number;
}

export interface HourAgg {
  hour: number;
  revenue: number;
  transactions: number;
}

export interface HeatmapCell {
  outlet: string;
  date: string;
  revenue: number;
  transactions: number;
}

export interface InsightRequest {
  meta: DashboardMeta;
  kpi: KpiSummary;
  prevKpi: KpiSummary | null;
  topOutlets: OutletAgg[];
  topItems: ItemAgg[];
  paymentMix: PaymentAgg[];
  dailyTrend: TrendPoint[];
  peakHour: number;
  filters: {
    dateRange: { start: string; end: string };
    outlets: string[];
    payments: string[];
    itemCategories: string[];
  };
}

export interface InsightResponse {
  narrative: string;
  highlights: string[];
  alerts: string[];
  generatedAt: string;
}
