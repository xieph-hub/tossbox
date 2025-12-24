// lib/prices/pythFeedIds.ts
import "server-only";

/**
 * TossBox allowlist.
 * These are the symbols your game accepts in URLs / API payloads.
 *
 * IMPORTANT:
 * - This does NOT hardcode Pyth feed IDs.
 * - Feed IDs are resolved dynamically in pythCache.ts via Hermes search.
 *
 * Add/remove symbols here anytime.
 */
export const SUPPORTED_SYMBOLS = [
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "XRP",
  "ADA",
  "DOGE",
  "MATIC",
  "DOT",
  "AVAX",
  "SHIB",
  "LINK",
  "UNI",
  "LTC",
  "TRX",
  "ATOM",
  "XLM",
  "ETC",
  "FIL",
  "HBAR",
  "APT",
  "ARB",
  "OP",
  "NEAR",
  "AAVE",
  "STX",
  "INJ",
  "SUI",
  "IMX",
  "RENDER",
  "FET",
  "PEPE",
] as const;

export type SupportedSymbol = (typeof SUPPORTED_SYMBOLS)[number];

export function assertSupportedSymbol(symbolRaw: string): SupportedSymbol {
  const symbol = (symbolRaw || "").toString().trim().toUpperCase();
  if (!symbol) throw new Error("Missing symbol");

  if (!(SUPPORTED_SYMBOLS as readonly string[]).includes(symbol)) {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }

  return symbol as SupportedSymbol;
}
