import { adminClient } from "./supabase";
import { cashfreeConfigured, getCashfreeOrder, getCashfreePayments, toPaise } from "./cashfree";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getOrderByToken(token) {
  if (!UUID.test(token)) return null;
  const { data, error } = await adminClient()
    .from("orders")
    .select("id,order_no,public_token,status,payment_method,payment_status,customer_name,phone,address_line1,address_line2,city,state,pincode,subtotal_paise,shipping_paise,cod_fee_paise,total_paise,created_at,courier,tracking_no,order_items(product_name,size,qty,unit_price_paise,line_total_paise)")
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw new Error("Order lookup failed: " + error.message);
  return data;
}

/** Asks Cashfree (server to server) what happened to an unpaid online order and applies it. Idempotent. */
export async function syncOnlinePayment(order) {
  if (!cashfreeConfigured() || order.payment_method !== "online" || order.payment_status === "paid" || order.status === "cancelled") return { changed: false };
  const sb = adminClient();
  const payments = await getCashfreePayments(order.id);
  const ok = (Array.isArray(payments) ? payments : []).find((p) => p.payment_status === "SUCCESS");
  if (ok) {
    const { data, error } = await sb.rpc("mark_order_paid", { p_order_id: order.id, p_provider_payment_id: String(ok.cf_payment_id), p_amount_paise: toPaise(ok.payment_amount), p_raw: ok });
    if (error) throw new Error("mark_order_paid failed: " + error.message);
    return { changed: true, result: data };
  }
  const cfOrder = await getCashfreeOrder(order.id);
  if (cfOrder?.order_status === "EXPIRED") {
    await sb.rpc("cancel_order", { p_order_id: order.id, p_reason: "Cashfree order expired unpaid" });
    return { changed: true };
  }
  return { changed: false };
}
