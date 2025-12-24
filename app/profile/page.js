'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Trophy, TrendingUp, DollarSign, Flame, Calendar, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function Profile() {
  const { publicKey } = useWallet();
  const [profile, setProfile] = useState(null);
  const [recentBets, setRecentBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (publicKey) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [publicKey]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/profile?wallet=${publicKey.toString()}`);
      const data = await response.json();
      setProfile(data.profile);
      setRecentBets(data.recentBets || []);
    } catch (error) {
      console.error('Profile fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-6">View your stats and betting history</p>
          <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !px-6 !py-3 !rounded-lg !font-bold" />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Link 
            href="/"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-all"
          >
            <ArrowLeft size={20} />
            Back to Game
          </Link>
          <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
        </div>

        {/* Profile Header */}
        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 border border-gray-700 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Your Profile</h1>
              <p className="text-gray-400 font-mono text-sm">
                {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
              </p>
            </div>
            {profile?.win_streak > 0 && (
              <div className="flex items-center gap-2 bg-orange-500/20 border border-orange-500 rounded-lg px-4 py-2">
                <Flame className="text-orange-400" size={24} />
                <div>
                  <div className="text-2xl font-bold">{profile.win_streak}</div>
                  <div className="text-xs text-gray-400">Win Streak</div>
                </div>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <DollarSign size={16} />
                <span className="text-sm">Total Wagered</span>
              </div>
              <div className="text-2xl font-bold">{parseFloat(profile?.total_wagered || 0).toFixed(2)} SOL</div>
            </div>

            <div className="bg-green-500/20 border border-green-500 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Trophy size={16} />
                <span className="text-sm">Total Won</span>
              </div>
              <div className="text-2xl font-bold text-green-400">
                {parseFloat(profile?.total_won || 0).toFixed(2)} SOL
              </div>
            </div>

            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <TrendingUp size={16} />
                <span className="text-sm">Win Rate</span>
              </div>
              <div className="text-2xl font-bold">
                {profile?.total_wagered > 0 
                  ? ((profile.total_won / profile.total_wagered) * 100).toFixed(1)
                  : 0}%
              </div>
            </div>

            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Calendar size={16} />
                <span className="text-sm">Member Since</span>
              </div>
              <div className="text-sm font-bold">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Bets */}
        <div className="bg-gray-800/50 backdrop-blur rounded-lg border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold">Recent Bets</h2>
          </div>

          <div className="divide-y divide-gray-700">
            {recentBets.map((bet) => (
              <div key={bet.id} className="p-4 hover:bg-gray-700/30 transition-all">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{bet.crypto}</span>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        bet.prediction === 'up' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {bet.prediction.toUpperCase()}
                      </span>
                      <span className="text-gray-400 text-sm">{bet.multiplier}x</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(bet.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold mb-1">
                      Stake: {parseFloat(bet.stake_amount).toFixed(2)} SOL
                    </div>
                    {bet.status === 'won' && (
                      <div className="text-green-400 font-bold">
                        +{parseFloat(bet.actual_win).toFixed(2)} SOL
                      </div>
                    )}
                    {bet.status === 'lost' && (
                      <div className="text-red-400">Lost</div>
                    )}
                    {bet.status === 'pending' && (
                      <div className="text-yellow-400">Pending</div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {recentBets.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                No bets yet. Start playing to see your history!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
