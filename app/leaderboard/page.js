'use client';

import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, DollarSign, Flame } from 'lucide-react';
import Link from 'next/link';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [period, setPeriod] = useState('all'); // all, week, day

  useEffect(() => {
    fetchLeaderboard();
  }, [period]);

  const fetchLeaderboard = async () => {
    const response = await fetch(`/api/leaderboard?period=${period}`);
    const data = await response.json();
    setLeaderboard(data.leaderboard || []);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">🏆 Leaderboard</h1>
            <p className="text-gray-400">Top players on TossBox</p>
          </div>
          <Link 
            href="/"
            className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-bold transition-all"
          >
            Back to Game
          </Link>
        </div>

        {/* Period Filter */}
        <div className="flex gap-2 mb-6">
          {['all', 'week', 'day'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                period === p
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {p === 'all' ? 'All Time' : p === 'week' ? 'This Week' : 'Today'}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="bg-gray-800/50 backdrop-blur rounded-lg border border-gray-700">
          <div className="grid grid-cols-6 gap-4 p-4 border-b border-gray-700 text-sm text-gray-400 font-bold">
            <div>Rank</div>
            <div className="col-span-2">Player</div>
            <div>Total Won</div>
            <div>Win Rate</div>
            <div>Streak</div>
          </div>

          {leaderboard.map((player, index) => (
            <div 
              key={player.wallet_address}
              className="grid grid-cols-6 gap-4 p-4 border-b border-gray-700/50 hover:bg-gray-700/30 transition-all"
            >
              <div className="flex items-center gap-2">
                {index < 3 ? (
                  <span className="text-2xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </span>
                ) : (
                  <span className="text-gray-400 font-bold">#{index + 1}</span>
                )}
              </div>
              
              <div className="col-span-2 font-mono text-sm">
                {player.wallet_address.slice(0, 6)}...{player.wallet_address.slice(-4)}
              </div>
              
              <div className="text-green-400 font-bold flex items-center gap-1">
                <DollarSign size={14} />
                {parseFloat(player.total_won).toFixed(2)}
              </div>
              
              <div className="flex items-center gap-1">
                <TrendingUp size={14} className="text-blue-400" />
                <span>{player.win_rate}%</span>
              </div>
              
              <div className="flex items-center gap-1">
                {player.win_streak > 0 && <Flame size={14} className="text-orange-400" />}
                <span className="font-bold">{player.win_streak}</span>
              </div>
            </div>
          ))}

          {leaderboard.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No players yet. Be the first to compete!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
