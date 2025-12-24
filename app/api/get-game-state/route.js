import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const crypto = (searchParams.get("crypto") || "BTC").toUpperCase();

    // Active round for THIS crypto
    const { data: activeRound, error: roundErr } = await supabase
      .from("rounds")
      .select("*")
      .eq("status", "active")
      .eq("crypto", crypto)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundErr) throw roundErr;

    const roundId = activeRound?.id;

    // Total pot for THIS round
    let totalPot = 0;
    let playerCount = 0;

    if (roundId) {
      const { data: bets, error: betsErr } = await supabase
        .from("bets")
        .select("stake_amount")
        .eq("round_id", roundId);

      if (betsErr) throw betsErr;

      totalPot =
        bets?.reduce((sum, b) => sum + Number.parseFloat(b.stake_amount), 0) || 0;

      const { count, error: countErr } = await supabase
        .from("bets")
        .select("*", { count: "exact", head: true })
        .eq("round_id", roundId);

      if (countErr) throw countErr;

      playerCount = count || 0;
    }

    // Recent winners (global or per crypto — your choice; here: per crypto)
    const { data: recentWinners, error: winnersErr } = await supabase
      .from("bets")
      .select("wallet_address, actual_win, multiplier, crypto")
      .eq("status", "won")
      .eq("crypto", crypto)
      .order("created_at", { ascending: false })
      .limit(10);

    if (winnersErr) throw winnersErr;

    return NextResponse.json({
      crypto,
      activeRound,
      totalPot,
      playerCount,
      recentWinners: recentWinners || [],
    });
  } catch (error: any) {
    console.error("Get game state error:", error?.message || error);
    return NextResponse.json({ error: "Failed to get game state" }, { status: 500 });
  }
}
