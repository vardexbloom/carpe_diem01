import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { adminClient, serverConfigured } from "../../../../lib/supabase";
import { toPaise, verifyWebhookSignature } from "../../../../lib/cashfree";
import { UUID } from "../../../../lib/orders";

// Cashfree payment webhooks. Source of truth for payment status, together with the server-side sync on the order page.
export async function POST(req) {
  const raw = await req.text(); // the signature is computed over the raw text
  const ok = verifyWebhookSignature(raw, req.headers.get("x-webhook-timestamp"), req.headers.get("x-webhook-signature"));
  if (!ok) return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  if (!serverConfigured()) return NextResponse.json({ error: "store_not_configured" }, { status: 503 });

  let evt;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const orderId = evt?.data?.order?.order_id;
  const pay = evt?.data?.payment;
  const type = evt?.type;
  if (!UUID.test(orderId ?? "") || !pay?.cf_payment_id) return NextResponse.json({ ok: true, ignored: true }); // not one of our orders / not a payment event

  const sb = adminClient();
  let r;
  if (type === "PAYMENT_SUCCESS_WEBHOOK" && pay.payment_status === "SUCCESS") {
    r = await sb.rpc("mark_order_paid", { p_order_id: orderId, p_provider_payment_id: String(pay.cf_payment_id), p_amount_paise: toPaise(pay.payment_amount), p_raw: evt.data });
  } else if (type === "PAYMENT_FAILED_WEBHOOK" || type === "PAYMENT_USER_DROPPED_WEBHOOK") {
    r = await sb.rpc("record_payment_attempt", { p_order_id: orderId, p_provider_payment_id: String(pay.cf_payment_id), p_status: type === "PAYMENT_FAILED_WEBHOOK" ? "failed" : "dropped", p_amount_paise: toPaise(pay.payment_amount ?? 0), p_raw: evt.data });
  } else {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (r.error) {
    console.error("webhook processing failed", r.error.message);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 }); // non-200 makes Cashfree retry
  }
  const key = req.headers.get("x-idempotency-key") || crypto.createHash("sha256").update(raw).digest("hex");
  await sb.from("webhook_events").upsert({ event_key: key, provider: "cashfree", event_type: type }, { onConflict: "event_key", ignoreDuplicates: true });
  return NextResponse.json({ ok: true });
}
