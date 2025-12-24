// app/api/get-game-state/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: any) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const crypto = (searchParams.get("crypto") || "BTC").toUpperCase().trim();

    // 1) Active round for THIS crypto (one active round per crypto)
    const { data: activeRound, error: roundErr } = await supabase
      .from("rounds")
      .select("*")
      .eq("status", "active")
      .eq("crypto", crypto)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundErr) throw roundErr;

    const roundId = activeRound?.id || null;

    // Defaults when no active round exists yet
    if (!roundId) {
      // Recent winners for THIS crypto (join through rounds because bets has no crypto column)
      const { data: recentWinners, error: winnersErr } = await supabase
        .from("bets")
        .select("wallet_address, actual_win, multiplier, rounds!inner(crypto)")
        .eq("status", "won")
        .eq("rounds.crypto", crypto)
        .order("created_at", { ascending: false })
        .limit(10);

      if (winnersErr) throw winnersErr;

      const winnersNormalized =
        (recentWinners || []).map((w: any) => ({
          wallet_address: w.wallet_address,
          actual_win: num(w.actual_win),
          multiplier: w.multiplier,
        })) || [];

      return NextResponse.json({
        crypto,
        activeRound: null,
        totalPot: 0,
        playerCount: 0,
        recentWinners: winnersNormalized,
      });
    }

    // 2) Total pot for THIS round
    // NOTE: numeric often returns as string from Postgres; we normalize.
    const { data: betAmounts, error: betsErr } = await supabase
      .from("bets")
      .select("stake_amount")
      .eq("round_id", roundId);

    if (betsErr) throw betsErr;

    const totalPot =
      betAmounts?.reduce((sum: number, b: any) => sum + num(b.stake_amount), 0) ||
      0;

    // 3) Player count for THIS round
    // With "one bet per wallet per round", this equals number of bets.
    const { count: playerCount, error: countErr } = await supabase
      .from("bets")
      .select("*", { count: "exact", head: true })
      .eq("round_id", roundId);

    if (countErr) throw countErr;

    // 4) Recent winners for THIS crypto (join through rounds)
    const { data: recentWinners, error: winnersErr } = await supabase
      .from("bets")
      .select("wallet_address, actual_win, multiplier, rounds!inner(crypto)")
      .eq("status", "won")
      .eq("rounds.crypto", crypto)
      .order("created_at", { ascending: false })
      .limit(10);

    if (winnersErr) throw winnersErr;

    const winnersNormalized =
      (recentWinners || []).map((w: any) => ({
        wallet_address: w.wallet_address,
        actual_win: num(w.actual_win),
        multiplier: w.multiplier,
      })) || [];

    return NextResponse.json({
      crypto,
      activeRound,
      totalPot,
      playerCount: playerCount || 0,
      recentWinners: winnersNormalized,
    });
  } catch (error: any) {
    console.error("Get game state error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to get game state", message: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
