import { NextResponse } from "next/server";
import { getOrderByToken, syncOnlinePayment } from "../../../../../lib/orders";
import { serverConfigured } from "../../../../../lib/supabase";
import { clientIp, tooMany } from "../../../../../lib/ratelimit";

// Called by the order page while an online payment is pending. The browser only triggers the check;
// the result comes from Cashfree server to server.
export async function POST(req, { params }) {
  if (tooMany("sync:" + clientIp(req), 40)) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  if (!serverConfigured()) return NextResponse.json({ error: "store_not_configured" }, { status: 503 });
  const { token } = await params;
  let order = await getOrderByToken(token);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const r = await syncOnlinePayment(order);
    if (r.changed) order = await getOrderByToken(token);
  } catch (e) {
    console.error("payment sync failed", e.message);
    return NextResponse.json({ error: "sync_failed", status: order.status, paymentStatus: order.payment_status }, { status: 502 });
  }
  return NextResponse.json({ status: order.status, paymentStatus: order.payment_status });
}
