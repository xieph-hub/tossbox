"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, ISeriesApi, Time } from "lightweight-charts";

type Props = {
  crypto: string; // "BTC" | "ETH" | ...
};

export default function LiveChart({ crypto }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  const [ready, setReady] = useState(false);
  const symbol = useMemo(() => (crypto || "BTC").toUpperCase(), [crypto]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#94a3b8" },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: true },
    });

    const series = chart.addLineSeries({ lineWidth: 2 });

    chartRef.current = chart;
    seriesRef.current = series;
    setReady(true);

    const handleResize = () => {
      if (!containerRef.current) return;
      chart.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    let es: EventSource | null = null;

    // Subscribe to realtime SSE
    es = new EventSource(`/api/price-stream?crypto=${encodeURIComponent(symbol)}`);

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const parsed = payload?.parsed?.[0];

        const n = Number(parsed?.price?.price);
        const e = Number(parsed?.price?.expo);
        if (!Number.isFinite(n) || !Number.isFinite(e)) return;

        const price = n * Math.pow(10, e);
        if (!Number.isFinite(price) || price <= 0) return;

        const t = Math.floor(Date.now() / 1000) as Time;
        seriesRef.current?.update({ time: t, value: price });
      } catch {
        // ignore
      }
    };

    return () => {
      try {
        es?.close();
      } catch {}
    };
  }, [ready, symbol]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[280px] rounded-xl border border-slate-800 bg-slate-950/40"
    />
  );
}
