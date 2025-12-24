import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTransaction } from "@/lib/solana";
import { getPythSnapshot } from "@/lib/prices/getPythSnapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asNumber(v: any) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : NaN;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const walletAddress = (body.walletAddress || "").toString().trim();
    const prediction = (body.prediction || "").toString().trim();
    const multiplier = Number(body.multiplier);
    const stakeAmount = asNumber(body.stakeAmount);
    const txSignature = (body.txSignature || "").toString().trim();
    const crypto = (body.crypto || "BTC").toString().trim().toUpperCase();

    // Basic validation
    if (!walletAddress || !txSignature) {
      return NextResponse.json({ error: "walletAddress and txSignature required" }, { status: 400 });
    }
    if (!["up", "down"].includes(prediction)) {
      return NextResponse.json({ error: "prediction must be 'up' or 'down'" }, { status: 400 });
    }
    if (![1, 2, 5, 10].includes(multiplier)) {
      return NextResponse.json({ error: "multiplier must be one of 1,2,5,10" }, { status: 400 });
    }
    if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) {
      return NextResponse.json({ error: "stakeAmount must be > 0" }, { status: 400 });
    }

    // Idempotency: if tx already recorded as a bet, return success
    // (requires unique index on tx_signature recommended earlier)
    const { data: existingBet } = await supabaseAdmin
      .from("bets")
      .select("id, round_id, wallet_address, crypto:rounds(crypto)")
      .eq("tx_signature", txSignature)
      .maybeSingle();

    if (existingBet?.id) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        betId: existingBet.id,
        roundId: existingBet.round_id,
      });
    }

    // Verify on-chain transfer (make sure this checks amount + recipient treasury wallet)
    const isValid = await verifyTransaction(txSignature, stakeAmount);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
    }

    // Get or create user (server-owned)
    let { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (userErr) throw userErr;

    if (!user) {
      const { data: newUser, error: newUserErr } = await supabaseAdmin
        .from("users")
        .insert({ wallet_address: walletAddress })
        .select()
        .single();

      if (newUserErr) throw newUserErr;
      user = newUser;
    }

    // Get active round for crypto (per-asset round)
    let { data: activeRound, error: roundErr } = await supabaseAdmin
      .from("rounds")
      .select("*")
      .eq("status", "active")
      .eq("crypto", crypto)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundErr) throw roundErr;

    // If no active round, create one using PYTH snapshot (canonical)
    if (!activeRound) {
      const snap = await getPythSnapshot(crypto);

      // NOTE: With the unique index (one active round per crypto),
      // two concurrent requests may race; one insert will fail and we retry fetch.
      const { data: newRound, error: newRoundErr } = await supabaseAdmin
        .from("rounds")
        .insert({
          crypto: snap.crypto,
          start_price: snap.price,
          start_time: snap.fetched_at,
          status: "active",
          pyth_feed_id: snap.pyth_feed_id,
          start_publish_time: snap.publish_time,
          start_conf: snap.conf,
          start_source: snap.source,
        })
        .select()
        .single();

      if (newRoundErr) {
        // If insert failed due to unique active round constraint, refetch
        const { data: retryRound, error: retryErr } = await supabaseAdmin
          .from("rounds")
          .select("*")
          .eq("status", "active")
          .eq("crypto", crypto)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (retryErr) throw retryErr;
        if (!retryRound) throw newRoundErr;

        activeRound = retryRound;
      } else {
        activeRound = newRound;
      }
    }

    // Optional: enforce "betting window" if you want (e.g., only first 55s)
    // You can compute elapsed via activeRound.start_time and reject late bets.

    // Create bet (5% fee)
    const potentialWin = stakeAmount * multiplier * 0.95;

    const { data: bet, error: betError } = await supabaseAdmin
      .from("bets")
      .insert({
        round_id: activeRound.id,
        user_id: user.id,
        wallet_address: walletAddress,
        prediction,
        multiplier,
        stake_amount: stakeAmount,
        potential_win: potentialWin,
        tx_signature: txSignature,
        status: "pending",
      })
      .select()
      .single();

    if (betError) throw betError;

    // Record transaction (idempotency on tx_signature recommended in table)
    const { error: txErr } = await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      wallet_address: walletAddress,
      type: "deposit",
      amount: stakeAmount,
      tx_signature: txSignature,
      status: "confirmed",
    });

    if (txErr) {
      // Not fatal to bet placement, but good to log
      console.error("transactions insert failed:", txErr);
    }

    // Update user stats
    const totalWagered = asNumber(user.total_wagered) || 0;
    await supabaseAdmin
      .from("users")
      .update({ total_wagered: totalWagered + stakeAmount })
      .eq("id", user.id);

    return NextResponse.json({
      success: true,
      bet,
      roundId: activeRound.id,
    });
  } catch (error: any) {
    console.error("Place bet error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to place bet", message: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
