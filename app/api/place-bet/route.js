import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyTransaction } from '@/lib/solana';

export async function POST(request) {
  try {
    const body = await request.json();
    const { walletAddress, prediction, multiplier, stakeAmount, txSignature, crypto } = body;

    // Verify the transaction
    const isValid = await verifyTransaction(txSignature, stakeAmount);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid transaction' },
        { status: 400 }
      );
    }

    // Get or create user
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (!user) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({ wallet_address: walletAddress })
        .select()
        .single();
      user = newUser;
    }

    // Get or create active round
    let { data: activeRound } = await supabase
      .from('rounds')
      .select('*')
      .eq('status', 'active')
      .eq('crypto', crypto)
      .single();

    if (!activeRound) {
      // Fetch current price
      const priceRes = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL}/api/get-price?crypto=${crypto}`
      );
      const priceData = await priceRes.json();

      const { data: newRound } = await supabase
        .from('rounds')
        .insert({
          crypto,
          start_price: priceData.price,
          start_time: new Date().toISOString(),
          status: 'active'
        })
        .select()
        .single();
      
      activeRound = newRound;
    }

    // Create bet
    const potentialWin = stakeAmount * multiplier * 0.95; // 5% fee
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .insert({
        round_id: activeRound.id,
        user_id: user.id,
        wallet_address: walletAddress,
        prediction,
        multiplier,
        stake_amount: stakeAmount,
        potential_win: potentialWin,
        tx_signature: txSignature
      })
      .select()
      .single();

    if (betError) throw betError;

    // Record transaction
    await supabase.from('transactions').insert({
      user_id: user.id,
      wallet_address: walletAddress,
      type: 'deposit',
      amount: stakeAmount,
      tx_signature: txSignature,
      status: 'confirmed'
    });

    // Update user stats
    await supabase
      .from('users')
      .update({
        total_wagered: user.total_wagered + stakeAmount
      })
      .eq('id', user.id);

    return NextResponse.json({ 
      success: true, 
      bet,
      roundId: activeRound.id 
    });

  } catch (error) {
    console.error('Place bet error:', error);
    return NextResponse.json(
      { error: 'Failed to place bet' },
      { status: 500 }
    );
  }
}
