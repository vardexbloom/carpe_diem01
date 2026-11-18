"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useShop } from "./Providers";

const PLACED = ["pending_cod_confirmation", "confirmed", "packed", "shipped", "delivered", "payment_review"];

// Clears the cart once an order really exists, and while an online payment is pending asks the server
// (which asks Cashfree) for the result. The browser never decides that a payment succeeded.
export default function OrderLive({ token, status, method, whatsapp }) {
  const router = useRouter();
  const { clearCart } = useShop();
  const [gaveUp, setGaveUp] = useState(false);
  const pending = method === "online" && status === "pending_payment";

  useEffect(() => {
    if (PLACED.includes(status)) clearCart();
  }, [status, clearCart]);

  useEffect(() => {
    if (!pending) return;
    let n = 0, stop = false, t;
    const tick = async () => {
      try {
        const r = await fetch(`/api/orders/${token}/sync`, { method: "POST" });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.status && d.status !== status) return router.refresh();
      } catch {}
      if (stop) return;
      if (++n >= 20) return setGaveUp(true);
      t = setTimeout(tick, 3000);
    };
    tick();
    return () => { stop = true; clearTimeout(t); };
  }, [pending, token, status, router]);

  if (!pending) return null;
  return gaveUp ? (
    <p className="notice" role="status">
      We have not received a payment confirmation yet. If money left your account it will show up here shortly.{" "}
      {whatsapp && <a href={"https://wa.me/" + whatsapp}>Message us on WhatsApp</a>}
    </p>
  ) : (
    <p className="notice" role="status">Checking your payment. This page updates by itself.</p>
  );
}
