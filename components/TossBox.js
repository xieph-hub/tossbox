'use client';

import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Trophy, Users, DollarSign, Flame } from 'lucide-react';
import Link from 'next/link';

// 30+ CRYPTO ASSETS
const CRYPTOS = [
  { symbol: 'BTC', name: 'Bitcoin', binance: 'BTCUSDT' },
  { symbol: 'ETH', name: 'Ethereum', binance: 'ETHUSDT' },
  { symbol: 'SOL', name: 'Solana', binance: 'SOLUSDT' },
  { symbol: 'BNB', name: 'BNB', binance: 'BNBUSDT' },
  { symbol: 'XRP', name: 'Ripple', binance: 'XRPUSDT' },
  { symbol: 'ADA', name: 'Cardano', binance: 'ADAUSDT' },
  { symbol: 'DOGE', name: 'Dogecoin', binance: 'DOGEUSDT' },
  { symbol: 'MATIC', name: 'Polygon', binance: 'MATICUSDT' },
  { symbol: 'DOT', name: 'Polkadot', binance: 'DOTUSDT' },
  { symbol: 'AVAX', name: 'Avalanche', binance: 'AVAXUSDT' },
  { symbol: 'SHIB', name: 'Shiba Inu', binance: 'SHIBUSDT' },
  { symbol: 'LINK', name: 'Chainlink', binance: 'LINKUSDT' },
  { symbol: 'UNI', name: 'Uniswap', binance: 'UNIUSDT' },
  { symbol: 'LTC', name: 'Litecoin', binance: 'LTCUSDT' },
  { symbol: 'TRX', name: 'Tron', binance: 'TRXUSDT' },
  { symbol: 'ATOM', name: 'Cosmos', binance: 'ATOMUSDT' },
  { symbol: 'XLM', name: 'Stellar', binance: 'XLMUSDT' },
  { symbol: 'ETC', name: 'Ethereum Classic', binance: 'ETCUSDT' },
  { symbol: 'FIL', name: 'Filecoin', binance: 'FILUSDT' },
  { symbol: 'HBAR', name: 'Hedera', binance: 'HBARUSDT' },
  { symbol: 'APT', name: 'Aptos', binance: 'APTUSDT' },
  { symbol: 'ARB', name: 'Arbitrum', binance: 'ARBUSDT' },
  { symbol: 'OP', name: 'Optimism', binance: 'OPUSDT' },
  { symbol: 'NEAR', name: 'Near', binance: 'NEARUSDT' },
  { symbol: 'AAVE', name: 'Aave', binance: 'AAVEUSDT' },
  { symbol: 'STX', name: 'Stacks', binance: 'STXUSDT' },
  { symbol: 'INJ', name: 'Injective', binance: 'INJUSDT' },
  { symbol: 'SUI', name: 'Sui', binance: 'SUIUSDT' },
  { symbol: 'IMX', name: 'Immutable X', binance: 'IMXUSDT' },
  { symbol: 'RENDER', name: 'Render', binance: 'RENDERUSDT' },
  { symbol: 'FET', name: 'Fetch.ai', binance: 'FETUSDT' },
  { symbol: 'PEPE', name: 'Pepe', binance: 'PEPEUSDT' }
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
  const [priceData, setPriceData] = useState([]);
  
  const [totalPot, setTotalPot] = useState(0);
  const [playerCount, setPlayerCount] = useState(0);
  const [balance, setBalance] = useState(0);
  const [userStreak, setUserStreak] = useState(0);
  const [recentWinners, setRecentWinners] = useState([]);
  const [placingBet, setPlacingBet] = useState(false);

  // PURE REST API - NO WEBSOCKET
  useEffect(() => {
    const crypto = CRYPTOS.find(c => c.symbol === selectedCrypto);
    if (!crypto) {
      console.error('❌ Crypto not found:', selectedCrypto);
      return;
    }

    let active = true;
    console.log('🔄 Starting REST-ONLY price feed for', selectedCrypto);

    const fetchPrice = async () => {
      if (!active) return;
      
      try {
        console.log('📡 Fetching:', crypto.binance);
        const url = `/api/get-price?crypto=${selectedCrypto}`;
        
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        console.log('Response status:', res.status);
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        console.log('📊 Raw data:', data);
        
        const price = parseFloat(data.price);
        
        if (!price || isNaN(price)) {
          throw new Error('Invalid price: ' + data.price);
        }
        
        console.log('✅ PRICE:', selectedCrypto, '=', price);
        
        if (active) {
          setCurrentPrice(price);
          setPriceData(prev => [...prev.slice(-29), { time: Date.now(), price }]);
        }
      } catch (err) {
        console.error('❌ Price fetch error:', err.message);
      }
    };

    // Fetch immediately
    fetchPrice();
    
    // Then poll every 2 seconds
    const interval = setInterval(fetchPrice, 2000);

    return () => {
      active = false;
      clearInterval(interval);
      console.log('🛑 Stopped price feed for', selectedCrypto);
    };
  }, [selectedCrypto]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">TossBox</h1>
            <p className="text-gray-400 text-sm">Predict. Win. Repeat.</p>
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
            <h3 className="text-sm font-bold text-gray-400 mb-3">Select Asset • {CRYPTOS.length} Available • Live Binance Prices</h3>
            <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-2">
              {CRYPTOS.map(c => (
                <button
                  key={c.symbol}
                  onClick={() => {
                    console.log('🔄 Switching to', c.symbol);
                    setSelectedCrypto(c.symbol);
                    setPriceData([]);
                    setCurrentPrice(0);
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
                <div className="text-3xl font-bold">${formatPrice(currentPrice)}</div>
                <div className="text-sm text-gray-400">{selectedCrypto}/USD</div>
              </div>
              
              {gameState === 'active' && (
                <div className="text-center">
                  <div className="text-5xl font-bold text-purple-400">{countdown}s</div>
                  <div className="text-sm text-gray-400">Time remaining</div>
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

            {currentPrice > 0 && priceData.length > 1 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={priceData}>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Line type="monotone" dataKey="price" stroke="#a855f7" strokeWidth={3} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-3"></div>
                  <div className="text-gray-400">
                    {currentPrice === 0 ? `Fetching ${selectedCrypto} price...` : 'Building chart...'}
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
              5% platform fee • Peer-to-peer betting • Live Binance prices
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TossBox;
