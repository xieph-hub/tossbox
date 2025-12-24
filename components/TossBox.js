'use client';

import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Trophy, Users, DollarSign, Flame } from 'lucide-react';
import Link from 'next/link';

// Crypto options
const CRYPTOS = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' }
];

const TossBox = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  
  // Game state
  const [selectedCrypto, setSelectedCrypto] = useState('BTC');
  const [prediction, setPrediction] = useState(null);
  const [multiplier, setMultiplier] = useState(1);
  const [stake, setStake] = useState(0.1);
  const [gameState, setGameState] = useState('waiting'); // waiting, active, ended
  const [countdown, setCountdown] = useState(60);
  const [priceData, setPriceData] = useState([]);
  const [startPrice, setStartPrice] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(0);
  
  // Stats
  const [totalPot, setTotalPot] = useState(0);
  const [playerCount, setPlayerCount] = useState(0);
  const [balance, setBalance] = useState(0);
  const [userStreak, setUserStreak] = useState(0);
  const [recentWinners, setRecentWinners] = useState([]);
  
  // Loading states
  const [placingBet, setPlacingBet] = useState(false);

  // Real-time WebSocket price updates
  useEffect(() => {
    const symbol = selectedCrypto.toLowerCase();
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}usdt@trade`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const price = parseFloat(data.p);
      
      setCurrentPrice(price);
      setPriceData(prev => [...prev.slice(-29), { time: Date.now(), price }]);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [selectedCrypto]);

  // Fetch game state periodically
  useEffect(() => {
    fetchGameState();
    const interval = setInterval(fetchGameState, 5000); // Every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Fetch user balance when wallet connects
  useEffect(() => {
    if (publicKey) {
      fetchUserBalance();
    }
  }, [publicKey, connection]);

  // Game countdown
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
      const response = await fetch('/api/get-game-state');
      const data = await response.json();
      
      setTotalPot(data.totalPot || 0);
      setPlayerCount(data.playerCount || 0);
      setRecentWinners(data.recentWinners || []);
      
      // If there's an active round, update countdown
      if (data.activeRound && data.activeRound.status === 'active') {
        const startTime = new Date(data.activeRound.start_time).getTime();
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, 60 - elapsed);
        
        if (remaining > 0) {
          setCountdown(remaining);
          setGameState('active');
          setStartPrice(parseFloat(data.activeRound.start_price));
        }
      }
    } catch (error) {
      console.error('Failed to fetch game state:', error);
    }
  };

  const fetchUserBalance = async () => {
    try {
      const bal = await connection.getBalance(publicKey);
      setBalance(bal / LAMPORTS_PER_SOL);

      // Fetch user stats
      const response = await fetch(`/api/profile?wallet=${publicKey.toString()}`);
      const data = await response.json();
      setUserStreak(data.profile?.win_streak || 0);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const placeBet = async () => {
    if (!prediction || !publicKey || placingBet) return;
    
    setPlacingBet(true);
    
    try {
      // Create transaction to send SOL to treasury
      const treasuryPubkey = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasuryPubkey,
          lamports: Math.floor(stake * LAMPORTS_PER_SOL),
        })
      );

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      console.log('Transaction sent:', signature);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('Transaction confirmed:', signature);

      // Submit bet to backend
      const response = await fetch('/api/place-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          prediction,
          multiplier,
          stakeAmount: stake,
          txSignature: signature,
          crypto: selectedCrypto
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setGameState('active');
        setStartPrice(currentPrice);
        setCountdown(60);
        setBalance(prev => prev - stake);
        
        // Refresh game state
        await fetchGameState();
        
        alert('Bet placed successfully! Good luck! 🎲');
      } else {
        alert('Failed to place bet: ' + (result.error || 'Unknown error'));
      }
      
    } catch (error) {
      console.error('Bet placement error:', error);
      alert('Failed to place bet. Please try again. Error: ' + error.message);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
      {/* Header */}
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
                <Link 
                  href="/profile"
                  className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg font-bold transition-all"
                >
                  Profile
                </Link>
                <Link 
                  href="/leaderboard"
                  className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg font-bold transition-all"
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

      {/* Stats Bar */}
      <div className="max-w-6xl mx-auto grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <DollarSign size={16} />
            <span className="text-sm">Total Pot</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{totalPot.toFixed(2)} SOL</div>
        </div>
        
        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Users size={16} />
            <span className="text-sm">Active Players</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{playerCount}</div>
        </div>
        
        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
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
        {/* Main Game Area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Crypto Selector */}
          <div className="flex gap-2">
            {CRYPTOS.map(crypto => (
              <button
                key={crypto.symbol}
                onClick={() => setSelectedCrypto(crypto.symbol)}
                disabled={gameState === 'active'}
                className={`flex-1 py-3 rounded-lg font-bold transition-all disabled:opacity-50 ${
                  selectedCrypto === crypto.symbol
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {crypto.symbol}
              </button>
            ))}
          </div>

          {/* Price Chart */}
          <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-3xl font-bold">${currentPrice.toFixed(2)}</div>
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
                  <div className="text-sm">
                    {((currentPrice - startPrice) / startPrice * 100).toFixed(2)}%
                  </div>
                </div>
              )}
            </div>

            {priceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={priceData}>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['dataMin - 50', 'dataMax + 50']} hide />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#a855f7" 
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                Connecting to live price feed...
              </div>
            )}
          </div>

          {/* Betting Controls */}
          <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Place Your Bet</h3>
            
            {!publicKey ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">Connect your wallet to start playing</p>
                <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !px-6 !py-3 !rounded-lg !font-bold" />
              </div>
            ) : (
              <>
                {/* Prediction Buttons */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button
                    onClick={() => setPrediction('up')}
                    disabled={gameState === 'active'}
                    className={`py-6 rounded-lg font-bold text-xl transition-all ${
                      prediction === 'up'
                        ? 'bg-green-600 text-white scale-105'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <TrendingUp className="mx-auto mb-2" size={32} />
                    PRICE UP
                  </button>
                  
                  <button
                    onClick={() => setPrediction('down')}
                    disabled={gameState === 'active'}
                    className={`py-6 rounded-lg font-bold text-xl transition-all ${
                      prediction === 'down'
                        ? 'bg-red-600 text-white scale-105'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <TrendingDown className="mx-auto mb-2" size={32} />
                    PRICE DOWN
                  </button>
                </div>

                {/* Multiplier */}
                <div className="mb-6">
                  <label className="block text-sm text-gray-400 mb-2">Confidence Multiplier</label>
                  <div className="flex gap-2">
                    <MultiplierButton value={1} />
                    <MultiplierButton value={2} />
                    <MultiplierButton value={5} />
                    <MultiplierButton value={10} />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Higher multipliers = bigger potential wins, but winners split the pot
                  </p>
                </div>

                {/* Stake Amount */}
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
                    <span className="text-xs ml-2">(if you win alone)</span>
                  </div>
                </div>

                {/* Place Bet Button */}
                <button
                  onClick={placeBet}
                  disabled={!prediction || !publicKey || gameState === 'active' || placingBet || stake > balance}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-4 rounded-lg font-bold text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {placingBet ? 'Placing Bet...' : gameState === 'active' ? 'Round In Progress...' : 'Place Bet'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Recent Winners */}
          <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Trophy size={20} className="text-yellow-400" />
              Recent Winners
            </h3>
            <div className="space-y-3">
              {recentWinners.slice(0, 10).map((winner, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-gray-400 font-mono">
                    {winner.wallet_address.slice(0, 4)}...{winner.wallet_address.slice(-4)}
                  </span>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">+{parseFloat(winner.actual_win).toFixed(2)} SOL</div>
                    <div className="text-xs text-gray-500">{winner.multiplier}x</div>
                  </div>
                </div>
              ))}
              {recentWinners.length === 0 && (
                <div className="text-gray-500 text-sm text-center py-4">
                  No recent winners yet. Be the first!
                </div>
              )}
            </div>
          </div>

          {/* How to Play */}
          <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4">How to Play</h3>
            <ol className="space-y-2 text-sm text-gray-300">
              <li>1. Connect your Solana wallet</li>
              <li>2. Choose a crypto pair (BTC/ETH/SOL)</li>
              <li>3. Predict if price goes UP or DOWN</li>
              <li>4. Select your confidence multiplier</li>
              <li>5. Set your stake amount</li>
              <li>6. Watch the 60-second countdown</li>
              <li>7. Winners split the pot based on multipliers!</li>
            </ol>
            <div className="mt-4 p-3 bg-purple-900/30 rounded border border-purple-700 text-xs text-gray-300">
              5% platform fee on all winnings. Peer-to-peer betting - no house edge!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TossBox;
