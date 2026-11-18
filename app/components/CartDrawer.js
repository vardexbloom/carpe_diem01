"use client";
import { useEffect } from "react";
import { useShop } from "./Providers";
import { byId, rupee, SIZES } from "../data/products";

export default function CartDrawer() {
  const { open, closeCart, cart, setQty, removeItem, setSize, subtotal, cartCount, toast } = useShop();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeCart]);

  return (
    <div className={"drawer-wrap" + (open ? " open" : "")} inert={!open}>
      <div className="drawer-bg" onClick={closeCart} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Your cart">
        <div className="drawer-head">
          <h2>Your cart ({cartCount})</h2>
          <button className="x" type="button" onClick={closeCart} aria-label="Close cart">
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
                  <img src={p.img} alt={p.name} width="72" height="90" />
                  <div className="li-body">
                    <b>{p.name}</b>
                    <div className="li-row">
                      <label className="sr" htmlFor={"sz-" + it.key}>
                        Size
                      </label>
                      <select id={"sz-" + it.key} value={it.size} onChange={(e) => setSize(it.key, e.target.value)}>
                        {SIZES.map((s) => (
                          <option key={s}>{s}</option>
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
                      <span>{rupee(p.price * it.qty)}</span>
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
          <button className="btn acc wide" type="button" disabled={cart.length === 0} onClick={() => toast("Checkout is built in the next step")}>
            Checkout
          </button>
          <button className="btn line-d wide" type="button" onClick={closeCart}>
            Keep shopping
          </button>
        </div>
      </aside>
    </div>
  );
}
