"use client";

import React, { useEffect, useRef, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TrendingUp, TrendingDown, Trophy, Users, DollarSign, Flame, MessageCircle } from "lucide-react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

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

type ChatMsg = {
  id: string;
  room: string;
  wallet?: string;
  text: string;
  ts: number;
};

type Candle = {
  time: number; // unix seconds, aligned to minute
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

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const didFitOnceRef = useRef(false);

  // Chat
  const [chatInput, setChatInput] = useState("");
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const chatRoom = `tossbox:${selectedCrypto}`;

  // -----------------------------
  // REALTIME PRICES (SSE)
  // -----------------------------
  useEffect(() => {
    let active = true;
    let es: EventSource | null = null;

    // reset when switching asset
    setCandleData([]);
    setCurrentCandle(null);
    setCurrentPrice(0);
    didFitOnceRef.current = false;

    const pushTick = (price: number) => {
      if (!active) return;

      setCurrentPrice(price);

      const nowSec = Math.floor(Date.now() / 1000);
      const candleTime = Math.floor(nowSec / 60) * 60;

      setCurrentCandle((prev) => {
        if (!prev || prev.time !== candleTime) {
          if (prev) {
            setCandleData((prevData) => [...prevData, prev].slice(-200));
          }
          return { time: candleTime, open: price, high: price, low: price, close: price };
        }

        return {
          ...prev,
          close: price,
          high: Math.max(prev.high, price),
          low: Math.min(prev.low, price),
        };
      });
    };

    es = new EventSource(`/api/price-stream?crypto=${encodeURIComponent(selectedCrypto)}`);

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const parsed = payload?.parsed?.[0];

        const n = Number(parsed?.price?.price);
        const e = Number(parsed?.price?.expo);
        if (!Number.isFinite(n) || !Number.isFinite(e)) return;

        const price = n * Math.pow(10, e);
        if (!Number.isFinite(price) || price <= 0) return;

        pushTick(price);
      } catch {
        // ignore
      }
    };

    return () => {
      active = false;
      try {
        es?.close();
      } catch {}
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
        layout: {
          background: { color: "transparent" },
          textColor: "#9CA3AF",
        },
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: "#374151",
        },
        rightPriceScale: {
          borderColor: "#374151",
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
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
  // UPDATE CHART DATA
  // -----------------------------
  useEffect(() => {
    if (!candlestickSeriesRef.current) return;

    const all = [...candleData];
    if (currentCandle) all.push(currentCandle);

    if (all.length > 0) {
      candlestickSeriesRef.current.setData(all);

      if (!didFitOnceRef.current && chartRef.current && all.length >= 2) {
        didFitOnceRef.current = true;
        try {
          chartRef.current.timeScale().fitContent();
        } catch {}
      }
    }
  }, [candleData, currentCandle]);

  // -----------------------------
  // GAME STATE POLL (unchanged)
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
  // CHAT (Supabase realtime)
  // -----------------------------
  useEffect(() => {
    setChatMsgs([]);

    const channel = supabaseBrowser.channel(chatRoom);

    channel
      .on("broadcast", { event: "message" }, (payload) => {
        const msg = payload?.payload as ChatMsg | undefined;
        if (!msg?.id) return;
        setChatMsgs((prev) => [...prev, msg].slice(-120));
      })
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [chatRoom]);

  async function sendChat() {
    const text = chatInput.trim();
    if (!text) return;

    const msg: ChatMsg = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room: chatRoom,
      wallet: publicKey?.toString(),
      text,
      ts: Date.now(),
    };

    setChatInput("");

    // Important: send via the SAME channel name; easiest is create channel and send
    const channel = supabaseBrowser.channel(chatRoom);
    await channel.send({ type: "broadcast", event: "message", payload: msg });
    supabaseBrowser.removeChannel(channel);
  }

  // -----------------------------
  // BET
  // -----------------------------
  async function placeBet() {
    if (!prediction || !publicKey || placingBet || currentPrice === 0) return;

    setPlacingBet(true);

    try {
      const treasury = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET!);

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasury,
          lamports: Math.floor(stake * LAMPORTS_PER_SOL),
        })
      );

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

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

      if (result.success) {
        setGameState("active");
        setStartPrice(currentPrice);
        setCountdown(60);
        setBalance((prev) => prev - stake);
        await fetchGameState();
        alert("✅ Bet placed successfully!");
      } else {
        alert("❌ Failed: " + (result.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error("Bet error:", err);
      alert("❌ Error: " + (err?.message || "Unknown error"));
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

      <div className="max-w-6xl mx-auto grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <DollarSign size={16} />
            <span className="text-sm">Total Pot</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{Number(totalPot).toFixed(2)} SOL</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Users size={16} />
            <span className="text-sm">Active Players</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{playerCount}</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Trophy size={16} />
            <span className="text-sm">Your Streak</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400 flex items-center gap-1">
            {userStreak}
            {userStreak > 0 && <Flame size={20} className="text-orange-400" />}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <h3 className="text-sm font-bold text-gray-400 mb-3">Select Asset ({CRYPTOS.length} Available)</h3>
            <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-2">
              {CRYPTOS.map((c) => (
                <button
                  key={c.symbol}
                  onClick={() => setSelectedCrypto(c.symbol)}
                  disabled={gameState === "active"}
                  className={`py-2 px-1 rounded-lg font-bold text-xs transition-all disabled:opacity-50 ${
                    selectedCrypto === c.symbol
                      ? "bg-purple-600 text-white ring-2 ring-purple-400"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                  title={c.name}
                >
                  {c.symbol}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <div>
                <div className="text-4xl font-bold">${formatPrice(currentPrice)}</div>
                <div className="text-sm text-gray-400 mt-1">{selectedCrypto}/USD</div>
              </div>

              {gameState === "active" && (
                <div className="text-center bg-purple-900/30 px-6 py-3 rounded-lg border border-purple-700">
                  <div className="text-3xl font-bold text-purple-400">{countdown}</div>
                  <div className="text-xs text-gray-400">SECONDS LEFT</div>
                </div>
              )}

              {startPrice && currentPrice > 0 && gameState === "active" && (
                <div className={`text-right ${currentPrice >= startPrice ? "text-green-400" : "text-red-400"}`}>
                  <div className="text-3xl font-bold">
                    {currentPrice >= startPrice ? "+" : ""}
                    {(((currentPrice - startPrice) / startPrice) * 100).toFixed(2)}%
                  </div>
                  <div className="text-sm text-gray-400">Your P&amp;L</div>
                </div>
              )}
            </div>

            <div className="p-4">
              <div className="relative w-full" style={{ height: "400px" }}>
                <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />

                {currentPrice <= 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/40">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-3"></div>
                      <div className="text-gray-200">Loading {selectedCrypto} price stream...</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {currentCandle && (
              <div className="px-4 pb-4">
                <div className="bg-gray-900/50 rounded-lg p-3 grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs mb-1">OPEN</div>
                    <div className="font-bold">${formatPrice(currentCandle.open)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">HIGH</div>
                    <div className="font-bold text-green-400">${formatPrice(currentCandle.high)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">LOW</div>
                    <div className="font-bold text-red-400">${formatPrice(currentCandle.low)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">CLOSE</div>
                    <div className={`font-bold ${currentCandle.close >= currentCandle.open ? "text-green-400" : "text-red-400"}`}>
                      ${formatPrice(currentCandle.close)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Place Your Bet</h3>

            {!publicKey ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">Connect your Solana wallet to start</p>
                <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !px-6 !py-3 !rounded-lg !font-bold" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button
                    onClick={() => setPrediction("up")}
                    disabled={gameState === "active"}
                    className={`py-6 rounded-lg font-bold text-xl transition-all ${
                      prediction === "up" ? "bg-green-600 text-white scale-105" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    } disabled:opacity-50`}
                  >
                    <TrendingUp className="mx-auto mb-2" size={32} />
                    UP
                  </button>

                  <button
                    onClick={() => setPrediction("down")}
                    disabled={gameState === "active"}
                    className={`py-6 rounded-lg font-bold text-xl transition-all ${
                      prediction === "down" ? "bg-red-600 text-white scale-105" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    } disabled:opacity-50`}
                  >
                    <TrendingDown className="mx-auto mb-2" size={32} />
                    DOWN
                  </button>
                </div>

                <div className="mb-6">
                  <label className="block text-sm text-gray-400 mb-2">Confidence Multiplier</label>
                  <div className="flex gap-2">
                    <MultiplierButton value={1} />
                    <MultiplierButton value={2} />
                    <MultiplierButton value={5} />
                    <MultiplierButton value={10} />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm text-gray-400 mb-2">Stake Amount (SOL)</label>
                  <input
                    type="number"
                    value={stake}
                    onChange={(e) => setStake(parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="0.1"
                    max={balance}
                    disabled={gameState === "active"}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white font-bold text-xl disabled:opacity-50"
                  />
                  <div className="text-sm text-gray-400 mt-2">
                    Potential Win: <span className="text-green-400 font-bold">{(stake * multiplier * 0.95).toFixed(2)} SOL</span>
                  </div>
                </div>

                <button
                  onClick={placeBet}
                  disabled={!prediction || gameState === "active" || placingBet || stake > balance || currentPrice === 0}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-4 rounded-lg font-bold text-xl transition-all disabled:opacity-50"
                >
                  {placingBet ? "Placing Bet..." : gameState === "active" ? "Round In Progress" : currentPrice === 0 ? "Loading Price..." : "Place Bet"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* CHAT */}
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <MessageCircle size={18} className="text-purple-300" />
              Live Chat ({selectedCrypto})
            </h3>

            <div className="h-64 overflow-y-auto rounded-lg bg-gray-900/40 border border-gray-700 p-3 space-y-3">
              {chatMsgs.length === 0 ? (
                <div className="text-gray-500 text-sm">Be the first to chat in this room…</div>
              ) : (
                chatMsgs.map((m) => (
                  <div key={m.id} className="text-sm">
                    <div className="text-gray-500 text-xs mb-1">
                      {m.wallet ? `${m.wallet.slice(0, 4)}...${m.wallet.slice(-4)}` : "anon"} •{" "}
                      {new Date(m.ts).toLocaleTimeString()}
                    </div>
                    <div className="text-gray-200 break-words">{m.text}</div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendChat();
                }}
                placeholder={publicKey ? "Type a message…" : "Connect wallet to chat…"}
                disabled={!publicKey}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm disabled:opacity-50"
              />
              <button
                onClick={sendChat}
                disabled={!publicKey || !chatInput.trim()}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>

          {/* WINNERS */}
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Trophy size={20} className="text-yellow-400" />
              Recent Winners
            </h3>
            <div className="space-y-3">
              {recentWinners.slice(0, 10).map((w, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-400 font-mono">
                    {w.wallet_address?.slice(0, 4)}...{w.wallet_address?.slice(-4)}
                  </span>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">+{Number(w.actual_win || 0).toFixed(2)} SOL</div>
                    <div className="text-xs text-gray-500">{w.multiplier}x</div>
                  </div>
                </div>
              ))}
              {recentWinners.length === 0 && <div className="text-gray-500 text-center py-4 text-sm">No winners yet!</div>}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4">📊 Live Candlesticks</h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="text-gray-400">• Each candle = 1 minute</li>
              <li className="text-gray-400">• Updates live (streamed)</li>
              <li className="text-gray-400">• {CRYPTOS.length} assets</li>
            </ul>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4">How It Works</h3>
            <ol className="space-y-2 text-sm text-gray-300">
              <li>1. Connect Solana wallet</li>
              <li>2. Pick an asset</li>
              <li>3. Predict UP or DOWN</li>
              <li>4. Choose multiplier (1x-10x)</li>
              <li>5. Set stake</li>
              <li>6. Wait 60 seconds</li>
              <li>7. Winners split the pot</li>
            </ol>
            <div className="mt-4 p-3 bg-purple-900/30 rounded border border-purple-700 text-xs">
              5% platform fee • Peer-to-peer betting • Live Pyth stream
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
