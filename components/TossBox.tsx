"use client";

import React, { useEffect, useRef, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TrendingUp, TrendingDown, Trophy, Users, DollarSign, Flame } from "lucide-react";
import Link from "next/link";

// 32 CRYPTO ASSETS
const CRYPTOS = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "BNB", name: "BNB" },
  { symbol: "XRP", name: "Ripple" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "MATIC", name: "Polygon" },
  { symbol: "DOT", name: "Polkadot" },
  { symbol: "AVAX", name: "Avalanche" },
  { symbol: "SHIB", name: "Shiba Inu" },
  { symbol: "LINK", name: "Chainlink" },
  { symbol: "UNI", name: "Uniswap" },
  { symbol: "LTC", name: "Litecoin" },
  { symbol: "TRX", name: "Tron" },
  { symbol: "ATOM", name: "Cosmos" },
  { symbol: "XLM", name: "Stellar" },
  { symbol: "ETC", name: "Ethereum Classic" },
  { symbol: "FIL", name: "Filecoin" },
  { symbol: "HBAR", name: "Hedera" },
  { symbol: "APT", name: "Aptos" },
  { symbol: "ARB", name: "Arbitrum" },
  { symbol: "OP", name: "Optimism" },
  { symbol: "NEAR", name: "Near" },
  { symbol: "AAVE", name: "Aave" },
  { symbol: "STX", name: "Stacks" },
  { symbol: "INJ", name: "Injective" },
  { symbol: "SUI", name: "Sui" },
  { symbol: "IMX", name: "Immutable X" },
  { symbol: "RENDER", name: "Render" },
  { symbol: "FET", name: "Fetch.ai" },
  { symbol: "PEPE", name: "Pepe" },
];

type Candle = {
  time: number; // unix seconds aligned to minute
  open: number;
  high: number;
  low: number;
  close: number;
};

export default function TossBox() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [selectedCrypto, setSelectedCrypto] = useState("BTC");
  const [prediction, setPrediction] = useState<"up" | "down" | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [stake, setStake] = useState(0.1);

  const [gameState, setGameState] = useState<"waiting" | "active" | "ended">("waiting");
  const [countdown, setCountdown] = useState(60);
  const [startPrice, setStartPrice] = useState<number | null>(null);

  const [currentPrice, setCurrentPrice] = useState(0);
  const [totalPot, setTotalPot] = useState(0);
  const [playerCount, setPlayerCount] = useState(0);
  const [balance, setBalance] = useState(0);
  const [userStreak, setUserStreak] = useState(0);
  const [recentWinners, setRecentWinners] = useState<any[]>([]);
  const [placingBet, setPlacingBet] = useState(false);

  // Candles
  const [candleData, setCandleData] = useState<Candle[]>([]);
  const [currentCandle, setCurrentCandle] = useState<Candle | null>(null);

  // Chart refs
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const didFitOnceRef = useRef(false);

  // -----------------------------
  // PRICE FEED
  // -----------------------------
  useEffect(() => {
    let active = true;

    async function fetchPrice() {
      if (!active) return;
      try {
        const url = `/api/get-price?crypto=${encodeURIComponent(selectedCrypto)}&t=${Date.now()}`;
        const res = await fetch(url, {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const price = Number(data?.price);

        if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid price");
        if (!active) return;

        setCurrentPrice(price);

        const nowSec = Math.floor(Date.now() / 1000);
        const candleTime = Math.floor(nowSec / 60) * 60;

        setCurrentCandle((prev) => {
          if (!prev || prev.time !== candleTime) {
            if (prev) setCandleData((prevData) => [...prevData, prev].slice(-200));
            return { time: candleTime, open: price, high: price, low: price, close: price };
          }

          return {
            ...prev,
            close: price,
            high: Math.max(prev.high, price),
            low: Math.min(prev.low, price),
          };
        });
      } catch (err: any) {
        console.error("❌ Price error:", err?.message || err);
      }
    }

    setCandleData([]);
    setCurrentCandle(null);
    setCurrentPrice(0);
    didFitOnceRef.current = false;

    fetchPrice();
    const interval = setInterval(fetchPrice, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedCrypto]);

  // -----------------------------
  // INIT CHART
  // -----------------------------
  useEffect(() => {
    let mounted = true;

    async function initChart() {
      if (!chartContainerRef.current) return;

      const { createChart } = await import("lightweight-charts");
      if (!mounted || !chartContainerRef.current) return;

      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch {}
        chartRef.current = null;
        candlestickSeriesRef.current = null;
      }

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth || 600,
        height: 400,
        layout: { background: { color: "transparent" }, textColor: "#9CA3AF" },
        grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#374151" },
        rightPriceScale: { borderColor: "#374151", scaleMargins: { top: 0.1, bottom: 0.1 } },
      });

      const series = chart.addCandlestickSeries({
        upColor: "#10b981",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#10b981",
        wickDownColor: "#ef4444",
      });

      chartRef.current = chart;
      candlestickSeriesRef.current = series;

      const handleResize = () => {
        if (!chartContainerRef.current || !chartRef.current) return;
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      };

      window.addEventListener("resize", handleResize);

      chartRef.current.__cleanup = () => {
        window.removeEventListener("resize", handleResize);
        try {
          chart.remove();
        } catch {}
      };
    }

    initChart();

    return () => {
      mounted = false;
      const cleanup = chartRef.current?.__cleanup;
      if (cleanup) cleanup();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
    };
  }, []);

  // -----------------------------
  // UPDATE CHART
  // -----------------------------
  useEffect(() => {
    if (!candlestickSeriesRef.current) return;

    const allCandles = [...candleData];
    if (currentCandle) allCandles.push(currentCandle);

    if (allCandles.length > 0) {
      candlestickSeriesRef.current.setData(allCandles);

      if (!didFitOnceRef.current && chartRef.current && allCandles.length >= 2) {
        didFitOnceRef.current = true;
        try {
          chartRef.current.timeScale().fitContent();
        } catch {}
      }
    }
  }, [candleData, currentCandle]);

  // -----------------------------
  // GAME STATE POLL
  // -----------------------------
  useEffect(() => {
    fetchGameState();
    const interval = setInterval(fetchGameState, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (publicKey) fetchUserBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  useEffect(() => {
    if (gameState === "active" && countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && gameState === "active") {
      endRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, countdown]);

  async function fetchGameState() {
    try {
      const res = await fetch("/api/get-game-state", { cache: "no-store" });
      const data = await res.json();

      setTotalPot(data.totalPot || 0);
      setPlayerCount(data.playerCount || 0);
      setRecentWinners(data.recentWinners || []);

      if (data.activeRound?.status === "active") {
        const startTime = new Date(data.activeRound.start_time).getTime();
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, 60 - elapsed);

        if (remaining > 0) {
          setCountdown(remaining);
          setGameState("active");
          setStartPrice(Number(data.activeRound.start_price));
        }
      }
    } catch (err) {
      console.error("Game state error:", err);
    }
  }

  async function fetchUserBalance() {
    try {
      if (!publicKey) return;
      const bal = await connection.getBalance(publicKey);
      setBalance(bal / LAMPORTS_PER_SOL);

      const res = await fetch(`/api/profile?wallet=${publicKey.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setUserStreak(data.profile?.win_streak || 0);
    } catch (err) {
      console.error("Balance error:", err);
    }
  }

  // -----------------------------
  // HARDENED CONFIRM (signature polling)
  // -----------------------------
  async function waitForSignature(sig: string, timeoutMs = 120_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const st = await connection.getSignatureStatuses([sig], { searchTransactionHistory: true });
      const s0 = st?.value?.[0];

      if (s0?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(s0.err)}`);
      }

      if (s0?.confirmationStatus === "confirmed" || s0?.confirmationStatus === "finalized") {
        return;
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    throw new Error(`Transaction not confirmed within ${Math.floor(timeoutMs / 1000)}s. Signature: ${sig}`);
  }

  // -----------------------------
  // BET
  // -----------------------------
  async function placeBet() {
    if (!prediction || !publicKey || placingBet || currentPrice === 0) return;

    setPlacingBet(true);

    try {
      const treasuryStr = process.env.NEXT_PUBLIC_TREASURY_WALLET;
      if (!treasuryStr) throw new Error("Missing NEXT_PUBLIC_TREASURY_WALLET");

      const treasury = new PublicKey(treasuryStr);

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasury,
          lamports: Math.floor(stake * LAMPORTS_PER_SOL),
        })
      );

      // Let wallet/rpc handle blockhash; still helps to set a fresh one
      const bh = await connection.getLatestBlockhash("processed");
      tx.feePayer = publicKey;
      tx.recentBlockhash = bh.blockhash;

      const sig = await sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: "processed",
        maxRetries: 5,
      });

      // ✅ Confirm by polling signature status (works even if wallet used a different blockhash)
      await waitForSignature(sig, 120_000);

      // Record bet only after confirmed
      const res = await fetch("/api/place-bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          prediction,
          multiplier,
          stakeAmount: stake,
          txSignature: sig,
          crypto: selectedCrypto,
        }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Backend rejected bet");

      setGameState("active");
      setStartPrice(currentPrice);
      setCountdown(60);
      setBalance((prev) => prev - stake);
      await fetchGameState();

      alert("✅ Bet placed successfully!");
    } catch (err: any) {
      console.error("Bet error:", err);
      alert(`❌ ${err?.message || "Unknown error"}`);
    } finally {
      setPlacingBet(false);
    }
  }

  function endRound() {
    setGameState("ended");
    setTimeout(() => {
      setGameState("waiting");
      setPrediction(null);
      setStartPrice(null);
      setCountdown(60);
      fetchGameState();
      if (publicKey) fetchUserBalance();
    }, 3000);
  }

  const MultiplierButton = ({ value }: { value: number }) => (
    <button
      onClick={() => setMultiplier(value)}
      disabled={gameState === "active"}
      className={`px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50 ${
        multiplier === value ? "bg-purple-600 text-white scale-105" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
      }`}
    >
      {value}x
    </button>
  );

  function formatPrice(p: number) {
    if (!p || p === 0) return "0.00";
    if (p < 0.00001) return p.toFixed(8);
    if (p < 0.001) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              TossBox
            </h1>
            <p className="text-gray-400 text-sm">Predict. Win. Repeat.</p>
          </div>

          <div className="flex items-center gap-4">
            {publicKey && (
              <div className="flex gap-2">
                <Link href="/profile" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg font-bold">
                  Profile
                </Link>
                <Link href="/leaderboard" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg font-bold">
                  Leaderboard
                </Link>
              </div>
            )}

            {!publicKey ? (
              <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !px-6 !py-3 !rounded-lg !font-bold" />
            ) : (
              <div className="text-right">
                <div className="text-sm text-gray-400">Balance</div>
                <div className="text-2xl font-bold">{balance.toFixed(3)} SOL</div>
                <div className="text-xs text-gray-500">
                  {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* (rest of your UI unchanged) */}
      {/* Keep the rest of your JSX exactly as you already have it */}
      {/* I’m not repeating the entire JSX again to avoid duplicating your paste */}
      <div className="max-w-6xl mx-auto">
        {/* Your existing JSX continues here */}
      </div>
    </div>
  );
}
