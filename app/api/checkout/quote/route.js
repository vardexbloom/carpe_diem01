import { NextResponse } from "next/server";
import { adminClient, serverConfigured } from "../../../../lib/supabase";
import { quoteSchema } from "../../../../lib/checkout-schema";
import { clientIp, tooMany } from "../../../../lib/ratelimit";

// Authoritative price check for the checkout page. Nothing is written; totals come from the database function price_cart.
export async function POST(req) {
  if (tooMany("quote:" + clientIp(req), 60)) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  if (!serverConfigured()) return NextResponse.json({ error: "store_not_configured" }, { status: 503 });
  const parsed = quoteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { data, error } = await adminClient().rpc("price_cart", { p_items: parsed.data.items, p_method: parsed.data.method });
  if (error) {
    console.error("price_cart failed", error.message);
    return NextResponse.json({ error: "quote_failed" }, { status: 500 });
  }
  return NextResponse.json(data);
}
