// lib/prices/getPythSnapshot.ts
import "server-only";
import { getPythUsdPrice } from "./pythCache";
import { assertSupportedSymbol } from "./pythFeedIds";

export async function getPythSnapshot(symbolRaw: string) {
  const symbol = assertSupportedSymbol(symbolRaw);
  const px = await getPythUsdPrice(symbol);

  return {
    crypto: symbol,
    pyth_feed_id: px.feedId,          // <-- from Hermes resolution (canonical)
    price: px.price,
    conf: px.conf ?? null,
    publish_time: px.publishTime,     // unix seconds
    fetched_at: new Date().toISOString(),
    source: "pyth" as const,
    feedSymbol: px.symbol,            // useful for debugging (e.g. "Crypto.BTC/USD")
  };
}
