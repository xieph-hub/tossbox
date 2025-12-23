import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("box_tiers")
    .select("id,name,price_lamports,active");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const tiers = (data || []).map((t) => ({
    ...t,
    price_sol: Number(t.price_lamports) / 1_000_000_000
  }));

  return Response.json({ tiers });
}
