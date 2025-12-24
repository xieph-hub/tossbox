import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendPayout } from '@/lib/solana';

export async function POST(request) {
  try {
    const { adminSecret, roundId } = await request.json();

    // Verify admin
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get round
    const { data: round } = await supabase
      .from('rounds')
      .select('*')
      .eq('id', roundId)
      .single();

    if (!round || round.status !== 'active') {
      return NextResponse.json({ error: 'Round not found or already ended' }, { status: 400 });
    }

    // Fetch end price
    const priceRes = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/get-price?crypto=${round.crypto}`
    );
    const priceData = await priceRes.json();
    const endPrice = priceData.price;

    // Update round
    await supabase
      .from('rounds')
      .update({
        end_price: endPrice,
        end_time: new Date().toISOString(),
        status: 'ended'
      })
      .eq('id', roundId);

    // Get all bets for this round
    const { data: bets } = await supabase
      .from('bets')
      .select('*')
      .eq('round_id', roundId);

    const priceWentUp = endPrice > round.start_price;
    const winners = bets.filter(bet => 
      (bet.prediction === 'up' && priceWentUp) || 
      (bet.prediction === 'down' && !priceWentUp)
    );

    const losers = bets.filter(bet => 
      (bet.prediction === 'up' && !priceWentUp) || 
      (bet.prediction === 'down' && priceWentUp)
    );

    // Calculate payouts
    const totalLoserStakes = losers.reduce((sum, bet) => sum + parseFloat(bet.stake_amount), 0);
    const totalWinnerWeight = winners.reduce((sum, bet) => sum + (parseFloat(bet.stake_amount) * bet.multiplier), 0);
    
    const platformFee = totalLoserStakes * 0.05;
    const payoutPool = totalLoserStakes - platformFee;

    // Process payouts
    for (const winner of winners) {
      const weight = parseFloat(winner.stake_amount) * winner.multiplier;
      const winShare = (weight / totalWinnerWeight) * payoutPool;
      const totalPayout = winShare + parseFloat(winner.stake_amount); // Return stake + winnings

      try {
        const txSignature = await sendPayout(winner.wallet_address, totalPayout);

        await supabase
          .from('bets')
          .update({
            status: 'won',
            actual_win: winShare
          })
          .eq('id', winner.id);

        await supabase.from('transactions').insert({
          user_id: winner.user_id,
          wallet_address: winner.wallet_address,
          type: 'payout',
          amount: totalPayout,
          tx_signature: txSignature,
          status: 'confirmed'
        });

        // Update user stats
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('id', winner.user_id)
          .single();

        await supabase
          .from('users')
          .update({
            total_won: user.total_won + winShare,
            win_streak: user.win_streak + 1
          })
          .eq('id', winner.user_id);

      } catch (error) {
        console.error(`Payout failed for ${winner.wallet_address}:`, error);
      }
    }

    // Mark losers
    for (const loser of losers) {
      await supabase
        .from('bets')
        .update({ status: 'lost' })
        .eq('id', loser.id);

      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', loser.user_id)
        .single();

      await supabase
        .from('users')
        .update({ win_streak: 0 })
        .eq('id', loser.user_id);
    }

    return NextResponse.json({
      success: true,
      endPrice,
      winners: winners.length,
      losers: losers.length,
      payoutPool,
      platformFee
    });

  } catch (error) {
    console.error('End round error:', error);
    return NextResponse.json(
      { error: 'Failed to end round' },
      { status: 500 }
    );
  }
}
