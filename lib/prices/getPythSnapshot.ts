// lib/prices/getPythSnapshot.ts
import "server-only";
import { getPythUsdPrice } from "./pythCache";

export async function getPythSnapshot(symbolRaw: string) {
  const px = await getPythUsdPrice(symbolRaw);

  return {
    crypto: symbolRaw.toUpperCase().trim(),
    pyth_feed_id: px.feedId,
    price: px.price,
    conf: px.conf ?? null,
    publish_time: px.publishTime, // unix seconds
    fetched_at: new Date().toISOString(),
    source: "pyth" as const,
  };
}
