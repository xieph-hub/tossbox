// app/api/price-stream/route.ts
import "server-only";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HERMES_BASE = "https://hermes.pyth.network";

// Simple in-memory cache for feed IDs (per server instance)
const idCache = new Map<string, { id: string; ts: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

type HermesFeed = {
  id: string;
  attributes?: {
    symbol?: string;
    asset_type?: string;
  };
};

function cleanSymbol(v: string) {
  return (v || "").trim().toUpperCase();
}

async function resolvePythFeedId(symbol: string): Promise<string> {
  const s = cleanSymbol(symbol);
  if (!s) throw new Error("Missing crypto symbol");

  const cached = idCache.get(s);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.id;

  const url = new URL(`${HERMES_BASE}/v2/price_feeds`);
  url.searchParams.set("query", s);
  url.searchParams.set("asset_type", "crypto");

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`Hermes metadata HTTP ${res.status}`);

  const feeds = (await res.json()) as HermesFeed[];

  // Prefer exact match like "Crypto.BTC/USD"
  const target = `Crypto.${s}/USD`;
  const exact = feeds.find((f) => f?.attributes?.symbol === target);
  const loose = feeds.find((f) => (f?.attributes?.symbol || "").includes(`.${s}/USD`));

  const picked = exact || loose;
  if (!picked?.id) throw new Error(`No Pyth feed id found for ${s} (wanted ${target})`);

  idCache.set(s, { id: picked.id, ts: Date.now() });
  return picked.id;
}

export async function GET(req: NextRequest) {
  const symbol = cleanSymbol(req.nextUrl.searchParams.get("crypto") || "BTC");

  let feedId: string;
  try {
    feedId = await resolvePythFeedId(symbol);
  } catch (e: any) {
    return new Response(e?.message || "Failed to resolve feed id", { status: 500 });
  }

  // Hermes SSE stream endpoint
  const streamUrl = new URL(`${HERMES_BASE}/v2/updates/price/stream`);
  streamUrl.searchParams.append("ids[]", feedId);

  const upstream = await fetch(streamUrl.toString(), {
    cache: "no-store",
    headers: {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(`Upstream stream failed HTTP ${upstream.status}`, { status: 502 });
  }

  // Proxy the SSE stream as-is
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
