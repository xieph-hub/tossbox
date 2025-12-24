'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Trophy, TrendingUp, DollarSign, Flame, Calendar, ArrowLeft, Copy, Check } from 'lucide-react';
import Link from 'next/link';

export default function Profile() {
  const { publicKey } = useWallet();
  const [profile, setProfile] = useState(null);
  const [recentBets, setRecentBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  useEffect(() => {
    if (publicKey) {
      fetchProfile();
      generateReferralCode();
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

  const generateReferralCode = async () => {
    setGeneratingCode(true);
    try {
      const response = await fetch('/api/referral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: publicKey.toString() })
      });
      const data = await response.json();
      setReferralCode(data.referralCode || '');
    } catch (error) {
      console.error('Failed to generate referral code:', error);
    } finally {
      setGeneratingCode(false);
    }
  };

  const copyReferralLink = () => {
    const link = `https://tossbox.fun?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">👤</div>
          <h1 className="text-3xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-6">View your stats, betting history, and referral earnings</p>
          <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !px-6 !py-3 !rounded-lg !font-bold" />
          <div className="mt-6">
            <Link 
              href="/"
              className="text-gray-400 hover:text-white transition-all"
            >
              ← Back to Game
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <div className="text-xl">Loading profile...</div>
        </div>
      </div>
    );
  }

  const winRate = profile?.total_wagered > 0 
    ? ((profile.total_won / profile.total_wagered) * 100).toFixed(1)
    : 0;

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
          <div className="flex gap-2">
            <Link 
              href="/leaderboard"
              className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg font-bold transition-all"
            >
              Leaderboard
            </Link>
            <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
          </div>
        </div>

        {/* Profile Header */}
        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 border border-gray-700 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Your Profile</h1>
              <p className="text-gray-400 font-mono text-sm">
                {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
              </p>
            </div>
            {profile?.win_streak > 0 && (
              <div className="flex items-center gap-2 bg-orange-500/20 border border-orange-500 rounded-lg px-6 py-3">
                <Flame className="text-orange-400" size={28} />
                <div>
                  <div className="text-3xl font-bold">{profile.win_streak}</div>
                  <div className="text-xs text-gray-400">Win Streak</div>
                </div>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <DollarSign size={16} />
                <span className="text-sm">Total Wagered</span>
              </div>
              <div className="text-2xl font-bold">{parseFloat(profile?.total_wagered || 0).toFixed(3)} SOL</div>
            </div>

            <div className="bg-green-500/20 border border-green-500 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Trophy size={16} />
                <span className="text-sm">Total Won</span>
              </div>
              <div className="text-2xl font-bold text-green-400">
                {parseFloat(profile?.total_won || 0).toFixed(3)} SOL
              </div>
            </div>

            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <TrendingUp size={16} />
                <span className="text-sm">Win Rate</span>
              </div>
              <div className="text-2xl font-bold">
                {winRate}%
              </div>
            </div>

            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Calendar size={16} />
                <span className="text-sm">Member Since</span>
              </div>
              <div className="text-sm font-bold">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                }) : 'New Player'}
              </div>
            </div>
          </div>
        </div>

        {/* Referral Section */}
        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 border border-gray-700 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold mb-1">Referral Program</h2>
              <p className="text-gray-400 text-sm">
                Earn 5% of your referrals' winnings! Share your code:
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Referral Earnings</div>
              <div className="text-2xl font-bold text-green-400">
                {parseFloat(profile?.referral_earnings || 0).toFixed(3)} SOL
              </div>
            </div>
          </div>
          
          {generatingCode ? (
            <div className="text-center py-4 text-gray-400">
              Generating your referral code...
            </div>
          ) : referralCode ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={`https://tossbox.fun?ref=${referralCode}`}
                  readOnly
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 font-mono text-sm"
                />
                <button
                  onClick={copyReferralLink}
                  className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-bold transition-all flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check size={20} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={20} />
                      Copy
                    </>
                  )}
                </button>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>Your code:</span>
                <span className="bg-purple-500/20 border border-purple-500 px-3 py-1 rounded font-bold text-purple-300">
                  {referralCode}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400">
              Failed to generate referral code. Please refresh.
            </div>
          )}
        </div>

        {/* Recent Bets */}
        <div className="bg-gray-800/50 backdrop-blur rounded-lg border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold">Recent Bets</h2>
          </div>

          <div className="divide-y divide-gray-700">
            {recentBets.length > 0 ? (
              recentBets.map((bet) => (
                <div key={bet.id} className="p-4 hover:bg-gray-700/30 transition-all">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg">{bet.crypto || bet.rounds?.crypto || 'N/A'}</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          bet.prediction === 'up' 
                            ? 'bg-green-500/20 text-green-400 border border-green-500' 
                            : 'bg-red-500/20 text-red-400 border border-red-500'
                        }`}>
                          {bet.prediction.toUpperCase()}
                        </span>
                        <span className="text-gray-400 text-sm bg-gray-700 px-2 py-1 rounded">
                          {bet.multiplier}x
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          bet.status === 'won' ? 'bg-green-500/20 text-green-400' :
                          bet.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {bet.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {new Date(bet.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-gray-400 text-sm mb-1">
                        Stake: <span className="font-bold text-white">{parseFloat(bet.stake_amount).toFixed(3)} SOL</span>
                      </div>
                      {bet.status === 'won' && (
                        <div className="text-green-400 font-bold text-lg">
                          +{parseFloat(bet.actual_win).toFixed(3)} SOL
                        </div>
                      )}
                      {bet.status === 'lost' && (
                        <div className="text-red-400 font-bold">
                          Lost
                        </div>
                      )}
                      {bet.status === 'pending' && (
                        <div className="text-yellow-400 font-bold">
                          Pending...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <div className="text-6xl mb-4">🎲</div>
                <div className="text-xl font-bold mb-2">No bets yet!</div>
                <p className="text-gray-400 mb-6">Start playing to see your betting history</p>
                <Link 
                  href="/"
                  className="inline-block bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-bold transition-all"
                >
                  Place Your First Bet
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Performance Summary */}
        {recentBets.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700 text-center">
              <div className="text-3xl font-bold text-purple-400">
                {recentBets.length}
              </div>
              <div className="text-sm text-gray-400">Total Bets</div>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700 text-center">
              <div className="text-3xl font-bold text-green-400">
                {recentBets.filter(b => b.status === 'won').length}
              </div>
              <div className="text-sm text-gray-400">Wins</div>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700 text-center">
              <div className="text-3xl font-bold text-red-400">
                {recentBets.filter(b => b.status === 'lost').length}
              </div>
              <div className="text-sm text-gray-400">Losses</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
