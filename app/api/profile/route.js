import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', wallet)
      .single();

    // Get recent bets with round info
    const { data: recentBets } = await supabase
      .from('bets')
      .select(`
        *,
        rounds!inner(crypto, start_price, end_price)
      `)
      .eq('wallet_address', wallet)
      .order('created_at', { ascending: false })
      .limit(20);

    // Format bets to include crypto from rounds
    const formattedBets = recentBets?.map(bet => ({
      ...bet,
      crypto: bet.rounds.crypto
    })) || [];

    return NextResponse.json({ 
      profile: profile || { wallet_address: wallet, total_wagered: 0, total_won: 0, win_streak: 0 },
      recentBets: formattedBets
    });

  } catch (error) {
    console.error('Profile error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
