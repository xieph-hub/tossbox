import { NextResponse } from "next/server";
import { getPythUsdPrice } from "@/lib/prices/pythCache";

// TODO: replace with your DB write
async function createRoundSnapshot(symbol: string, snap: any) {
  return { roundId: cryptoRandomId(), symbol, ...snap };
}
function cryptoRandomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const crypto = (body.crypto || "BTC").toUpperCase();

  try {
    const px = await getPythUsdPrice(crypto);

    const round = await createRoundSnapshot(crypto, {
      status: "active",
      start_price: px.price,
      start_conf: px.conf ?? null,
      start_publish_time: px.publishTime,
      start_fetched_at: Date.now(),
      source: "pyth",
    });

    return NextResponse.json({ success: true, round });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to start round" },
      { status: 500 }
    );
  }
}
