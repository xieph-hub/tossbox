import { getPythUsdPrice } from "@/lib/prices/pythCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const crypto = (searchParams.get("crypto") || "BTC").toUpperCase();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (obj: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      // initial
      try {
        const px = await getPythUsdPrice(crypto);
        send({ type: "price", ...px, timestamp: Date.now() });
      } catch (e: any) {
        send({ type: "error", message: e?.message || "price error" });
      }

      const interval = setInterval(async () => {
        if (closed) return;
        try {
          const px = await getPythUsdPrice(crypto);
          send({ type: "price", ...px, timestamp: Date.now() });
        } catch (e: any) {
          send({ type: "error", message: e?.message || "price error" });
        }
      }, 1000);

      // close on disconnect
      // @ts-ignore
      req.signal?.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
