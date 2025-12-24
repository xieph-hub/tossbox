// lib/prices/pythCache.ts
import "server-only";
import { HermesClient } from "@pythnetwork/hermes-client";

type PythPx = {
  price: number;
  conf?: number | null;
  publishTime: number; // unix seconds
  feedId: string;
  symbol: string;
};

const HERMES_URL = process.env.PYTH_HERMES_URL || "https://hermes.pyth.network";
const client = new HermesClient(HERMES_URL);

// In-memory cache (good enough for serverless; will refill on cold starts)
const FEED_ID_CACHE = new Map<string, string>();

function normalizeSymbol(input: string) {
  return input.toUpperCase().trim();
}

/**
 * Try to find a Pyth feed id for a symbol.
 * We bias toward USD pairs.
 */
async function resolveFeedId(symbolRaw: string): Promise<{ feedId: string; feedSymbol: string }> {
  const symbol = normalizeSymbol(symbolRaw);
  const cached = FEED_ID_CACHE.get(symbol);
  if (cached) return { feedId: cached, feedSymbol: `${symbol}/USD` };

  // Hermes search (client-side search by query)
  // NOTE: In hermes-client v2, method is getPriceFeeds (NOT getLatestPriceFeeds).
  const feeds = await client.getPriceFeeds(symbol);

  if (!feeds || feeds.length === 0) {
    throw new Error(`No Pyth feeds found for symbol query: ${symbol}`);
  }

  // We prefer an exact USD pair if present
  // Common formats you may see: "Crypto.BTC/USD", "BTC/USD", etc.
  const preferred = feeds.find((f: any) => {
    const s = (f?.attributes?.symbol || "").toString().toUpperCase();
    return s.includes(`${symbol}/USD`) || s.includes(`${symbol} / USD`) || s.endsWith(`${symbol}/USD`);
  });

  const picked = preferred || feeds[0];
  const feedId = picked?.id;
  const feedSymbol = picked?.attributes?.symbol || `${symbol}/USD`;

  if (!feedId) throw new Error(`Failed to resolve feed id for ${symbol}`);

  FEED_ID_CACHE.set(symbol, feedId);
  return { feedId, feedSymbol };
}

function normalizePythPrice(priceObj: any): { price: number; conf?: number | null; publishTime: number } {
  // Hermes “parsed” price objects typically include:
  // price, conf, expo, publish_time
  const price = Number(priceObj?.price);
  const conf = priceObj?.conf != null ? Number(priceObj.conf) : null;
  const expo = Number(priceObj?.expo);
  const publishTime = Number(priceObj?.publish_time);

  if (!Number.isFinite(price) || !Number.isFinite(expo) || !Number.isFinite(publishTime)) {
    throw new Error("Invalid Pyth price object");
  }

  // apply exponent: realPrice = price * 10^expo
  const real = price * Math.pow(10, expo);
  const realConf = conf != null ? conf * Math.pow(10, expo) : null;

  return { price: real, conf: realConf, publishTime };
}

export async function getPythUsdPrice(symbolRaw: string): Promise<PythPx> {
  const symbol = normalizeSymbol(symbolRaw);
  const { feedId, feedSymbol } = await resolveFeedId(symbol);

  // Hermes latest update (parsed)
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
  };
}
