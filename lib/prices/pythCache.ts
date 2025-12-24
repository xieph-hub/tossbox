// lib/prices/pythCache.ts
import "server-only";

import { HermesClient } from "@pythnetwork/hermes-client";
import { PYTH_FEED_IDS, assertSupportedSymbol, type SupportedSymbol } from "./pythFeedIds";

const HERMES_URL = process.env.PYTH_HERMES_URL || "https://hermes.pyth.network";

// Small cache to reduce Hermes calls when your API is hit repeatedly.
// (On Vercel serverless, this only helps within a warm lambda instance.)
const DEFAULT_CACHE_MS = 2_000;

type PythUsdPrice = {
  symbol: SupportedSymbol;
  feedId: string;
  price: number; // normalized USD price
  conf: number | null; // normalized USD confidence interval
  publishTime: number; // unix seconds
};

type CacheEntry = { ts: number; value: PythUsdPrice };
const cache = new Map<string, CacheEntry>();

function normalizePriceObj(priceObj: any): { price: number; conf: number | null; publishTime: number } | null {
  // Expected (typical) fields: price, conf, expo, publish_time
  if (!priceObj) return null;

  const priceInt = Number(priceObj.price);
  const confInt = priceObj.conf === undefined || priceObj.conf === null ? null : Number(priceObj.conf);
  const expo = Number(priceObj.expo);
  const publishTime = Number(priceObj.publish_time);

  if (!Number.isFinite(priceInt) || !Number.isFinite(expo) || !Number.isFinite(publishTime)) return null;

  // expo is usually negative, so 10^expo is a fraction.
  const scale = Math.pow(10, expo);
  const price = priceInt * scale;

  if (!Number.isFinite(price) || price <= 0) return null;

  let conf: number | null = null;
  if (confInt !== null && Number.isFinite(confInt)) {
    const confScaled = confInt * scale;
    conf = Number.isFinite(confScaled) ? confScaled : null;
  }

  return { price, conf, publishTime };
}

export async function getPythUsdPrice(symbolRaw: string, opts?: { cacheMs?: number }): Promise<PythUsdPrice> {
  const symbol = assertSupportedSymbol(symbolRaw);
  const feedId = PYTH_FEED_IDS[symbol];
  const cacheMs = opts?.cacheMs ?? DEFAULT_CACHE_MS;

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.ts < cacheMs) return cached.value;

  const client = new HermesClient(HERMES_URL);

  // ✅ Your Hermes client version supports this method
  const feeds: any[] = await client.getPriceFeeds([feedId]);
  const feed = feeds?.[0];

  // Most common shape: feed.price
  const norm = normalizePriceObj(feed?.price);

  if (!norm) {
    throw new Error(`Invalid Pyth response for ${symbol} (feedId=${feedId})`);
  }

  const out: PythUsdPrice = {
    symbol,
    feedId,
    price: norm.price,
    conf: norm.conf,
    publishTime: norm.publishTime,
  };

  cache.set(symbol, { ts: Date.now(), value: out });
  return out;
}
