// lib/prices/pythCache.ts
import "server-only";

import { HermesClient } from "@pythnetwork/hermes-client";

// -----------------------------
// Config
// -----------------------------
const HERMES_URL =
  process.env.PYTH_HERMES_URL || "https://hermes.pyth.network";

const DEFAULT_STALE_MS = 2_000; // 2s cache for UI + round creation safety

// Your crypto -> Pyth Price Feed IDs
// NOTE: These MUST be the Pyth feed IDs for the USD pair you want.
export const PYTH_FEED_IDS: Record<string, string> = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b6a9b4b2d9ff1b2f1a0b2a4", // example placeholder
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // example placeholder
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"  // example placeholder
  // Add the rest (BNB, XRP, ADA, etc.)
};

// -----------------------------
// Types
// -----------------------------
type CacheEntry = {
  fetchedAt: number;
  value: PythSnapshot;
};

export type PythSnapshot = {
  crypto: string;
  pyth_feed_id: string;

  // normalized float price in USD (for game logic)
  price: number;

  // normalized confidence interval
  conf: number;

  // publish time (seconds since epoch, as returned by Pyth)
  publish_time: number;

  // ISO timestamp when we fetched it (server time)
  fetched_at: string;

  source: "pyth-hermes";
};

// -----------------------------
// Cache (in-memory)
// NOTE: Serverless functions may not retain cache between invocations,
// but this still helps within the same warm lambda.
// -----------------------------
const cache = new Map<string, CacheEntry>();

// -----------------------------
// Helpers
// -----------------------------
function normalizePythPrice(priceObj: any) {
  // Hermes returns a price object with (price, conf, expo, publish_time) commonly.
  // price/conf are integers; expo is exponent (often negative).
  if (!priceObj) return null;

  const priceInt = Number(priceObj.price);
  const confInt = Number(priceObj.conf ?? 0);
  const expo = Number(priceObj.expo);
  const publishTime = Number(priceObj.publish_time);

  if (!Number.isFinite(priceInt) || !Number.isFinite(expo) || !Number.isFinite(publishTime)) {
    return null;
  }

  const scale = Math.pow(10, expo); // expo is usually negative (e.g. -8)
  const price = priceInt * scale;
  const conf = Number.isFinite(confInt) ? confInt * scale : 0;

  return { price, conf, publish_time: publishTime };
}

function nowIso() {
  return new Date().toISOString();
}

function getFeedIdFor(crypto: string) {
  const key = crypto.toUpperCase().trim();
  const feedId = PYTH_FEED_IDS[key];
  if (!feedId) {
    throw new Error(`Missing PYTH_FEED_IDS mapping for crypto: ${key}`);
  }
  return { key, feedId };
}

// -----------------------------
// Public API
// -----------------------------
export async function getPythSnapshotCached(
  crypto: string,
  opts?: { staleMs?: number }
): Promise<PythSnapshot> {
  const staleMs = opts?.staleMs ?? DEFAULT_STALE_MS;

  const { key, feedId } = getFeedIdFor(crypto);

  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < staleMs) {
    return cached.value;
  }

  const client = new HermesClient(HERMES_URL);

  // ✅ Supported by your version: getPriceFeeds([feedId])
  // returns an array of feeds; each feed typically has .id and .price
  const feeds: any[] = await client.getPriceFeeds([feedId]);

  const feed = feeds?.[0];
  const priceObj = feed?.price;
  const norm = normalizePythPrice(priceObj);

  if (!norm || !Number.isFinite(norm.price) || norm.price <= 0) {
    throw new Error(`Invalid Pyth price for ${key} (feedId=${feedId})`);
  }

  const snap: PythSnapshot = {
    crypto: key,
    pyth_feed_id: feedId,
    price: norm.price,
    conf: norm.conf,
    publish_time: norm.publish_time,
    fetched_at: nowIso(),
    source: "pyth-hermes",
  };

  cache.set(key, { fetchedAt: Date.now(), value: snap });
  return snap;
}
