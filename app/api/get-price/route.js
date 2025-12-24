import { NextResponse } from "next/server";
import { getPythUsdPrice } from "@/lib/prices/pythCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const crypto = (searchParams.get("crypto") || "BTC").toUpperCase();

  try {
    const px = await getPythUsdPrice(crypto);

    return NextResponse.json({
      crypto: px.symbol,
      price: px.price,
      conf: px.conf ?? null,
      publishTime: px.publishTime,
      timestamp: Date.now(),
      source: px.source, // "pyth"
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Failed to fetch price",
        crypto,
        message: err?.message || "Unknown error",
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}
