import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req, { params }) {
  const { openId } = params;

  const openRes = await supabaseServer.from("opens").select("*").eq("id", openId).single();
  if (openRes.error) return Response.json({ error: openRes.error.message }, { status: 500 });

  const rewardRes = await supabaseServer.from("rewards").select("*").eq("open_id", openId).single();

  return Response.json({ open: openRes.data, reward: rewardRes.data || null });
}
