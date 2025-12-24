import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Get active round
    const { data: activeRound } = await supabase
      .from('rounds')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get total pot for active round
    const { data: bets } = await supabase
      .from('bets')
      .select('stake_amount')
      .eq('round_id', activeRound?.id || '');

    const totalPot = bets?.reduce((sum, bet) => sum + parseFloat(bet.stake_amount), 0) || 0;

    // Get player count
    const { count: playerCount } = await supabase
      .from('bets')
      .select('*', { count: 'exact', head: true })
      .eq('round_id', activeRound?.id || '');

    // Get recent winners
    const { data: recentWinners } = await supabase
      .from('bets')
      .select('wallet_address, actual_win, multiplier')
      .eq('status', 'won')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      activeRound,
      totalPot,
      playerCount: playerCount || 0,
      recentWinners: recentWinners || []
    });
  } catch (error) {
    console.error('Get game state error:', error);
    return NextResponse.json(
      { error: 'Failed to get game state' },
      { status: 500 }
    );
  }
}
