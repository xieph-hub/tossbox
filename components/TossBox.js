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
  const [currentCandle, setCurrentCandle] = useState(null);
  const [candleCountdown, setCandleCountdown] = useState(60);
  const [completedCandles, setCompletedCandles] = useState([]);

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);

  // PRICE FEED - 1 second polling for real-time candlesticks
  useEffect(() => {
    let active = true;
    console.log('🔄 Starting real-time price feed for', selectedCrypto);

    const fetchPrice = async () => {
      if (!active) return;
      
      try {
        const url = `/api/get-price?crypto=${selectedCrypto}`;
        const res = await fetch(url);
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        const price = parseFloat(data.price);
        
        if (!price || isNaN(price)) throw new Error('Invalid price');
        
        console.log('✅ TICK:', selectedCrypto, '=', price);
        
        if (active) {
          setCurrentPrice(price);
          
          // Initialize first candle if needed
          if (!currentCandle) {
            const now = Math.floor(Date.now() / 1000);
            setCurrentCandle({
              time: now,
              open: price,
              high: price,
              low: price,
              close: price
            });
            setCandleCountdown(60);
          }
        }
      } catch (err) {
        console.error('❌ Price error:', err.message);
      }
    };

    setCompletedCandles([]);
    setCurrentCandle(null);
    setCurrentPrice(0);
    setCandleCountdown(60);
    fetchPrice();
    
    const interval = setInterval(fetchPrice, 1000); // 1 SECOND for real-time ticks

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedCrypto]);

  // UPDATE CURRENT CANDLE with each price tick
  useEffect(() => {
    if (!currentCandle || currentPrice === 0) return;

    setCurrentCandle(prev => ({
      ...prev,
      close: currentPrice,
      high: Math.max(prev.high, currentPrice),
      low: Math.min(prev.low, currentPrice)
    }));
  }, [currentPrice]);

  // CANDLE COUNTDOWN - Complete candle every 60 seconds
  useEffect(() => {
    if (!currentCandle) return;

    const timer = setInterval(() => {
      setCandleCountdown(prev => {
        if (prev <= 1) {
          // Complete the candle
          console.log('📊 Candle completed:', currentCandle);
          
          setCompletedCandles(prevCandles => {
            const newCandles = [...prevCandles, currentCandle];
            return newCandles.slice(-30); // Keep last 30 candles
          });

          // Start new candle
          const now = Math.floor(Date.now() / 1000);
          setCurrentCandle({
            time: now,
            open: currentPrice,
            high: currentPrice,
            low: currentPrice,
            close: currentPrice
          });

          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentCandle, currentPrice]);

  // RENDER CANDLESTICK CHART with lightweight-charts
  useEffect(() => {
    if (!chartContainerRef.current || (!completedCandles.length && !currentCandle)) return;

    import('lightweight-charts').then(({ createChart }) => {
      if (chartRef.current) {
        chartRef.current.remove();
      }

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 350,
        layout: {
          background: { color: 'transparent' },
          textColor: '#9CA3AF',
        },
        grid: {
          vertLines: { color: '#374151' },
          horzLines: { color: '#374151' },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: '#4B5563',
        },
        rightPriceScale: {
          borderColor: '#4B5563',
        },
        crosshair: {
          mode: 1,
        },
      });

      // Create candlestick series
      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });

      // Combine completed candles with current forming candle
      const allCandles = [...completedCandles];
      if (currentCandle) {
        allCandles.push(currentCandle);
      }

      if (allCandles.length > 0) {
        candlestickSeries.setData(allCandles);
        chart.timeScale().fitContent();
      }

      chartRef.current = chart;
      candlestickSeriesRef.current = candlestickSeries;

      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
        }
      };
    });
  }, [completedCandles, currentCandle]);

  // UPDATE CURRENT CANDLE in chart in real-time
  useEffect(() => {
    if (!candlestickSeriesRef.current || !currentCandle) return;

    const allCandles = [...completedCandles, currentCandle];
    candlestickSeriesRef.current.setData(allCandles);
  }, [currentCandle, completedCandles]);

  useEffect(() => {
    fetchGameState();
    const interval = setInterval(fetchGameState, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (publicKey) fetchUserBalance();
  }, [publicKey, connection]);

  useEffect(() => {
    if (gameState === 'active' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && gameState === 'active') {
      endRound();
    }
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
          setStartPrice(parseFloat(data.activeRound.start_price));
        }
      }
    } catch (err) {
      console.error('Game state error:', err);
    }
  };

  const fetchUserBalance = async () => {
    try {
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
      const treasury = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasury,
          lamports: Math.floor(stake * LAMPORTS_PER_SOL),
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
        setBalance(prev => prev - stake);
        await fetchGameState();
        alert('✅ Bet placed successfully!');
      } else {
        alert('❌ Failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Bet error:', err);
      alert('❌ Error: ' + err.message);
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
        multiplier === value ? 'bg-purple-600 text-white scale-105' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
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

  const isCurrentCandleGreen = currentCandle && currentCandle.close >= currentCandle.open;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">TossBox</h1>
            <p className="text-gray-400 text-sm">Real-Time Candlestick Trading • Predict. Win. Repeat.</p>
          </div>
          
          <div className="flex items-center gap-4">
            {publicKey && (
              <div className="flex gap-2">
                <Link href="/profile" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg font-bold">Profile</Link>
                <Link href="/leaderboard" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg font-bold">Leaderboard</Link>
              </div>
            )}
            
            {!publicKey ? (
              <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !px-6 !py-3 !rounded-lg !font-bold" />
            ) : (
              <div className="text-right">
                <div className="text-sm text-gray-400">Balance</div>
                <div className="text-2xl font-bold">{balance.toFixed(3)} SOL</div>
                <div className="text-xs text-gray-500">{publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}</div>
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
          <div className="text-2xl font-bold text-green-400">{totalPot.toFixed(2)} SOL</div>
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
            <h3 className="text-sm font-bold text-gray-400 mb-3">Select Asset • {CRYPTOS.length} Available • Live Candlesticks</h3>
            <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-2">
              {CRYPTOS.map(c => (
                <button
                  key={c.symbol}
                  onClick={() => {
                    console.log('🔄 Switching to', c.symbol);
                    setSelectedCrypto(c.symbol);
                  }}
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

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-3xl font-bold flex items-center gap-2">
                  ${formatPrice(currentPrice)}
                  {currentCandle && (
                    <span className={`text-lg ${isCurrentCandleGreen ? 'text-green-400' : 'text-red-400'}`}>
                      {isCurrentCandleGreen ? '▲' : '▼'}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-400">{selectedCrypto}/USD • Live Tick Every 1s</div>
              </div>

              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">{candleCountdown}s</div>
                <div className="text-xs text-gray-400">Next Candle</div>
              </div>
              
              {gameState === 'active' && (
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-400">{countdown}s</div>
                  <div className="text-xs text-gray-400">Round Ends</div>
                </div>
              )}
              
              {startPrice && currentPrice > 0 && (
                <div className={`text-right ${currentPrice >= startPrice ? 'text-green-400' : 'text-red-400'}`}>
                  <div className="text-2xl font-bold">
                    {currentPrice >= startPrice ? '+' : ''}{(currentPrice - startPrice).toFixed(2)}
                  </div>
                  <div className="text-sm">{((currentPrice - startPrice) / startPrice * 100).toFixed(2)}%</div>
                </div>
              )}
            </div>

            {/* CANDLESTICK CHART */}
            {currentPrice > 0 && (completedCandles.length > 0 || currentCandle) ? (
              <div>
                <div 
                  ref={chartContainerRef}
                  className="w-full mb-3"
                  style={{ height: '350px' }}
                />
                <div className="flex items-center justify-between text-xs text-gray-400 px-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-5 bg-green-500 rounded-sm"></div>
                      <span>Green (Up)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-5 bg-red-500 rounded-sm"></div>
                      <span>Red (Down)</span>
                    </div>
                  </div>
                  {currentCandle && (
                    <div className="text-right">
                      <span className="font-mono">
                        O: {formatPrice(currentCandle.open)} 
                        <span className="mx-2">H: {formatPrice(currentCandle.high)}</span>
                        <span className="mx-2">L: {formatPrice(currentCandle.low)}</span>
                        C: {formatPrice(currentCandle.close)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-[350px] flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-3"></div>
                  <div className="text-gray-400">
                    {currentPrice === 0 ? `Loading ${selectedCrypto} real-time data...` : 'Building candlesticks...'}
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
                      prediction === 'up' ? 'bg-green-600 text-white scale-105' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    } disabled:opacity-50`}
                  >
                    <TrendingUp className="mx-auto mb-2" size={32} />
                    UP
                  </button>
                  
                  <button
                    onClick={() => setPrediction('down')}
                    disabled={gameState === 'active'}
                    className={`py-6 rounded-lg font-bold text-xl transition-all ${
                      prediction === 'down' ? 'bg-red-600 text-white scale-105' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
                    Potential Win: <span className="text-green-400 font-bold">{(stake * multiplier * 0.95).toFixed(2)} SOL</span>
                  </div>
                </div>

                <button
                  onClick={placeBet}
                  disabled={!prediction || gameState === 'active' || placingBet || stake > balance || currentPrice === 0}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-4 rounded-lg font-bold text-xl transition-all disabled:opacity-50"
                >
                  {placingBet ? 'Placing Bet...' : gameState === 'active' ? 'Round In Progress' : currentPrice === 0 ? 'Loading Price...' : 'Place Bet'}
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
                  <span className="text-gray-400 font-mono">{w.wallet_address.slice(0, 4)}...{w.wallet_address.slice(-4)}</span>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">+{parseFloat(w.actual_win).toFixed(2)} SOL</div>
                    <div className="text-xs text-gray-500">{w.multiplier}x</div>
                  </div>
                </div>
              ))}
              {recentWinners.length === 0 && <div className="text-gray-500 text-center py-4 text-sm">No winners yet!</div>}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4">🔥 Real-Time Candlesticks</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>✅ Live price ticks every 1 second</li>
              <li>📊 New candle forms every 60s</li>
              <li>🟢 Green = Close higher than Open</li>
              <li>🔴 Red = Close lower than Open</li>
              <li>📈 Watch candles form in real-time</li>
              <li>💎 {CRYPTOS.length} crypto assets available</li>
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
              5% platform fee • Peer-to-peer betting • Live CoinGecko prices
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TossBox;
