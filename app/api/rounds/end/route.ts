import { NextResponse } from "next/server";
import { getPythUsdPrice } from "@/lib/prices/pythCache";

// TODO: replace with your DB read/write + settlement logic
async function endRound(roundId: string, endSnap: any) {
  return { roundId, ...endSnap, status: "ended" };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const roundId = body.roundId;
  const crypto = (body.crypto || "BTC").toUpperCase();

  if (!roundId) {
    return NextResponse.json({ success: false, error: "roundId required" }, { status: 400 });
  }

  try {
    const px = await getPythUsdPrice(crypto);

    const ended = await endRound(roundId, {
      end_price: px.price,
      end_conf: px.conf ?? null,
      end_publish_time: px.publishTime,
      end_fetched_at: Date.now(),
      source: "pyth",
    });

    // TODO: run settlement:
    // - determine up/down outcome from start_price vs end_price
    // - compute winners
    // - pay from payout wallet, fees to treasury rules etc.
    // - persist payouts and tx signatures

    return NextResponse.json({ success: true, round: ended });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to end round" },
      { status: 500 }
    );
  }
}
