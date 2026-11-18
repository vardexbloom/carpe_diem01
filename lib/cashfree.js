import crypto from "node:crypto";

const env = () => process.env.CASHFREE_ENV;
export const cashfreeConfigured = () =>
  Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY && (env() === "sandbox" || env() === "production"));
export const cashfreeMode = () => (env() === "production" ? "production" : "sandbox");

// CASHFREE_TEST_BASE_URL exists only so the automated tests can point at a local stand-in; it is ignored in production mode.
const base = () => (env() === "production" ? "https://api.cashfree.com/pg" : process.env.CASHFREE_TEST_BASE_URL || "https://sandbox.cashfree.com/pg");
const VERSION = "2025-01-01";

async function cf(path, init = {}) {
  const res = await fetch(base() + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-api-version": VERSION,
      "x-client-id": process.env.CASHFREE_APP_ID,
      "x-client-secret": process.env.CASHFREE_SECRET_KEY,
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(`Cashfree ${res.status}: ${body?.message ?? "request failed"}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

export const toRupees = (paise) => Number((paise / 100).toFixed(2));
export const toPaise = (rupees) => Math.round(Number(rupees) * 100);

export async function createCashfreeOrder({ orderId, amountPaise, customer, returnUrl, notifyUrl, expiresAt }) {
  return cf("/orders", {
    method: "POST",
    body: JSON.stringify({
      order_id: orderId,
      order_amount: toRupees(amountPaise),
      order_currency: "INR",
      customer_details: {
        customer_id: "c" + orderId.replace(/-/g, "").slice(0, 24),
        customer_name: customer.name,
        customer_phone: customer.phone,
        ...(customer.email ? { customer_email: customer.email } : {}),
      },
      order_meta: { return_url: returnUrl, notify_url: notifyUrl },
      order_expiry_time: expiresAt,
    }),
  });
}
export const getCashfreeOrder = (orderId) => cf("/orders/" + encodeURIComponent(orderId));
export const getCashfreePayments = (orderId) => cf("/orders/" + encodeURIComponent(orderId) + "/payments");

/** Cashfree signs timestamp + raw body with HMAC-SHA256 (base64). Must be computed on the RAW text, not parsed JSON. */
export function verifyWebhookSignature(rawBody, timestamp, signature, secret = process.env.CASHFREE_SECRET_KEY) {
  if (!rawBody || !timestamp || !signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(timestamp + rawBody).digest();
  let given;
  try {
    given = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
