"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShop } from "./Providers";
import { STATES } from "../data/india";
import { rupee } from "../data/products";

const EMPTY = { name: "", phone: "", email: "", address1: "", address2: "", city: "", state: "", pincode: "" };
const RULES = {
  name: [/^.{2,80}$/, "Enter your full name"],
  phone: [/^[6-9][0-9]{9}$/, "Enter a 10 digit mobile number"],
  email: [/^$|^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Enter a valid email or leave it empty"],
  address1: [/^.{5,200}$/, "Enter your house number and street"],
  city: [/^.{2,60}$/, "Enter your city"],
  state: [/^.{2,60}$/, "Choose your state"],
  pincode: [/^[1-9][0-9]{5}$/, "Enter a 6 digit pincode"],
};
const paise = (n) => rupee((n / 100).toFixed(2).replace(/\.00$/, ""));

function loadCashfree() {
  if (window.Cashfree) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.onload = res;
    s.onerror = () => rej(new Error("sdk"));
    document.head.append(s);
  });
}

export default function CheckoutForm({ live, online, cod, codFeePaise }) {
  const { cart, ready, byId } = useShop();
  const router = useRouter();
  const [f, setF] = useState(EMPTY);
  const [errs, setErrs] = useState({});
  const [method, setMethod] = useState(online ? "online" : cod ? "cod" : "");
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState("");
  const [quote, setQuote] = useState(null);
  const keyRef = useRef({ sig: "", key: "" });
  const alertRef = useRef(null);

  const items = useMemo(() => cart.map((x) => ({ slug: x.id, size: x.size, qty: x.qty })), [cart]);
  const sig = JSON.stringify([items, method]);

  // Authoritative totals come from the server (database function), never from this browser.
  useEffect(() => {
    if (!live || !method || items.length === 0) return;
    const ac = new AbortController();
    fetch("/api/checkout/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items, method }), signal: ac.signal })
      .then((r) => r.json())
      .then((d) => setQuote({ sig, ...d }))
      .catch(() => {});
    return () => ac.abort();
  }, [live, method, items, sig]);
  const fresh = quote && quote.sig === sig ? quote : null;

  const say = (i) => {
    const name = byId(i.slug)?.name ?? "An item";
    switch (i.code) {
      case "insufficient_stock": return i.available > 0 ? `Only ${i.available} left of ${name} in size ${i.size}. Lower the quantity in your cart.` : `${name} in size ${i.size} just sold out. Remove it or pick another size.`;
      case "unavailable": return `${name} (size ${i.size}) is no longer available. Remove it from your cart.`;
      case "cod_unavailable": return "Cash on Delivery is not available right now. Please pay online.";
      case "cod_limit": return `Cash on Delivery is only for orders up to ${paise(i.max_total_paise)}. Please pay online or reduce your cart.`;
      case "online_unavailable": return "Online payment is not available right now.";
      case "invalid_customer": return `Please check the ${i.field} field.`;
      default: return "Something is wrong with your cart. Please review it.";
    }
  };

  function validate() {
    const e = {};
    for (const [k, [re, msg]] of Object.entries(RULES)) if (!re.test(f[k].trim())) e[k] = msg;
    setErrs(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev) {
    ev.preventDefault();
    setTop("");
    if (!validate()) {
      setTop("Please fix the highlighted fields.");
      requestAnimationFrame(() => alertRef.current?.focus());
      return;
    }
    setBusy(true);
    // Same cart + method + details => same key (safe to retry). Anything changed => new key, so a stale order is never replayed.
    const s = JSON.stringify([sig, f]);
    if (keyRef.current.sig !== s) keyRef.current = { sig: s, key: crypto.randomUUID() };
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: keyRef.current.key, method, items, customer: f }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTop(
          d.error === "cannot_place_order" ? d.issues.map(say).join(" ")
          : d.error === "too_many_requests" ? "Too many attempts. Please wait a minute and try again."
          : d.error === "online_payments_unavailable" || d.error === "store_not_configured" ? "This payment option is not available right now."
          : d.error === "payment_start_failed" ? "We could not start the payment. Nothing was charged. Please try again."
          : d.error === "invalid_request" ? "Some details look wrong. Please check the form."
          : "Something went wrong and your order was not placed. Please try again."
        );
        requestAnimationFrame(() => alertRef.current?.focus());
        setBusy(false);
        return;
      }
      if (d.paymentSessionId) {
        await loadCashfree();
        const cf = window.Cashfree({ mode: d.mode });
        await cf.checkout({ paymentSessionId: d.paymentSessionId, redirectTarget: "_self" });
        return; // the browser leaves for Cashfree
      }
      router.push(d.redirect);
    } catch {
      setTop("Could not reach the payment page. Check your connection and try again. Nothing was charged.");
      requestAnimationFrame(() => alertRef.current?.focus());
      setBusy(false);
    }
  }

  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.value }));
  const field = (k, label, props = {}) => (
    <div className={"fld" + (props.full ? " full" : "")}>
      <label htmlFor={"f-" + k}>{label}</label>
      {props.select ? (
        <select id={"f-" + k} value={f[k]} onChange={set(k)} aria-invalid={Boolean(errs[k])} aria-describedby={errs[k] ? "e-" + k : undefined} autoComplete={props.ac}>
          <option value="">Choose state</option>
          {STATES.map((s) => (<option key={s}>{s}</option>))}
        </select>
      ) : (
        <input id={"f-" + k} value={f[k]} onChange={set(k)} aria-invalid={Boolean(errs[k])} aria-describedby={errs[k] ? "e-" + k : undefined} autoComplete={props.ac} inputMode={props.mode} type={props.type || "text"} maxLength={props.max} />
      )}
      {errs[k] && <div className="err" id={"e-" + k}>{errs[k]}</div>}
    </div>
  );

  if (!ready) return <div className="page" aria-busy="true" />;
  if (cart.length === 0)
    return (
      <div className="page">
        <h1>Your cart is empty</h1>
        <p>Pick something from this Monday&rsquo;s drop first.</p>
        <Link className="btn dark" href="/#shop">Go to the shop</Link>
      </div>
    );

  const canPay = live && Boolean(method);
  return (
    <div className="page">
      <form className="form" onSubmit={submit} noValidate>
        <div>
          <h1>Checkout</h1>
          {!live && <p className="notice">Ordering is switched off: the store database is not connected yet (demo catalogue).</p>}
          {live && !online && !cod && <p className="notice">No payment option is available right now. Please try again later.</p>}
          {top && <p className="alert" role="alert" tabIndex={-1} ref={alertRef}>{top}</p>}
          <div className="fgrid">
            {field("name", "Full name", { ac: "name", full: true, max: 80 })}
            {field("phone", "Mobile number", { ac: "tel-national", mode: "numeric", type: "tel", max: 10 })}
            {field("email", "Email (optional)", { ac: "email", type: "email", max: 120 })}
            {field("address1", "House number and street", { ac: "address-line1", full: true, max: 200 })}
            {field("address2", "Area, landmark (optional)", { ac: "address-line2", full: true, max: 200 })}
            {field("city", "City", { ac: "address-level2", max: 60 })}
            {field("state", "State", { ac: "address-level1", select: true })}
            {field("pincode", "Pincode", { ac: "postal-code", mode: "numeric", max: 6 })}
          </div>
          <fieldset className="pay">
            <legend>How would you like to pay?</legend>
            <label className={"opt" + (online ? "" : " off")}>
              <input type="radio" name="method" value="online" checked={method === "online"} disabled={!online} onChange={() => setMethod("online")} />
              <span>Pay online (UPI, cards, netbanking)<small>{online ? "Secure payment page by Cashfree." : "Not available right now."}</small></span>
            </label>
            <label className={"opt" + (cod ? "" : " off")}>
              <input type="radio" name="method" value="cod" checked={method === "cod"} disabled={!cod} onChange={() => setMethod("cod")} />
              <span>Cash on Delivery<small>{cod ? `Pay when it arrives. We confirm every COD order on WhatsApp first.${codFeePaise ? ` Extra ${paise(codFeePaise)} COD fee.` : ""}` : "Not available right now."}</small></span>
            </label>
          </fieldset>
        </div>
        <aside className="summary" aria-label="Order summary">
          <h2>Order summary</h2>
          {fresh?.lines ? (
            <>
              <ul>
                {fresh.lines.map((l) => (<li key={l.slug + l.size}><span>{l.name} ({l.size}) &times; {l.qty}</span><span>{paise(l.line_total_paise)}</span></li>))}
              </ul>
              <div className="tot"><span>Subtotal</span><span>{paise(fresh.subtotal_paise)}</span></div>
              <div className="tot"><span>Shipping</span><span>{fresh.shipping_paise ? paise(fresh.shipping_paise) : "Free"}</span></div>
              {fresh.cod_fee_paise > 0 && <div className="tot"><span>COD fee</span><span>{paise(fresh.cod_fee_paise)}</span></div>}
              <div className="tot grand"><span>Total</span><span>{paise(fresh.total_paise)}</span></div>
              {fresh.issues?.length > 0 && <p className="alert" role="alert">{fresh.issues.map(say).join(" ")}</p>}
            </>
          ) : live && method ? (
            <p role="status">Checking prices and stock&hellip;</p>
          ) : (
            <p>Subtotal in your cart is shown here once the store is connected.</p>
          )}
          <button className="btn acc wide" type="submit" disabled={busy || !canPay || Boolean(fresh && fresh.ok === false)}>
            {busy ? "Placing your order\u2026" : method === "online" ? "Pay now" : "Place order"}
          </button>
        </aside>
      </form>
    </div>
  );
}
