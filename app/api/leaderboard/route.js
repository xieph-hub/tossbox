import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';

    let query = supabase
      .from('users')
      .select('wallet_address, total_won, total_wagered, win_streak');

    // Filter by time period if needed
    if (period === 'week' || period === 'day') {
      const daysAgo = period === 'week' ? 7 : 1;
      const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      
      // For time-based leaderboards, we'd need to track wins by date
      // For now, let's use all-time data
    }

    const { data: users, error } = await query
      .order('total_won', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Calculate win rate
    const leaderboard = users.map(user => ({
      ...user,
      win_rate: user.total_wagered > 0 
        ? Math.round((user.total_won / user.total_wagered) * 100)
        : 0
    }));

    return NextResponse.json({ leaderboard });

  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
