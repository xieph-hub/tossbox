// lib/prices/pythFeedIds.ts
import "server-only";

export const PYTH_FEED_IDS = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b6a9b4b2d9ff1b2f1a0b2a4",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",

  // Add the rest you support:
  // BNB: "...",
  // XRP: "...",
  // ADA: "...",
  // DOGE: "...",
} as const;

export type SupportedSymbol = keyof typeof PYTH_FEED_IDS;

export function assertSupportedSymbol(symbolRaw: string): SupportedSymbol {
  const symbol = (symbolRaw || "").toString().trim().toUpperCase();
  if (!symbol) throw new Error("Missing symbol");
  if (!(symbol in PYTH_FEED_IDS)) {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }
  return symbol as SupportedSymbol;
}
