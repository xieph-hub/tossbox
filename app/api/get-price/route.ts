// app/api/get-price/route.ts
import { NextResponse } from "next/server";
import { getPythUsdPrice } from "@/lib/prices/pythCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const crypto = (searchParams.get("crypto") || "BTC").toUpperCase().trim();

    const px = await getPythUsdPrice(crypto);

    return NextResponse.json({
      crypto,
      price: px.price,
      conf: px.conf ?? null,
      publishTime: px.publishTime,
      timestamp: Date.now(),
      source: "pyth", // <- settlement/oracle source
      feedId: px.feedId,
      feedSymbol: px.symbol,
    });
  } catch (err: any) {
    console.error("get-price error:", err?.message || err);
    return NextResponse.json(
      { error: "Failed to fetch price", message: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
