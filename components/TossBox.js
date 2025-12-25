'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TrendingUp, TrendingDown, Trophy, Users, DollarSign, Flame } from 'lucide-react';
import Link from 'next/link';

// 32 CRYPTO ASSETS
const CRYPTOS = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'XRP', name: 'Ripple' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'MATIC', name: 'Polygon' },
  { symbol: 'DOT', name: 'Polkadot' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'SHIB', name: 'Shiba Inu' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'UNI', name: 'Uniswap' },
  { symbol: 'LTC', name: 'Litecoin' },
  { symbol: 'TRX', name: 'Tron' },
  { symbol: 'ATOM', name: 'Cosmos' },
  { symbol: 'XLM', name: 'Stellar' },
  { symbol: 'ETC', name: 'Ethereum Classic' },
  { symbol: 'FIL', name: 'Filecoin' },
  { symbol: 'HBAR', name: 'Hedera' },
  { symbol: 'APT', name: 'Aptos' },
  { symbol: 'ARB', name: 'Arbitrum' },
  { symbol: 'OP', name: 'Optimism' },
  { symbol: 'NEAR', name: 'Near' },
  { symbol: 'AAVE', name: 'Aave' },
  { symbol: 'STX', name: 'Stacks' },
  { symbol: 'INJ', name: 'Injective' },
  { symbol: 'SUI', name: 'Sui' },
  { symbol: 'IMX', name: 'Immutable X' },
  { symbol: 'RENDER', name: 'Render' },
  { symbol: 'FET', name: 'Fetch.ai' },
  { symbol: 'PEPE', name: 'Pepe' }
];

const TossBox = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [selectedCrypto, setSelectedCrypto] = useState('BTC');
  const [prediction, setPrediction] = useState(null);
  const [multiplier, setMultiplier] = useState(1);
  const [stake, setStake] = useState(0.1);
  const [gameState, setGameState] = useState('waiting');
  const [countdown, setCountdown] = useState(60);
  const [startPrice, setStartPrice] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(0);

  const [totalPot, setTotalPot] = useState(0);
  const [playerCount, setPlayerCount] = useState(0);
  const [balance, setBalance] = useState(0);
  const [userStreak, setUserStreak] = useState(0);
  const [recentWinners, setRecentWinners] = useState([]);
  const [placingBet, setPlacingBet] = useState(false);

  // CANDLESTICK DATA
  const [candleData, setCandleData] = useState([]);
  const [currentCandle, setCurrentCandle] = useState(null);

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const didFitOnceRef = useRef(false);

  // PRICE FEED - Real-time updates every second
  useEffect(() => {
    let active = true;

    const fetchPrice = async () => {
      if (!active) return;

      try {
        const url = `/api/get-price?crypto=${encodeURIComponent(selectedCrypto)}`;
        const url = `/api/get-price?crypto=${encodeURIComponent(selectedCrypto)}&t=${Date.now()}`;
const res = await fetch(url, {
  cache: 'no-store',
  headers: { 'Cache-Control': 'no-store' },
});

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const price = Number(data?.price);

        if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid price');

        if (active) {
          setCurrentPrice(price);

          const nowSec = Math.floor(Date.now() / 1000);
          const candleTime = Math.floor(nowSec / 60) * 60; // 1-min candles

          setCurrentCandle((prev) => {
            // Start new candle if time has changed
            if (!prev || prev.time !== candleTime) {
              // Push previous candle into history
              if (prev) {
                setCandleData((prevData) => {
                  const next = [...prevData, prev];
                  return next.slice(-50);
                });
              }

              return {
                time: candleTime,
                open: price,
                high: price,
                low: price,
                close: price
              };
            }

            // Update existing candle
            return {
              ...prev,
              close: price,
              high: Math.max(prev.high, price),
              low: Math.min(prev.low, price)
            };
          });
        }
      } catch (err) {
        // keep it quiet-ish; chart will show loader
        console.error('❌ Price error:', err?.message || err);
      }
    };

    // reset when switching asset
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

  // INIT CHART (MOUNT ONCE) - IMPORTANT: container must always exist
  useEffect(() => {
    let mounted = true;

    async function initChart() {
      if (!chartContainerRef.current) return;

      const { createChart } = await import('lightweight-charts');
      if (!mounted || !chartContainerRef.current) return;

      // cleanup existing chart if any
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
          background: { color: 'transparent' },
          textColor: '#9CA3AF'
        },
        grid: {
          vertLines: { color: '#1f2937' },
          horzLines: { color: '#1f2937' }
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: '#374151'
        },
        rightPriceScale: {
          borderColor: '#374151',
          scaleMargins: { top: 0.1, bottom: 0.1 }
        }
      });

      const series = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444'
      });

      chartRef.current = chart;
      candlestickSeriesRef.current = series;

      const handleResize = () => {
        if (!chartContainerRef.current || !chartRef.current) return;
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      };

      window.addEventListener('resize', handleResize);

      // store cleanup
      chartRef.current.__cleanup = () => {
        window.removeEventListener('resize', handleResize);
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

  // UPDATE CHART DATA
  useEffect(() => {
    if (!candlestickSeriesRef.current) return;

    const allCandles = [...candleData];
    if (currentCandle) allCandles.push(currentCandle);

    if (allCandles.length > 0) {
      candlestickSeriesRef.current.setData(allCandles);

      // Fit only once when we have a bit of data
      if (!didFitOnceRef.current && chartRef.current && allCandles.length >= 2) {
        didFitOnceRef.current = true;
        try {
          chartRef.current.timeScale().fitContent();
        } catch {}
      }
    }
  }, [candleData, currentCandle]);

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
    if (gameState === 'active' && countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && gameState === 'active') {
      endRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, countdown]);

  const fetchGameState = async () => {
    try {
      const res = await fetch('/api/get-game-state');
      const data = await res.json();

      setTotalPot(data.totalPot || 0);
      setPlayerCount(data.playerCount || 0);
      setRecentWinners(data.recentWinners || []);

      if (data.activeRound?.status === 'active') {
        const startTime = new Date(data.activeRound.start_time).getTime();
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, 60 - elapsed);

        if (remaining > 0) {
          setCountdown(remaining);
          setGameState('active');
          setStartPrice(Number(data.activeRound.start_price));
        }
      }
    } catch (err) {
      console.error('Game state error:', err);
    }
  };

  const fetchUserBalance = async () => {
    try {
      if (!publicKey) return;
      const bal = await connection.getBalance(publicKey);
      setBalance(bal / LAMPORTS_PER_SOL);

      const res = await fetch(`/api/profile?wallet=${publicKey.toString()}`);
      const data = await res.json();
      setUserStreak(data.profile?.win_streak || 0);
    } catch (err) {
      console.error('Balance error:', err);
    }
  };

  const placeBet = async () => {
    if (!prediction || !publicKey || placingBet || currentPrice === 0) return;

    setPlacingBet(true);

    try {
      // IMPORTANT: NEXT_PUBLIC_TREASURY_WALLET must exist at build-time for client usage
      const treasury = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET);

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasury,
          lamports: Math.floor(stake * LAMPORTS_PER_SOL)
        })
      );

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, 'confirmed');

      const res = await fetch('/api/place-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          prediction,
          multiplier,
          stakeAmount: stake,
          txSignature: sig,
          crypto: selectedCrypto
        })
      });

      const result = await res.json();

      if (result.success) {
        setGameState('active');
        setStartPrice(currentPrice);
        setCountdown(60);
        setBalance((prev) => prev - stake);
        await fetchGameState();
        alert('✅ Bet placed successfully!');
      } else {
        alert('❌ Failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Bet error:', err);
      alert('❌ Error: ' + (err?.message || 'Unknown error'));
    } finally {
      setPlacingBet(false);
    }
  };

  const endRound = () => {
    setGameState('ended');
    setTimeout(() => {
      setGameState('waiting');
      setPrediction(null);
      setStartPrice(null);
      setCountdown(60);
      fetchGameState();
      if (publicKey) fetchUserBalance();
    }, 3000);
  };

  const MultiplierButton = ({ value }) => (
    <button
      onClick={() => setMultiplier(value)}
      disabled={gameState === 'active'}
      className={`px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50 ${
        multiplier === value
          ? 'bg-purple-600 text-white scale-105'
          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
      }`}
    >
      {value}x
    </button>
  );

  const formatPrice = (p) => {
    if (!p || p === 0) return '0.00';
    if (p < 0.00001) return p.toFixed(8);
    if (p < 0.001) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

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
                <Link
                  href="/leaderboard"
                  className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg font-bold"
                >
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
                  disabled={gameState === 'active'}
                  className={`py-2 px-1 rounded-lg font-bold text-xs transition-all disabled:opacity-50 ${
                    selectedCrypto === c.symbol
                      ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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

              {gameState === 'active' && (
                <div className="text-center bg-purple-900/30 px-6 py-3 rounded-lg border border-purple-700">
                  <div className="text-3xl font-bold text-purple-400">{countdown}</div>
                  <div className="text-xs text-gray-400">SECONDS LEFT</div>
                </div>
              )}

              {startPrice && currentPrice > 0 && gameState === 'active' && (
                <div className={`text-right ${currentPrice >= startPrice ? 'text-green-400' : 'text-red-400'}`}>
                  <div className="text-3xl font-bold">
                    {currentPrice >= startPrice ? '+' : ''}
                    {(((currentPrice - startPrice) / startPrice) * 100).toFixed(2)}%
                  </div>
                  <div className="text-sm text-gray-400">Your P&amp;L</div>
                </div>
              )}
            </div>

            {/* CANDLESTICK CHART (container always mounted) */}
            <div className="p-4">
              <div className="relative w-full" style={{ height: '400px' }}>
                <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />

                {currentPrice <= 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/40">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-3"></div>
                      <div className="text-gray-200">Loading {selectedCrypto} price data...</div>
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
                    <div
                      className={`font-bold ${
                        currentCandle.close >= currentCandle.open ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
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
                    onClick={() => setPrediction('up')}
                    disabled={gameState === 'active'}
                    className={`py-6 rounded-lg font-bold text-xl transition-all ${
                      prediction === 'up'
                        ? 'bg-green-600 text-white scale-105'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    } disabled:opacity-50`}
                  >
                    <TrendingUp className="mx-auto mb-2" size={32} />
                    UP
                  </button>

                  <button
                    onClick={() => setPrediction('down')}
                    disabled={gameState === 'active'}
                    className={`py-6 rounded-lg font-bold text-xl transition-all ${
                      prediction === 'down'
                        ? 'bg-red-600 text-white scale-105'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
                    disabled={gameState === 'active'}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white font-bold text-xl disabled:opacity-50"
                  />
                  <div className="text-sm text-gray-400 mt-2">
                    Potential Win:{' '}
                    <span className="text-green-400 font-bold">{(stake * multiplier * 0.95).toFixed(2)} SOL</span>
                  </div>
                </div>

                <button
                  onClick={placeBet}
                  disabled={!prediction || gameState === 'active' || placingBet || stake > balance || currentPrice === 0}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-4 rounded-lg font-bold text-xl transition-all disabled:opacity-50"
                >
                  {placingBet
                    ? 'Placing Bet...'
                    : gameState === 'active'
                    ? 'Round In Progress'
                    : currentPrice === 0
                    ? 'Loading Price...'
                    : 'Place Bet'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
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
              <li className="flex items-center gap-2">
                <div className="w-3 h-6 bg-green-500 rounded"></div>
                <span>Green candle = price went up</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-3 h-6 bg-red-500 rounded"></div>
                <span>Red candle = price went down</span>
              </li>
              <li className="text-gray-400">• Each candle = 1 minute</li>
              <li className="text-gray-400">• Updates every second</li>
              <li className="text-gray-400">• {CRYPTOS.length} assets to trade</li>
            </ul>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4">How It Works</h3>
            <ol className="space-y-2 text-sm text-gray-300">
              <li>1. Connect Solana wallet</li>
              <li>2. Pick from {CRYPTOS.length} assets</li>
              <li>3. Predict UP or DOWN</li>
              <li>4. Choose multiplier (1x-10x)</li>
              <li>5. Set your stake</li>
              <li>6. Wait 60 seconds</li>
              <li>7. Winners split the pot!</li>
            </ol>
            <div className="mt-4 p-3 bg-purple-900/30 rounded border border-purple-700 text-xs">
              5% platform fee • Peer-to-peer betting • Live Pyth prices
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TossBox;
