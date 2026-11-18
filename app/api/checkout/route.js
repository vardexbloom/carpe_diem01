import { NextResponse } from "next/server";
import { adminClient, serverConfigured } from "../../../lib/supabase";
import { checkoutSchema } from "../../../lib/checkout-schema";
import { cashfreeConfigured, cashfreeMode, createCashfreeOrder, getCashfreeOrder } from "../../../lib/cashfree";
import { clientIp, tooMany } from "../../../lib/ratelimit";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const fail = (error, status, extra = {}) => NextResponse.json({ error, ...extra }, { status });

export async function POST(req) {
  if (tooMany("checkout:" + clientIp(req), Number(process.env.RATE_LIMIT_CHECKOUT) || 8)) return fail("too_many_requests", 429);
  if (!serverConfigured()) return fail("store_not_configured", 503);

  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", 400, { fields: Object.keys(parsed.error.flatten().fieldErrors) });
  const { idempotencyKey, method, items, customer } = parsed.data;

  if (method === "online" && !(cashfreeConfigured() && siteUrl())) return fail("online_payments_unavailable", 503);

  const sb = adminClient();
  const { data, error } = await sb.rpc("create_order", { p_idempotency_key: idempotencyKey, p_method: method, p_customer: customer, p_items: items });
  if (error) {
    console.error("create_order failed", error.message);
    return fail("order_failed", 500);
  }
  if (!data.ok) return fail("cannot_place_order", 409, { issues: data.issues });

  const redirect = `/order/${data.public_token}`;
  if (method === "cod" || data.status !== "pending_payment") return NextResponse.json({ ok: true, redirect });

  // Online payment: ask Cashfree for a payment session. The order is only marked paid later, after Cashfree confirms it server-side.
  try {
    let session;
    if (data.replayed) {
      session = await getCashfreeOrder(data.order_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    }
    if (!session) {
      session = await createCashfreeOrder({
        orderId: data.order_id,
        amountPaise: data.total_paise,
        customer,
        returnUrl: siteUrl() + redirect,
        notifyUrl: siteUrl() + "/api/webhooks/cashfree",
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      });
    }
    return NextResponse.json({ ok: true, redirect, paymentSessionId: session.payment_session_id, mode: cashfreeMode() });
  } catch (e) {
    console.error("cashfree order failed", e.message);
    if (!data.replayed) await sb.rpc("cancel_order", { p_order_id: data.order_id, p_reason: "Could not start payment" });
    return fail("payment_start_failed", 502);
  }
}
