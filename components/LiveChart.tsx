"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, ISeriesApi, Time } from "lightweight-charts";

type Props = {
  crypto: string; // "BTC" | "ETH" | ...
};

type PriceResp = {
  crypto: string;
  price: number;
  publishTime?: number;
  timestamp?: number;
  source?: string;
};

export default function LiveChart({ crypto }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  const [ready, setReady] = useState(false);

  const symbol = useMemo(() => (crypto || "BTC").toUpperCase(), [crypto]);

  useEffect(() => {
    if (!containerRef.current) return;

    // IMPORTANT: container must have non-zero height
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#94a3b8" },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: true },
    });

    const series = chart.addLineSeries({
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    setReady(true);

    const handleResize = () => {
      // autoSize handles it but some layouts benefit from forcing a resize
      chart.resize(containerRef.current!.clientWidth, containerRef.current!.clientHeight);
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
    let stop = false;

    async function tick() {
      try {
        const res = await fetch(`/api/get-price?crypto=${encodeURIComponent(symbol)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`get-price ${res.status}`);
        const data = (await res.json()) as PriceResp;

        const price = Number(data.price);
        if (!Number.isFinite(price)) return;

        // Use publishTime if you have it; else use now
        const t = data.publishTime
          ? (data.publishTime as Time)
          : (Math.floor(Date.now() / 1000) as Time);

        seriesRef.current?.update({ time: t, value: price });
      } catch (e) {
        // Keep running even if a tick fails
        // console.error(e);
      }
    }

    // initial + interval
    tick();
    const id = setInterval(() => {
      if (!stop) tick();
    }, 1000);

    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [ready, symbol]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[280px] rounded-xl border border-slate-800 bg-slate-950/40"
    />
  );
}
