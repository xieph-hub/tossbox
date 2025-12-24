import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPayout } from "@/lib/solana";
import { getPythSnapshot } from "@/lib/prices/getPythSnapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: any) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();

    const { data: roundsToEnd, error: roundsErr } = await supabaseAdmin
      .from("rounds")
      .select("*")
      .eq("status", "active")
      .lte("start_time", sixtySecondsAgo);

    if (roundsErr) throw roundsErr;

    if (!roundsToEnd || roundsToEnd.length === 0) {
      return NextResponse.json({ message: "No rounds to end" });
    }

    const results: any[] = [];

    for (const round of roundsToEnd) {
      try {
        // 1) Acquire lock: flip active -> settling (single-writer)
        const { data: lockedRows, error: lockErr } = await supabaseAdmin
          .from("rounds")
          .update({ status: "settling" })
          .eq("id", round.id)
          .eq("status", "active")
          .select("id");

        if (lockErr) throw lockErr;

        // If no row updated, someone else is settling it already
        if (!lockedRows || lockedRows.length === 0) {
          results.push({ roundId: round.id, skipped: "already_settling_or_ended" });
          continue;
        }

        // 2) Canonical end snapshot from PYTH
        const snap = await getPythSnapshot(round.crypto);
        const endPrice = snap.price;

        // 3) End round (store pyth metadata)
        const { error: endErr } = await supabaseAdmin
          .from("rounds")
          .update({
            end_price: endPrice,
            end_time: new Date().toISOString(),
            end_publish_time: snap.publish_time,
            end_conf: snap.conf,
            end_source: snap.source,
            settled_at: new Date().toISOString(),
            status: "ended",
          })
          .eq("id", round.id);

        if (endErr) throw endErr;

        // 4) Fetch bets
        const { data: bets, error: betsErr } = await supabaseAdmin
          .from("bets")
          .select("*")
          .eq("round_id", round.id);

        if (betsErr) throw betsErr;

        if (!bets || bets.length === 0) {
          results.push({ roundId: round.id, status: "ended_no_bets", endPrice });
          continue;
        }

        const priceWentUp = endPrice > num(round.start_price);

        const winners = bets.filter((b: any) =>
          (b.prediction === "up" && priceWentUp) ||
          (b.prediction === "down" && !priceWentUp)
        );
        const losers = bets.filter((b: any) => !winners.includes(b));

        const totalLoserStakes = losers.reduce((s: number, b: any) => s + num(b.stake_amount), 0);
        const totalWinnerWeight = winners.reduce(
          (s: number, b: any) => s + num(b.stake_amount) * num(b.multiplier),
          0
        );

        const platformFee = totalLoserStakes * 0.05;
        const payoutPool = totalLoserStakes - platformFee;

        // 5) Pay winners (idempotency: only pay pending bets)
        for (const winner of winners) {
          // Skip if already processed
          if (winner.status === "won") continue;

          const stake = num(winner.stake_amount);
          const weight = stake * num(winner.multiplier);
          const winShare = totalWinnerWeight > 0 ? (weight / totalWinnerWeight) * payoutPool : 0;
          const totalPayout = winShare + stake;

          try {
            const txSignature = await sendPayout(winner.wallet_address, totalPayout);

            await supabaseAdmin
              .from("bets")
              .update({ status: "won", actual_win: winShare })
              .eq("id", winner.id);

            await supabaseAdmin.from("transactions").insert({
              user_id: winner.user_id,
              wallet_address: winner.wallet_address,
              type: "payout",
              amount: totalPayout,
              tx_signature: txSignature,
              status: "confirmed",
            });

            // Update user stats (safe increments)
            const { data: user } = await supabaseAdmin
              .from("users")
              .select("total_won, win_streak")
              .eq("id", winner.user_id)
              .maybeSingle();

            if (user) {
              await supabaseAdmin
                .from("users")
                .update({
                  total_won: num(user.total_won) + winShare,
                  win_streak: num(user.win_streak) + 1,
                })
                .eq("id", winner.user_id);
            }
          } catch (e) {
            console.error(`Payout failed for ${winner.wallet_address}:`, e);
            // Consider setting bet status to 'payout_failed' to retry later
          }
        }

        // 6) Mark losers
        for (const loser of losers) {
          if (loser.status === "lost") continue;

          await supabaseAdmin.from("bets").update({ status: "lost" }).eq("id", loser.id);
          await supabaseAdmin.from("users").update({ win_streak: 0 }).eq("id", loser.user_id);
        }

        results.push({
          roundId: round.id,
          crypto: round.crypto,
          startPrice: num(round.start_price),
          endPrice,
          direction: priceWentUp ? "up" : "down",
          winners: winners.length,
          losers: losers.length,
          payoutPool,
          platformFee,
          endPublishTime: snap.publish_time,
          endConf: snap.conf ?? null,
          source: "pyth",
        });
      } catch (e: any) {
        console.error(`Failed to end round ${round.id}:`, e?.message || e);
        // Try to release lock if it failed mid-way (optional)
        await supabaseAdmin
          .from("rounds")
          .update({ status: "active" })
          .eq("id", round.id)
          .eq("status", "settling");

        results.push({ roundId: round.id, error: e?.message || "unknown" });
      }
    }

    return NextResponse.json({
      success: true,
      roundsProcessed: results.length,
      results,
    });
  } catch (error: any) {
    console.error("Cron job error:", error?.message || error);
    return NextResponse.json(
      { error: "Cron job failed", details: error?.message || "unknown" },
      { status: 500 }
    );
  }
}
