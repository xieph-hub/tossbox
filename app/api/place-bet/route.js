// app/api/place-bet/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // service-role client (server-only)
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

    // ---- validation
    if (!walletAddress || !txSignature) {
      return NextResponse.json(
        { error: "walletAddress and txSignature required" },
        { status: 400 }
      );
    }
    if (!["up", "down"].includes(prediction)) {
      return NextResponse.json(
        { error: "prediction must be 'up' or 'down'" },
        { status: 400 }
      );
    }
    if (![1, 2, 5, 10].includes(multiplier)) {
      return NextResponse.json(
        { error: "multiplier must be one of 1,2,5,10" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) {
      return NextResponse.json(
        { error: "stakeAmount must be > 0" },
        { status: 400 }
      );
    }

    // ---- idempotency: tx_signature replay guard
    // Requires UNIQUE index on bets(tx_signature) WHERE tx_signature IS NOT NULL
    const { data: existingBet, error: existingErr } = await supabaseAdmin
      .from("bets")
      .select("id, round_id, wallet_address")
      .eq("tx_signature", txSignature)
      .maybeSingle();

    if (existingErr) throw existingErr;

    if (existingBet?.id) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        betId: existingBet.id,
        roundId: existingBet.round_id,
      });
    }

    // ---- verify on-chain transfer (ensure this checks recipient treasury + amount)
    const isValid = await verifyTransaction(txSignature, stakeAmount);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
    }

    // ---- get or create user
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

    // ---- fetch active round for this crypto
    let { data: activeRound, error: roundErr } = await supabaseAdmin
      .from("rounds")
      .select("*")
      .eq("status", "active")
      .eq("crypto", crypto)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundErr) throw roundErr;

    // ---- create round with PYTH snapshot (canonical) if absent
    if (!activeRound) {
      const snap = await getPythSnapshot(crypto);

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
        // Race-safe: someone else created the active round first
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

    // ---- enforce one bet per wallet per round
    // Requires UNIQUE index on (round_id, wallet_address)
    const { data: existingRoundBet, error: roundBetErr } = await supabaseAdmin
      .from("bets")
      .select("id")
      .eq("round_id", activeRound.id)
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (roundBetErr) throw roundBetErr;

    if (existingRoundBet?.id) {
      return NextResponse.json(
        { error: "You already placed a bet for this round." },
        { status: 409 }
      );
    }

    // ---- create bet
    const potentialWin = stakeAmount * multiplier * 0.95; // 5% fee

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

    // ---- record transaction (deposit)
    await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      wallet_address: walletAddress,
      type: "deposit",
      amount: stakeAmount,
      tx_signature: txSignature,
      status: "confirmed",
    });

    // ---- update user stats
    const totalWagered =
      Number.isFinite(asNumber(user.total_wagered)) ? asNumber(user.total_wagered) : 0;

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
