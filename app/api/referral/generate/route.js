import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST(request) {
  try {
    const { walletAddress } = await request.json();

    // Check if user already has a referral code
    const { data: existingUser } = await supabase
      .from('users')
      .select('referral_code')
      .eq('wallet_address', walletAddress)
      .single();

    if (existingUser?.referral_code) {
      return NextResponse.json({ referralCode: existingUser.referral_code });
    }

    // Generate new referral code
    let referralCode;
    let isUnique = false;
    
    while (!isUnique) {
      referralCode = generateReferralCode();
      const { data: existing } = await supabase
        .from('users')
        .select('referral_code')
        .eq('referral_code', referralCode)
        .single();
      
      if (!existing) isUnique = true;
    }

    // Update user with referral code
    await supabase
      .from('users')
      .update({ referral_code: referralCode })
      .eq('wallet_address', walletAddress);

    return NextResponse.json({ referralCode });

  } catch (error) {
    console.error('Generate referral error:', error);
    return NextResponse.json(
      { error: 'Failed to generate referral code' },
      { status: 500 }
    );
  }
}
