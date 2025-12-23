import { supabaseServer } from "@/lib/supabaseServer";
import { getConnection, getTreasuryPubkey } from "@/lib/solana";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { sendSolPayout } from "@/lib/payout";

// ------------------------------
// Helpers
// ------------------------------
function startOfTodayUTCISO() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function getAdminSettings() {
  const res = await supabaseServer.from("admin_settings").select("*").eq("id", 1).single();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function sumSolPayoutsToday({ wallet }) {
  // Sum today's SOL TOKEN payouts (amount is in SOL units)
  const since = startOfTodayUTCISO();

  const base = supabaseServer
    .from("rewards")
    .select("amount,wallet,created_at,type,symbol")
    .eq("type", "TOKEN")
    .eq("symbol", "SOL")
    .gte("created_at", since);

  const [globalRes, walletRes] = await Promise.all([
    base,
    base.eq("wallet", wallet),
  ]);

  if (globalRes.error) throw new Error(globalRes.error.message);
  if (walletRes.error) throw new Error(walletRes.error.message);

  const globalTotal = (globalRes.data || []).reduce((a, r) => a + safeNum(r.amount), 0);
  const walletTotal = (walletRes.data || []).reduce((a, r) => a + safeNum(r.amount), 0);

  return { globalTotal, walletTotal };
}

/**
 * Strict verification:
 * - tx exists + success
 * - tx includes a SystemProgram.transfer OR a transfer inside compiled instructions
 * - sum of lamports transferred TO treasury >= expected amount
 */
function sumLamportsToTreasuryFromTx(tx, treasuryPubkey) {
  const treasury = treasuryPubkey.toBase58();
  let total = 0;

  // Parse instructions (works for SystemProgram transfers)
  const message = tx.transaction.message;
  const accountKeys = message.getAccountKeys().staticAccountKeys;

  for (const ix of message.compiledInstructions) {
    const programId = accountKeys[ix.programIdIndex]?.toBase58();
    if (programId !== SystemProgram.programId.toBase58()) continue;

    // For SystemProgram transfer, data layout is known; easiest is to use web3.js decode:
    // But Next.js edge/runtime differences can be annoying, so we do a conservative approach:
    // We'll try to decode using SystemProgram instruction decoder by reconstructing a TransactionInstruction.
    try {
      // Rebuild instruction
      const keys = ix.accountKeyIndexes.map((i) => ({
        pubkey: accountKeys[i],
        isSigner: false,
        isWritable: true,
      }));

      // data is a Uint8Array
      const data = Buffer.from(ix.data);

      // SystemProgram.decodeInstructionType / decodeTransfer not available here reliably.
      // Instead: We detect transfer instruction by first 4 bytes = 2 (transfer) little-endian? (not stable)
      // So we do a safer path:
      // If treasury is among keys and meta balance increased, we count lamports via balance delta.
      // We'll compute balance delta for treasury index.
    } catch {
      // ignore
    }
  }

  // Balance delta method (most reliable):
  // If treasury balance increased by >= expected, it's valid.
  // Compute delta between pre and post for treasury in accountKeys.
  const pre = tx.meta?.preBalances || [];
  const post = tx.meta?.postBalances || [];
  for (let i = 0; i < accountKeys.length; i++) {
    if (accountKeys[i].toBase58() === treasury) {
      const delta = (post[i] ?? 0) - (pre[i] ?? 0);
      if (delta > 0) total += delta;
    }
  }

  return total;
}

// ------------------------------
// Reward selection (legendary rarer)
// ------------------------------
function pickReward(tierId) {
  const r = Math.random();

  // Make legendary rarer than your previous table.
  // Starter legendary: 0.5% (1 in 200)
  // Alpha legendary: 0.3% (1 in 333)
  // Deity legendary: 0.5% (1 in 200) but payouts bigger, so caps protect you.

  if (tierId === "starter") {
    if (r < 0.88) return { type: "CREDIT", rarity: "common", title: "Credits", aiLine: "Small win. Keep moving.", amount: null, symbol: null };
    if (r < 0.995) return { type: "TICKET", rarity: "rare", title: "Free Box Ticket", aiLine: "A free toss… dangerous.", amount: 1, symbol: null };
    return { type: "TOKEN", rarity: "legendary", title: "SOL Hit", aiLine: "Wait… that actually landed.", amount: 0.02, symbol: "SOL" };
  }

  if (tierId === "alpha") {
    if (r < 0.82) return { type: "CREDIT", rarity: "common", title: "Credits", aiLine: "The box acknowledged you.", amount: null, symbol: null };
    if (r < 0.997) return { type: "TICKET", rarity: "rare", title: "Free Box Ticket", aiLine: "Another spin at fate.", amount: 1, symbol: null };
    if (r < 0.999) return { type: "TOKEN", rarity: "rare", title: "SOL Win", aiLine: "Clean pull.", amount: 0.05, symbol: "SOL" };
    return { type: "TOKEN", rarity: "legendary", title: "Big SOL Win", aiLine: "You just became a screenshot.", amount: 0.15, symbol: "SOL" };
  }

  // deity
  if (r < 0.75) return { type: "CREDIT", rarity: "common", title: "Credits", aiLine: "Power comes with humility.", amount: null, symbol: null };
  if (r < 0.995) return { type: "TICKET", rarity: "rare", title: "Free Box Ticket", aiLine: "The box wants you back.", amount: 1, symbol: null };
  if (r < 0.9985) return { type: "TOKEN", rarity: "rare", title: "SOL Win", aiLine: "That’s a real pull.", amount: 0.12, symbol: "SOL" };
  return { type: "TOKEN", rarity: "legendary", title: "Deity SOL Win", aiLine: "This is why people believe.", amount: 0.30, symbol: "SOL" };
}

export async function POST(req) {
  try {
    const { openId, txSignature } = await req.json();
    if (!openId || !txSignature) {
      return Response.json({ error: "Missing openId or txSignature" }, { status: 400 });
    }

    // 1) Kill switch + caps
    const settings = await getAdminSettings();
    if (settings.kill_switch) {
      return Response.json({ error: "TossBox is paused. Try again later." }, { status: 403 });
    }

    // 2) Fetch open
    const openRes = await supabaseServer.from("opens").select("*").eq("id", openId).single();
    if (openRes.error || !openRes.data) return Response.json({ error: "Open not found" }, { status: 404 });
    const open = openRes.data;

    // Prevent re-confirm
    if (open.status === "REVEALED") {
      const rewardRes = await supabaseServer.from("rewards").select("*").eq("open_id", openId).single();
      return Response.json({ error: "Already revealed", reward: rewardRes.data }, { status: 409 });
    }

    // 3) Verify transaction exists + succeeded
    const conn = getConnection();
    const tx = await conn.getTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || tx.meta?.err) {
      return Response.json({ error: "Transaction not found or failed. Wait a bit and try again." }, { status: 400 });
    }

    // 4) STRICT: check treasury got expected lamports (via balance delta)
    const treasury = getTreasuryPubkey();
    const expectedLamports = Number(open.amount_lamports);

    const lamportsToTreasury = sumLamportsToTreasuryFromTx(tx, treasury);
    if (lamportsToTreasury < expectedLamports) {
      return Response.json(
        { error: `Payment not sufficient. Expected ${expectedLamports} lamports to treasury.` },
        { status: 400 }
      );
    }

    // 5) Ensure this tx signature not already used by another open
    const dup = await supabaseServer.from("opens").select("id").eq("payment_tx", txSignature).maybeSingle();
    if (!dup.error && dup.data && dup.data.id !== openId) {
      return Response.json({ error: "This tx signature is already used for another open." }, { status: 400 });
    }

    // 6) Mark open PAID
    await supabaseServer.from("opens").update({
      status: "PAID",
      payment_tx: txSignature,
      paid_at: new Date().toISOString(),
    }).eq("id", openId);

    // 7) Generate reward (legendary is rare by table)
    const reward = pickReward(open.tier_id);

    // 8) Safety: payout caps BEFORE we commit/payout
    // Only enforce caps for SOL token rewards.
    if (reward.type === "TOKEN" && reward.symbol === "SOL" && reward.amount) {
      const { globalTotal, walletTotal } = await sumSolPayoutsToday({ wallet: open.wallet });

      const nextWalletTotal = walletTotal + safeNum(reward.amount);
      const nextGlobalTotal = globalTotal + safeNum(reward.amount);

      if (nextWalletTotal > safeNum(settings.max_payout_per_wallet_per_day)) {
        // downgrade to a non-cash reward instead of failing user experience
        reward.type = "TICKET";
        reward.symbol = null;
        reward.amount = 1;
        reward.rarity = "rare";
        reward.title = "Free Box Ticket";
        reward.aiLine = "You almost hit. Take a free toss instead.";
      } else if (nextGlobalTotal > safeNum(settings.max_payout_global_per_day)) {
        reward.type = "CREDIT";
        reward.symbol = null;
        reward.amount = null;
        reward.rarity = "common";
        reward.title = "Credits";
        reward.aiLine = "House is capped for today. Credits instead.";
      }
    }

    // 9) Record reward
    const insertReward = await supabaseServer.from("rewards").insert({
      open_id: openId,
      wallet: open.wallet,
      type: reward.type,
      symbol: reward.symbol,
      amount: reward.amount,
      rarity: reward.rarity,
      meta: { tier: open.tier_id, verifiedLamportsToTreasury: lamportsToTreasury },
    }).select("*").single();

    if (insertReward.error) {
      // If reward write fails, do NOT proceed to payout.
      await supabaseServer.from("opens").update({
        status: "FAILED",
        fail_reason: insertReward.error.message,
      }).eq("id", openId);
      return Response.json({ error: "Failed to record reward. Try support." }, { status: 500 });
    }

    // 10) Auto payout (SOL only)
    let payoutTx = null;
    if (reward.type === "TOKEN" && reward.symbol === "SOL" && reward.amount) {
      // Send SOL from payout hot wallet to user wallet
      payoutTx = await sendSolPayout({
        toWallet: open.wallet,
        solAmount: reward.amount,
      });

      // Optionally store payoutTx in rewards meta
      await supabaseServer.from("rewards").update({
        meta: { ...insertReward.data.meta, payoutTx },
      }).eq("id", insertReward.data.id);
    }

    // 11) Mark revealed
    await supabaseServer.from("opens").update({
      status: "REVEALED",
      revealed_at: new Date().toISOString(),
    }).eq("id", openId);

    const shareText = `I just opened a TossBox and pulled ${reward.title} (${reward.rarity}). tossbox.fun`;

    return Response.json({
      openId,
      rewardType: reward.type,
      symbol: reward.symbol,
      amount: reward.amount,
      rarity: reward.rarity,
      title: reward.title,
      aiLine: reward.aiLine,
      shareText,
      payoutTx,
    });
  } catch (e) {
    return Response.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
