// lib/prices/pythCache.ts
import "server-only";
import { HermesClient } from "@pythnetwork/hermes-client";

export type PythPx = {
  price: number;
  conf?: number | null;
  publishTime: number; // unix seconds
  feedId: string;
  symbol: string; // e.g. "Crypto.BTC/USD"
  source: "pyth";
};

const HERMES_URL = process.env.PYTH_HERMES_URL || "https://hermes.pyth.network";
const client = new HermesClient(HERMES_URL);

// In-memory cache (resets on cold start; OK for serverless)
const FEED_ID_CACHE = new Map<string, { feedId: string; feedSymbol: string }>();

function normalizeSymbol(input: string) {
  return (input || "").toString().toUpperCase().trim();
}

function looksLikeUsdPair(feedSymbolUpper: string, base: string) {
  const s = feedSymbolUpper.replace(/\s+/g, "");
  return s.includes(`${base}/USD`) || s.endsWith(`${base}/USD`);
}

/**
 * Resolve a Pyth feed id for a symbol.
 * Uses Hermes search. Prefers USD pairs.
 */
async function resolveFeedId(symbolRaw: string): Promise<{ feedId: string; feedSymbol: string }> {
  const base = normalizeSymbol(symbolRaw);
  if (!base) throw new Error("Missing symbol");

  const cached = FEED_ID_CACHE.get(base);
  if (cached) return cached;

  // IMPORTANT: hermes-client expects an object param in your installed version
  const feeds = await client.getPriceFeeds({
    query: base,
    assetType: "crypto",
  });

  if (!feeds || feeds.length === 0) {
    throw new Error(`No Pyth feeds found for symbol query: ${base}`);
  }

  // Prefer an exact USD pair if present
  const preferred = feeds.find((f: any) => {
    const sym = (f?.attributes?.symbol || "").toString().toUpperCase();
    return looksLikeUsdPair(sym, base);
  });

  const picked = preferred || feeds[0];
  const feedId = picked?.id;
  const feedSymbol = (picked?.attributes?.symbol || `${base}/USD`).toString();

  if (!feedId) throw new Error(`Failed to resolve feed id for ${base}`);

  const result = { feedId, feedSymbol };
  FEED_ID_CACHE.set(base, result);
  return result;
}

function normalizePythPrice(priceObj: any): { price: number; conf?: number | null; publishTime: number } {
  // Parsed Hermes price objects typically include: price, conf, expo, publish_time
  const price = Number(priceObj?.price);
  const conf = priceObj?.conf != null ? Number(priceObj.conf) : null;
  const expo = Number(priceObj?.expo);
  const publishTime = Number(priceObj?.publish_time);

  if (!Number.isFinite(price) || !Number.isFinite(expo) || !Number.isFinite(publishTime)) {
    throw new Error("Invalid Pyth price object");
  }

  const realPrice = price * Math.pow(10, expo);
  const realConf = conf != null ? conf * Math.pow(10, expo) : null;

  if (!Number.isFinite(realPrice)) throw new Error("Invalid normalized Pyth price");

  return { price: realPrice, conf: realConf, publishTime };
}

export async function getPythUsdPrice(symbolRaw: string): Promise<PythPx> {
  const base = normalizeSymbol(symbolRaw);
  const { feedId, feedSymbol } = await resolveFeedId(base);

  // hermes-client: latest updates with parsed = true
  const latest = await client.getLatestPriceUpdates([feedId], { parsed: true });

  const parsed = latest?.parsed?.[0];
  const priceObj = parsed?.price;

  if (!priceObj) throw new Error(`No latest price returned for feed ${feedId} (${feedSymbol})`);

  const norm = normalizePythPrice(priceObj);

  return {
    feedId,
    symbol: feedSymbol,
    price: norm.price,
    conf: norm.conf ?? null,
    publishTime: norm.publishTime,
    source: "pyth",
  };
}
