import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendPayout } from '@/lib/solana';

export async function GET(request) {
  try {
    // Verify cron secret (Vercel cron authentication)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find rounds that should be ended (60+ seconds old and still active)
    const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
    
    const { data: roundsToEnd } = await supabase
      .from('rounds')
      .select('*')
      .eq('status', 'active')
      .lte('start_time', sixtySecondsAgo);

    if (!roundsToEnd || roundsToEnd.length === 0) {
      return NextResponse.json({ message: 'No rounds to end' });
    }

    const results = [];

    for (const round of roundsToEnd) {
      try {
        // Fetch end price
        const priceRes = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbol=${round.crypto}USDT`
        );
        const priceData = await priceRes.json();
        const endPrice = parseFloat(priceData.price);

        // Update round
        await supabase
          .from('rounds')
          .update({
            end_price: endPrice,
            end_time: new Date().toISOString(),
            status: 'ended'
          })
          .eq('id', round.id);

        // Get all bets for this round
        const { data: bets } = await supabase
          .from('bets')
          .select('*')
          .eq('round_id', round.id);

        if (!bets || bets.length === 0) {
          results.push({ roundId: round.id, status: 'no_bets' });
          continue;
        }

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
          const winShare = totalWinnerWeight > 0 ? (weight / totalWinnerWeight) * payoutPool : 0;
          const totalPayout = winShare + parseFloat(winner.stake_amount);

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

            if (user) {
              await supabase
                .from('users')
                .update({
                  total_won: (user.total_won || 0) + winShare,
                  win_streak: (user.win_streak || 0) + 1
                })
                .eq('id', winner.user_id);
            }

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

          await supabase
            .from('users')
            .update({ win_streak: 0 })
            .eq('id', loser.user_id);
        }

        results.push({
          roundId: round.id,
          crypto: round.crypto,
          startPrice: round.start_price,
          endPrice,
          direction: priceWentUp ? 'up' : 'down',
          winners: winners.length,
          losers: losers.length,
          payoutPool,
          platformFee
        });

      } catch (error) {
        console.error(`Failed to end round ${round.id}:`, error);
        results.push({ roundId: round.id, error: error.message });
      }
    }

    return NextResponse.json({ 
      success: true, 
      roundsProcessed: results.length,
      results 
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Cron job failed', details: error.message },
      { status: 500 }
    );
  }
}
