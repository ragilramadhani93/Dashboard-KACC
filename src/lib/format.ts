import type { TransactionRecord } from "./types";

/**
 * Normalize a payment method string.
 * Input "• DANA" -> "DANA"
 * Input "• Cash" -> "Cash"
 */
export function normalizePayment(raw: string): string {
  if (!raw) return "Unknown";
  return raw.replace(/^[\s•]+/, "").trim() || "Unknown";
}

/**
 * Derive item category from item name.
 * Categories:
 * - Packaging: PACKAGING FEE
 * - Merchandise: CUP ...
 * - Coffee: kopi-based drinks
 * - Non-Coffee: non-coffee drinks (matcha, chocolate, soda, tea, air mineral)
 * - Snack: light snacks (ice cream, wingko, cookies, kue kering)
 * - Pastry: bakery items (croissant, pie, cake, roll, puff, cinnamon)
 * - RTD: ready-to-drink packaged beverages (GD ..., RTD suffix, ABC ...)
 * - Other: fallback
 */
export function deriveItemCategory(itemName: string): string {
  const name = (itemName || "").toUpperCase().trim();
  if (!name) return "Other";

  // 1. Special packaging / merchandise
  if (name.startsWith("PACKAGING")) return "Packaging";
  if (name.startsWith("CUP ")) return "Merchandise";

  // 2. Water & basic drinks
  if (name.startsWith("AIR MINERAL")) return "Non-Coffee";
  if (name.startsWith("ABC ")) return "RTD"; // ABC SUSU, ABC CHOCOMALT - packaged

  // 3. Coffee drinks
  const coffeeKeywords = [
    "COFFEE",
    "LATTE",
    "AMERICANO",
    "CAPPUCCINO",
    "ESPRESSO",
    "KOPI",
    "AFFOGATO",
    "FLAT WHITE",
    "COLD BREW",
    "DRIP COFFEE",
    "MOCHA",
    "BROWN SUGAR",
    "MATCHA LATTE",
    "CHOCO LATTE",
    "VANILLA LATTE",
    "JAVA LATTE",
    "WHITE COFFEE",
    "SIGNATURE",
    "ST CAFETIERO",
    "KA SIGNATURE",
    "ARENA COFFEE",
    "BUTTER COFFEE",
    "PEANUT BUTTER WHITE",
  ];
  if (coffeeKeywords.some((k) => name.includes(k))) {
    // GD (Grace Drinks) packaged coffee variants -> RTD
    if (name.startsWith("GD ") && name.includes("RTD")) return "RTD";
    return "Coffee";
  }

  // 4. RTD (Ready-to-Drink packaged beverages - GD series, etc.)
  if (name.includes(" RTD")) return "RTD";
  if (name.startsWith("GD ")) return "RTD";
  if (name.startsWith("LOVY ")) return "RTD";
  if (name.startsWith("DANISH ")) return "RTD";
  if (name.startsWith("BONTEH")) return "RTD";

  // 5. Non-coffee drinks (matcha/choco/tea/soda without "latte" suffix)
  const nonCoffeeKeywords = ["MATCHA", "SIRUP", "SODA", "TEA", "TEH", "OAT MILK"];
  if (nonCoffeeKeywords.some((k) => name.includes(k))) return "Non-Coffee";

  // 6. Smoothies / Float / Bliss / Sunrise / Blossom (signature non-coffee drinks)
  const drinkKeywords = [
    "SMOOTHIES",
    "FLOAT",
    "BLISS",
    "SUNRISE",
    "BLOSSOM",
    "PROFFEE",
    "COCOPANDAN",
  ];
  if (drinkKeywords.some((k) => name.includes(k))) return "Non-Coffee";

  // 7. Pastry (bakery items)
  const pastryKeywords = [
    "CAKE",
    "CROISSANT",
    "PIE",
    "ROLL",
    "PUFF",
    "CINNAMON",
    "BROWNIES",
    "BREAD",
    "DONUT",
    "MUFFIN",
    "WAFFLE",
    "PANCAKE",
  ];
  if (pastryKeywords.some((k) => name.includes(k))) return "Pastry";

  // 8. Snack (light snacks / kue kering / kue tradisional)
  const snackKeywords = [
    "ICE CREAM",
    "WINGKO",
    "COOKIES",
    "CREAM CHEESE", // small topping-style
    "BISCUIT",
    "CRACKER",
    "CHIPS",
    "KERIPIK",
    "KUE",
    "NASTAR",
    "KASTENGEL",
    "SORABI",
    "ROTI",
  ];
  if (snackKeywords.some((k) => name.includes(k))) return "Snack";

  // 9. Fallback to snack (most "Other" items are food/snacks at KACC)
  // If contains "RTD" or known drink suffix, non-coffee; else Snack
  return "Other";
}

/**
 * Parse a "YYYY-MM-DD HH:MM:SS" date string into a Date object.
 * Returns null if unparseable.
 */
export function parseSheetDate(raw: string): Date | null {
  const s = (raw || "").trim();
  if (!s) return null;
  // YYYY-MM-DD HH:MM:SS
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) {
    const dt = new Date(
      Date.UTC(
        parseInt(m[1], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[3], 10),
        parseInt(m[4], 10),
        parseInt(m[5], 10),
        parseInt(m[6], 10),
      ),
    );
    if (!isNaN(dt.getTime())) return dt;
  }
  // Fallback to Date.parse
  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t);
  return null;
}

/**
 * Parse a number from a sheet field. Returns 0 for empty / unparseable.
 */
export function parseNumber(raw: string): number {
  if (!raw) return 0;
  const s = String(raw).replace(/[,\s]/g, "").trim();
  if (s === "") return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Format ISO date into "YYYY-MM-DD" using UTC to match sheet timestamps.
 */
export function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Format currency to Indonesian Rupiah compact (e.g. "Rp 23,5 Jt").
 */
export function formatRupiah(n: number, compact = true): string {
  if (compact) {
    if (Math.abs(n) >= 1_000_000_000) {
      return `Rp ${(n / 1_000_000_000).toFixed(2).replace(".", ",")} M`;
    }
    if (Math.abs(n) >= 1_000_000) {
      return `Rp ${(n / 1_000_000).toFixed(1).replace(".", ",")} Jt`;
    }
    if (Math.abs(n) >= 1_000) {
      return `Rp ${(n / 1_000).toFixed(0)} rb`;
    }
    return `Rp ${n.toFixed(0)}`;
  }
  return `Rp ${n.toLocaleString("id-ID")}`;
}

/**
 * Format full Rupiah with thousand separators.
 */
export function formatRupiahFull(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

/**
 * Format a number with thousand separators.
 */
export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("id-ID");
}

/**
 * Format a percentage.
 */
export function formatPct(n: number, digits = 1): string {
  const v = n.toFixed(digits).replace(".", ",");
  return `${v}%`;
}

/**
 * Compute percentage change (current vs previous). Returns 0 if base is 0.
 */
export function pctChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Pretty label for an outlet name: strip "KACC - " prefix.
 */
export function cleanOutletName(outlet: string): string {
  if (!outlet) return "Unknown";
  return outlet.replace(/^KACC\s*-\s*/i, "").replace(/^KACC\s+/i, "").trim() || outlet;
}
