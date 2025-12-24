import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { walletAddress, referralCode } = await request.json();

    // Find referrer
    const { data: referrer } = await supabase
      .from('users')
      .select('*')
      .eq('referral_code', referralCode)
      .single();

    if (!referrer) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
    }

    if (referrer.wallet_address === walletAddress) {
      return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 });
    }

    // Check if already referred
    const { data: existing } = await supabase
      .from('users')
      .select('referred_by')
      .eq('wallet_address', walletAddress)
      .single();

    if (existing?.referred_by) {
      return NextResponse.json({ error: 'Already used a referral code' }, { status: 400 });
    }

    // Create referral record
    await supabase.from('referrals').insert({
      referrer_wallet: referrer.wallet_address,
      referred_wallet: walletAddress,
      referral_code: referralCode,
      status: 'active'
    });

    // Update referred user
    await supabase
      .from('users')
      .update({ referred_by: referrer.wallet_address })
      .eq('wallet_address', walletAddress);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Claim referral error:', error);
    return NextResponse.json(
      { error: 'Failed to claim referral' },
      { status: 500 }
    );
  }
}
