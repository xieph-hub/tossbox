// app/api/get-price/route.ts
import { NextResponse } from "next/server";
import { getPythUsdPrice } from "@/lib/prices/pythCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const crypto = (searchParams.get("crypto") || "BTC").toUpperCase().trim();

    const px = await getPythUsdPrice(crypto);

    const res = NextResponse.json(
      {
        crypto,
        price: px.price,
        conf: px.conf ?? null,
        publishTime: px.publishTime, // unix seconds
        timestamp: Date.now(),       // when your server responded
        source: "pyth",
        feedId: px.feedId,
        feedSymbol: px.symbol,
      },
      { status: 200 }
    );

    // HARD NO-CACHE (browser + CDN + proxies)
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
    res.headers.set("Surrogate-Control", "no-store");

    return res;
  } catch (err: any) {
    console.error("get-price error:", err?.message || err);

    const res = NextResponse.json(
      { error: "Failed to fetch price", message: err?.message || "Unknown error" },
      { status: 500 }
    );

    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
    res.headers.set("Surrogate-Control", "no-store");

    return res;
  }
}
