import type { Currency } from "@/types";

export interface CurrencyInfo {
  code: Currency;
  symbol: string;
  name: string;
}

/** Supported currencies (valid ISO codes). */
export const CURRENCIES: Record<Currency, CurrencyInfo> = {
  NGN: { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  USD: { code: "USD", symbol: "$", name: "US Dollar" },
  GHS: { code: "GHS", symbol: "₵", name: "Ghanaian Cedi" },
  KES: { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  ZAR: { code: "ZAR", symbol: "R", name: "South African Rand" },
  RWF: { code: "RWF", symbol: "FRw", name: "Rwandan Franc" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound" },
  EUR: { code: "EUR", symbol: "€", name: "Euro" },
};

export const CURRENCY_LIST: CurrencyInfo[] = Object.values(CURRENCIES);

export function currencySymbol(currency: Currency): string {
  return CURRENCIES[currency]?.symbol ?? "₦";
}

/** Format an amount in the given currency, e.g. "₦45,000", "KSh 1,200". */
export function formatMoney(amount: number, currency: Currency = "NGN"): string {
  const sym = currencySymbol(currency);
  const sign = amount < 0 ? "-" : "";
  const num = Math.abs(Math.round(amount)).toLocaleString("en-US");
  // Multi-character symbols (KSh, FRw) read better with a space.
  return sym.length > 1 ? `${sign}${sym} ${num}` : `${sign}${sym}${num}`;
}
