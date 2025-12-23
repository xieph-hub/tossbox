import { supabaseServer } from "@/lib/supabaseServer";
import { getTreasuryPubkey } from "@/lib/solana";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeString(v) {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const tierId = safeString(body.tierId);
    const wallet = safeString(body.wallet);

    if (!tierId || !wallet) {
      return Response.json({ error: "Missing tierId or wallet" }, { status: 400 });
    }

    // kill switch
    const settingsRes = await supabaseServer
      .from("admin_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (settingsRes.error) {
      return Response.json({ error: settingsRes.error.message }, { status: 500 });
    }

    if (settingsRes.data?.kill_switch) {
      return Response.json({ error: "TossBox is paused. Try later." }, { status: 403 });
    }

    // tier
    const tierRes = await supabaseServer
      .from("box_tiers")
      .select("id,name,price_lamports,active")
      .eq("id", tierId)
      .single();

    if (tierRes.error || !tierRes.data) {
      return Response.json({ error: "Invalid tier" }, { status: 400 });
    }

    if (!tierRes.data.active) {
      return Response.json({ error: "Tier not active" }, { status: 400 });
    }

    const amountLamports = Number(tierRes.data.price_lamports);
    if (!Number.isFinite(amountLamports) || amountLamports <= 0) {
      return Response.json({ error: "Invalid tier price" }, { status: 400 });
    }

    // ensure user exists
    const userUpsert = await supabaseServer
      .from("users")
      .upsert({ wallet }, { onConflict: "wallet" });

    if (userUpsert.error) {
      return Response.json({ error: userUpsert.error.message }, { status: 500 });
    }

    // create open
    const openRes = await supabaseServer
      .from("opens")
      .insert({
        wallet,
        tier_id: tierId,
        status: "CREATED",
        amount_lamports: amountLamports,
      })
      .select("id")
      .single();

    if (openRes.error || !openRes.data) {
      return Response.json({ error: openRes.error?.message || "Failed to create open" }, { status: 500 });
    }

    const treasury = getTreasuryPubkey().toBase58();

    return Response.json({
      openId: openRes.data.id,
      treasury,
      amountLamports,
    });
  } catch (e) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
