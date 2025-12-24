import { HermesClient } from "@pythnetwork/hermes-client";
import { PYTH_FEED_IDS, assertSupportedSymbol } from "./pythFeedIds";

type CachedPrice = {
  symbol: string;
  price: number;       // USD
  conf?: number;       // confidence interval (optional but good for disputes)
  publishTime: number; // unix seconds
  fetchedAt: number;   // ms
  source: "pyth";
};

const HERMES_URL = process.env.PYTH_HERMES_URL || "https://hermes.pyth.network";
const client = new HermesClient(HERMES_URL);

const CACHE = new Map<string, CachedPrice>();
const IN_FLIGHT = new Map<string, Promise<CachedPrice>>();

// tweak: settlement wants reliability more than micro-latency
const TTL_MS = 1500;

function toNumber(v: unknown) {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : NaN;
}

// Hermes price format includes price + exponent (often negative)
// The SDK returns a structure where price is commonly a string/number and expo is exponent.
function normalizePythPrice(priceObj: any) {
  const price = toNumber(priceObj?.price);
  const expo = toNumber(priceObj?.expo);
  const conf = toNumber(priceObj?.conf);

  if (!Number.isFinite(price) || !Number.isFinite(expo)) return null;

  // value = price * 10^expo
  const value = price * Math.pow(10, expo);
  const confValue = Number.isFinite(conf) ? conf * Math.pow(10, expo) : undefined;

  return { value, confValue };
}

export async function getPythUsdPrice(symbolRaw: string): Promise<CachedPrice> {
  const symbol = assertSupportedSymbol(symbolRaw);
  const now = Date.now();

  const cached = CACHE.get(symbol);
  if (cached && now - cached.fetchedAt < TTL_MS) return cached;

  const existing = IN_FLIGHT.get(symbol);
  if (existing) return existing;

  const p = (async () => {
    const feedId = PYTH_FEED_IDS[symbol];

    // Hermes endpoint: getLatestPriceFeeds([feedId])
    const feeds = await client.getLatestPriceFeeds([feedId]);
    const feed = feeds?.[0];
    const priceObj = feed?.price;
    const norm = normalizePythPrice(priceObj);

    if (!norm || !Number.isFinite(norm.value)) {
      throw new Error(`Invalid Hermes price for ${symbol}`);
    }

    const publishTime = toNumber(priceObj?.publish_time);
    const result: CachedPrice = {
      symbol,
      price: norm.value,
      conf: norm.confValue,
      publishTime: Number.isFinite(publishTime) ? publishTime : Math.floor(now / 1000),
      fetchedAt: now,
      source: "pyth",
    };

    CACHE.set(symbol, result);
    return result;
  })();

  IN_FLIGHT.set(symbol, p);

  try {
    return await p;
  } finally {
    IN_FLIGHT.delete(symbol);
  }
}
