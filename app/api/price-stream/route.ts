// app/api/price-stream/route.ts
import "server-only";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HERMES_BASE = "https://hermes.pyth.network";

// In-memory cache (good enough for Vercel instance lifetime)
const idCache = new Map<string, { id: string; ts: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Resolve a Pyth "price feed id" from a simple symbol like "BTC".
 * We use Hermes metadata endpoint /v2/price_feeds with query + asset_type=crypto.
 * (Hermes exposes /v2/price_feeds and streaming endpoints.) :contentReference[oaicite:2]{index=2}
 */
async function resolvePythId(symbol: string): Promise<string> {
  const s = symbol.trim().toUpperCase();
  if (!s) throw new Error("Missing crypto symbol");

  const cached = idCache.get(s);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.id;

  // Query metadata
  const url = new URL(`${HERMES_BASE}/v2/price_feeds`);
  url.searchParams.set("query", s);
  url.searchParams.set("asset_type", "crypto");

  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Hermes metadata HTTP ${res.status}`);

  const feeds: Array<{ id: string; attributes?: { symbol?: string } }> = await res.json();

  // Pyth symbols are typically like: "Crypto.BTC/USD"
  const targetSymbol = `Crypto.${s}/USD`;

  const exact = feeds.find((f) => f?.attributes?.symbol === targetSymbol);
  const picked = exact || feeds.find((f) => (f?.attributes?.symbol || "").includes(`.${s}/USD`));

  if (!picked?.id) {
    throw new Error(`Could not resolve Pyth feed id for ${s} (wanted ${targetSymbol})`);
  }

  idCache.set(s, { id: picked.id, ts: Date.now() });
  return picked.id;
}

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("crypto") || "").trim().toUpperCase();
  if (!symbol) return new Response("Missing ?crypto=SYMBOL", { status: 400 });

  let id: string;
  try {
    id = await resolvePythId(symbol);
  } catch (e: any) {
    return new Response(e?.message || "Failed to resolve price feed id", { status: 500 });
  }

  // Hermes realtime streaming SSE endpoint :contentReference[oaicite:3]{index=3}
  const streamUrl = new URL(`${HERMES_BASE}/v2/updates/price/stream`);
  streamUrl.searchParams.append("ids[]", id);

  const upstream = await fetch(streamUrl.toString(), {
    headers: {
      "Accept": "text/event-stream",
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(`Upstream stream failed HTTP ${upstream.status}`, { status: 502 });
  }

  // Proxy the SSE stream as-is (same-origin for your browser)
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Connection": "keep-alive",
      // Optional hardening:
      "X-Accel-Buffering": "no",
    },
  });
}
