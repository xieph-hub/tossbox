import { supabaseServer } from "@/lib/supabaseServer";
import { getConnection, getTreasuryPubkey } from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";

function pickReward(tierId) {
  // SIMPLE V1 TABLE (tune later)
  // Use non-cash rewards heavily to protect margins.
  const r = Math.random();

  if (tierId === "starter") {
    if (r < 0.80) return { type: "CREDIT", rarity: "common", title: "Credits", aiLine: "You got something. Don’t overthink it.", amount: null, symbol: null };
    if (r < 0.98) return { type: "TICKET", rarity: "rare", title: "Free Box Ticket", aiLine: "Free chaos. Dangerous.", amount: 1, symbol: null };
    return { type: "TOKEN", rarity: "legendary", title: "SOL Hit", aiLine: "Okay… that was not supposed to happen.", amount: 0.02, symbol: "SOL" };
  }

  if (tierId === "alpha") {
    if (r < 0.75) return { type: "CREDIT", rarity: "common", title: "Credits", aiLine: "The box acknowledged you.", amount: null, symbol: null };
    if (r < 0.95) return { type: "TICKET", rarity: "rare", title: "Free Box Ticket", aiLine: "Another toss. Another lesson.", amount: 1, symbol: null };
    if (r < 0.995) return { type: "TOKEN", rarity: "rare", title: "SOL Win", aiLine: "Respect. That was clean.", amount: 0.05, symbol: "SOL" };
    return { type: "TOKEN", rarity: "legendary", title: "Big SOL Win", aiLine: "You just became a screenshot.", amount: 0.15, symbol: "SOL" };
  }

  // deity
  if (r < 0.65) return { type: "CREDIT", rarity: "common", title: "Credits", aiLine: "Power comes with disappointment.", amount: null, symbol: null };
  if (r < 0.92) return { type: "TICKET", rarity: "rare", title: "Free Box Ticket", aiLine: "The box wants you back.", amount: 1, symbol: null };
  if (r < 0.99) return { type: "TOKEN", rarity: "rare", title: "SOL Win", aiLine: "That’s a real pull.", amount: 0.12, symbol: "SOL" };
  return { type: "TOKEN", rarity: "legendary", title: "Deity SOL Win", aiLine: "This is why people believe.", amount: 0.30, symbol: "SOL" };
}

export async function POST(req) {
  try {
    const { openId, txSignature } = await req.json();
    if (!openId || !txSignature) {
      return Response.json({ error: "Missing openId or txSignature" }, { status: 400 });
    }

    // fetch open
    const openRes = await supabaseServer.from("opens").select("*").eq("id", openId).single();
    if (openRes.error || !openRes.data) return Response.json({ error: "Open not found" }, { status: 404 });

    const open = openRes.data;

    // prevent re-confirm
    if (open.status === "REVEALED") {
      const rewardRes = await supabaseServer.from("rewards").select("*").eq("open_id", openId).single();
      return Response.json({ error: "Already revealed", reward: rewardRes.data }, { status: 409 });
    }

    // verify tx on chain
    const conn = getConnection();
    const tx = await conn.getTransaction(txSignature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });

    if (!tx || tx.meta?.err) {
      return Response.json({ error: "Transaction not found or failed. Wait a bit and try again." }, { status: 400 });
    }

    const treasury = getTreasuryPubkey();
    const amountLamportsExpected = Number(open.amount_lamports);

    // Very simple verification:
    // confirm treasury appears in account keys + ensure fee payer not null.
    // For strict verification you’d parse instructions; we’ll tighten after launch.
    const keys = tx.transaction.message.getAccountKeys().staticAccountKeys.map((k) => k.toBase58());
    if (!keys.includes(treasury.toBase58())) {
      return Response.json({ error: "This tx does not include the TossBox treasury wallet." }, { status: 400 });
    }

    // mark open paid
    await supabaseServer.from("opens").update({
      status: "PAID",
      payment_tx: txSignature,
      paid_at: new Date().toISOString()
    }).eq("id", openId);

    // generate reward
    const reward = pickReward(open.tier_id);

    // record reward
    await supabaseServer.from("rewards").insert({
      open_id: openId,
      wallet: open.wallet,
      type: reward.type,
      symbol: reward.symbol,
      amount: reward.amount,
      rarity: reward.rarity,
      meta: { tier: open.tier_id }
    });

    // mark revealed
    await supabaseServer.from("opens").update({
      status: "REVEALED",
      revealed_at: new Date().toISOString()
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
      shareText
    });
  } catch (e) {
    return Response.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
