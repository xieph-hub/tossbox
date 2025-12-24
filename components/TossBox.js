import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Trophy, Users, DollarSign } from 'lucide-react';

// Simulated crypto price data (replace with real WebSocket in production)
const CRYPTOS = ['BTC', 'ETH', 'SOL'];

const TossBox = () => {
  const [wallet, setWallet] = useState(null);
  const [selectedCrypto, setSelectedCrypto] = useState('BTC');
  const [prediction, setPrediction] = useState(null);
  const [multiplier, setMultiplier] = useState(1);
  const [stake, setStake] = useState(0.1);
  const [gameState, setGameState] = useState('waiting'); // waiting, active, ended
  const [countdown, setCountdown] = useState(60);
  const [priceData, setPriceData] = useState([]);
  const [startPrice, setStartPrice] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(43250);
  const [totalPot, setTotalPot] = useState(12.5);
  const [playerCount, setPlayerCount] = useState(23);
  const [balance, setBalance] = useState(10.5);
  const [recentWinners, setRecentWinners] = useState([
    { addr: '7xK9...mN2p', amount: 2.5, multiplier: 5 },
    { addr: '9Bv3...kL8q', amount: 1.2, multiplier: 2 },
  ]);

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

  // Game countdown
  useEffect(() => {
    if (gameState === 'active' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      endRound();
    }
  }, [gameState, countdown]);

  const connectWallet = () => {
    setWallet('7xK9mN2pQwRtLvBc3sD8fGhJ4kM6nP9qX1yZ5aE2bF7c');
    // In production: Use Solana wallet adapter
  };

  const placeBet = () => {
    if (!prediction || !wallet) return;
    
    setGameState('active');
    setStartPrice(currentPrice);
    setCountdown(60);
    setTotalPot(prev => prev + stake);
    setBalance(prev => prev - stake);
    
    // In production: Send transaction to treasury wallet
    console.log('Bet placed:', { prediction, multiplier, stake });
  };

  const endRound = () => {
    const priceChange = currentPrice - startPrice;
    const won = (prediction === 'up' && priceChange > 0) || (prediction === 'down' && priceChange < 0);
    
    if (won) {
      const payout = stake * multiplier * 0.95; // 5% fee
      setBalance(prev => prev + payout + stake);
      setRecentWinners(prev => [{ addr: wallet.slice(0, 4) + '...' + wallet.slice(-4), amount: payout, multiplier }, ...prev.slice(0, 4)]);
    }
    
    setGameState('ended');
    
    setTimeout(() => {
      setGameState('waiting');
      setPrediction(null);
      setStartPrice(null);
    }, 3000);
  };

  const MultiplierButton = ({ value }) => (
    <button
      onClick={() => setMultiplier(value)}
      className={`px-4 py-2 rounded-lg font-bold transition-all ${
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
          
          {!wallet ? (
            <button
              onClick={connectWallet}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-bold transition-all"
            >
              <Wallet size={20} />
              Connect Wallet
            </button>
          ) : (
            <div className="text-right">
              <div className="text-sm text-gray-400">Balance</div>
              <div className="text-2xl font-bold">{balance.toFixed(2)} SOL</div>
              <div className="text-xs text-gray-500">{wallet.slice(0, 4)}...{wallet.slice(-4)}</div>
            </div>
          )}
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
          <div className="text-2xl font-bold text-yellow-400">3 🔥</div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-6">
        {/* Main Game Area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Crypto Selector */}
          <div className="flex gap-2">
            {CRYPTOS.map(crypto => (
              <button
                key={crypto}
                onClick={() => setSelectedCrypto(crypto)}
                className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                  selectedCrypto === crypto
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {crypto}
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
              
              {startPrice && (
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
          </div>

          {/* Betting Controls */}
          <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Place Your Bet</h3>
            
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
                disabled={gameState === 'active'}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white font-bold text-xl disabled:opacity-50"
              />
              <div className="text-sm text-gray-400 mt-2">
                Potential Win: <span className="text-green-400 font-bold">{(stake * multiplier * 0.95).toFixed(2)} SOL</span>
              </div>
            </div>

            {/* Place Bet Button */}
            <button
              onClick={placeBet}
              disabled={!prediction || !wallet || gameState === 'active'}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-4 rounded-lg font-bold text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {gameState === 'active' ? 'Round In Progress...' : 'Place Bet'}
            </button>
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
              {recentWinners.map((winner, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">{winner.addr}</span>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">+{winner.amount.toFixed(2)} SOL</div>
                    <div className="text-xs text-gray-500">{winner.multiplier}x</div>
                  </div>
                </div>
              ))}
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
