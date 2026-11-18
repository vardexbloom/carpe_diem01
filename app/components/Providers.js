"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { byId } from "../data/products";

const Ctx = createContext(null);
export function useShop() {
  return useContext(Ctx);
}

export default function Providers({ children }) {
  const [cart, setCart] = useState([]);
  const [wish, setWish] = useState([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const timer = useRef(0);
  const wishRef = useRef([]);

  // load saved cart and wishlist from this browser
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("cd-cart") || "[]");
      const w = JSON.parse(localStorage.getItem("cd-wish") || "[]");
      if (Array.isArray(c)) setCart(c.filter((x) => byId(x.id)));
      if (Array.isArray(w)) setWish(w.filter((x) => byId(x)));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("cd-cart", JSON.stringify(cart));
      localStorage.setItem("cd-wish", JSON.stringify(wish));
    } catch {}
  }, [cart, wish, ready]);
  useEffect(() => {
    wishRef.current = wish;
  }, [wish]);

  const toast = useCallback((m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 2000);
  }, []);

  const addToCart = useCallback(
    (id, size = "M", quiet = false) => {
      setCart((c) => {
        const key = id + "-" + size;
        return c.some((x) => x.key === key) ? c.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x)) : [...c, { key, id, size, qty: 1 }];
      });
      if (!quiet) toast(`Added ${byId(id).name} (size ${size})`);
    },
    [toast]
  );
  const setQty = useCallback((key, d) => {
    setCart((c) => c.flatMap((x) => (x.key !== key ? [x] : x.qty + d <= 0 ? [] : [{ ...x, qty: x.qty + d }])));
  }, []);
  const removeItem = useCallback((key) => setCart((c) => c.filter((x) => x.key !== key)), []);
  const setSize = useCallback((key, size) => {
    setCart((c) => {
      const it = c.find((x) => x.key === key);
      if (!it || it.size === size) return c;
      const nk = it.id + "-" + size;
      const rest = c.filter((x) => x.key !== key);
      return rest.some((x) => x.key === nk) ? rest.map((x) => (x.key === nk ? { ...x, qty: x.qty + it.qty } : x)) : [...rest, { ...it, key: nk, size }];
    });
  }, []);
  const toggleWish = useCallback(
    (id) => {
      const on = !wishRef.current.includes(id);
      setWish((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
      toast(on ? "Saved to your wishlist" : "Removed from your wishlist");
    },
    [toast]
  );
  const openCart = useCallback(() => setOpen(true), []);
  const closeCart = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({
      cart, wish, open, showSaved, setShowSaved, toast, addToCart, setQty, removeItem, setSize, toggleWish, openCart, closeCart,
      cartCount: cart.reduce((s, x) => s + x.qty, 0),
      subtotal: cart.reduce((s, x) => s + byId(x.id).price * x.qty, 0),
    }),
    [cart, wish, open, showSaved, toast, addToCart, setQty, removeItem, setSize, toggleWish, openCart, closeCart]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className={"toast" + (msg ? " on" : "")} role="status" aria-live="polite">
        {msg}
      </div>
    </Ctx.Provider>
  );
}
