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

// In-memory cache (OK for serverless; refills on cold starts)
const FEED_ID_CACHE = new Map<string, { feedId: string; feedSymbol: string }>();

function normalizeSymbol(input: string) {
  return input.toUpperCase().trim();
}

/**
 * Hermes feed search can return multiple matches.
 * We bias to an exact USD pair where possible.
 *
 * Production note:
 * For settlement, prefer an explicit allowlist of {SYMBOL -> FEED_ID}
 * taken from Pyth's official feed catalogue. :contentReference[oaicite:1]{index=1}
 */
async function resolveFeedId(symbolRaw: string): Promise<{ feedId: string; feedSymbol: string }> {
  const symbol = normalizeSymbol(symbolRaw);

  const cached = FEED_ID_CACHE.get(symbol);
  if (cached) return cached;

  // Prefer querying the USD pair to reduce ambiguous results
  const query = `${symbol}/USD`;

  // hermes-client v2: getPriceFeeds(query)
  const feeds: any[] = await client.getPriceFeeds(query);

  if (!feeds || feeds.length === 0) {
    // fallback: try raw symbol query (some feeds include prefixes like "Crypto.")
    const fallbackFeeds: any[] = await client.getPriceFeeds(symbol);
    if (!fallbackFeeds || fallbackFeeds.length === 0) {
      throw new Error(`No Pyth feeds found for symbol query: ${symbol}`);
    }
    return pickAndCache(symbol, fallbackFeeds);
  }

  return pickAndCache(symbol, feeds);
}

function pickAndCache(symbol: string, feeds: any[]) {
  // Try to prefer an exact BTC/USD-style match (case-insensitive)
  const preferred = feeds.find((f: any) => {
    const s = (f?.attributes?.symbol || "").toString().toUpperCase();
    return (
      s.includes(`${symbol}/USD`) ||
      s.includes(`${symbol} / USD`) ||
      s.endsWith(`${symbol}/USD`) ||
      s.endsWith(`${symbol} / USD`)
    );
  });

  const picked = preferred || feeds[0];
  const feedId = picked?.id;
  const feedSymbol = picked?.attributes?.symbol || `${symbol}/USD`;

  if (!feedId) throw new Error(`Failed to resolve feed id for ${symbol}`);

  const out = { feedId, feedSymbol };
  FEED_ID_CACHE.set(symbol, out);
  return out;
}

function normalizePythPrice(priceObj: any): { price: number; conf?: number | null; publishTime: number } {
  // Hermes parsed price object typically: { price, conf, expo, publish_time }
  const price = Number(priceObj?.price);
  const conf = priceObj?.conf != null ? Number(priceObj.conf) : null;
  const expo = Number(priceObj?.expo);
  const publishTime = Number(priceObj?.publish_time);

  if (!Number.isFinite(price) || !Number.isFinite(expo) || !Number.isFinite(publishTime)) {
    throw new Error("Invalid Pyth price object");
  }

  // realPrice = price * 10^expo
  const real = price * Math.pow(10, expo);
  const realConf = conf != null ? conf * Math.pow(10, expo) : null;

  if (!Number.isFinite(real)) throw new Error("Invalid normalized Pyth price");

  return { price: real, conf: realConf, publishTime };
}

export async function getPythUsdPrice(symbolRaw: string): Promise<PythPx> {
  const symbol = normalizeSymbol(symbolRaw);
  const { feedId, feedSymbol } = await resolveFeedId(symbol);

  // hermes-client v2: getLatestPriceUpdates([feedId], { parsed: true })
  const latest: any = await client.getLatestPriceUpdates([feedId], { parsed: true });

  // Common shape: { parsed: [ { id, price: {...}, ema_price: {...} } ] }
  const parsed = latest?.parsed?.[0];
  const priceObj = parsed?.price;

  if (!priceObj) {
    throw new Error(`No latest parsed price returned for feed ${feedId} (${feedSymbol})`);
  }

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
