"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useShop } from "./Providers";
import { rupee, stockOf } from "../data/products";

export default function CartDrawer() {
  const { open, closeCart, cart, setQty, removeItem, setSize, subtotal, cartCount, byId } = useShop();

  const panel = useRef(null);
  const closeBtn = useRef(null);

  // Focus management: move focus into the drawer, keep Tab inside it, give focus back on close.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement;
    closeBtn.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") return closeCart();
      if (e.key !== "Tab" || !panel.current) return;
      const f = [...panel.current.querySelectorAll("button:not(:disabled), select, a[href]")];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open, closeCart]);

  return (
    <div className={"drawer-wrap" + (open ? " open" : "")} inert={!open}>
      <div className="drawer-bg" onClick={closeCart} />
      <div ref={panel} className="drawer" role="dialog" aria-modal="true" aria-label="Your cart">
        <div className="drawer-head">
          <h2>Your cart ({cartCount})</h2>
          <button ref={closeBtn} className="x" type="button" onClick={closeCart} aria-label="Close cart">
            &times;
          </button>
        </div>
        {cart.length === 0 ? (
          <p className="empty">Your cart is empty. Pick something from this Monday&rsquo;s drop.</p>
        ) : (
          <ul className="lines">
            {cart.map((it) => {
              const p = byId(it.id);
              return (
                <li key={it.key} className="line-item">
                  <Image src={p.img} alt={p.name} width={72} height={90} />
                  <div className="li-body">
                    <b>{p.name}</b>
                    <div className="li-row">
                      <label className="sr" htmlFor={"sz-" + it.key}>
                        Size
                      </label>
                      <select id={"sz-" + it.key} value={it.size} onChange={(e) => setSize(it.key, e.target.value)}>
                        {p.variants.map((v) => (
                          <option key={v.size} value={v.size} disabled={v.stock <= 0 && v.size !== it.size}>
                            {v.size}
                            {v.stock <= 0 ? " (sold out)" : ""}
                          </option>
                        ))}
                      </select>
                      <div className="qty">
                        <button type="button" onClick={() => setQty(it.key, -1)} aria-label={"Fewer " + p.name}>
                          &minus;
                        </button>
                        <span>{it.qty}</span>
                        <button type="button" onClick={() => setQty(it.key, 1)} aria-label={"More " + p.name}>
                          +
                        </button>
                      </div>
                    </div>
                    <div className="li-row">
                      <span>
                        {rupee(p.price * it.qty)}
                        {stockOf(p, it.size) < it.qty && <em className="warn"> Only {stockOf(p, it.size)} left</em>}
                      </span>
                      <button type="button" className="link" onClick={() => removeItem(it.key)}>
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="drawer-foot">
          <div className="sub-row">
            <span>Subtotal</span>
            <b>{rupee(subtotal)}</b>
          </div>
          <p className="note">Shipping and any discount are added at checkout.</p>
          {cart.length === 0 ? (
            <button className="btn acc wide" type="button" disabled>
              Checkout
            </button>
          ) : (
            <Link className="btn acc wide" href="/checkout" onClick={closeCart}>
              Checkout
            </Link>
          )}
          <button className="btn line-d wide" type="button" onClick={closeCart}>
            Keep shopping
          </button>
        </div>
      </div>
    </div>
  );
}
