"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { stockOf } from "../data/products";

const Ctx = createContext(null);
export function useShop() {
  return useContext(Ctx);
}

// Versioned keys: older carts used numeric product ids and cannot be reused.
const CART_KEY = "cd-cart-v2";
const WISH_KEY = "cd-wish-v2";
const MAX_PER_LINE = 10; // same limit the database enforces

export default function Providers({ children, catalog }) {
  const map = useMemo(() => new Map(catalog.products.map((p) => [p.slug, p])), [catalog]);
  const byId = useCallback((slug) => map.get(slug), [map]);

  const [cart, setCart] = useState([]);
  const [wish, setWish] = useState([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const timer = useRef(0);
  const wishRef = useRef([]);
  const cartRef = useRef([]);
  const loaded = useRef(false); // load from the browser exactly once: a later router refresh must never bring back an old cart

  // Load saved cart and wishlist from this browser once after hydration (localStorage is an external system).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const c = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      const w = JSON.parse(localStorage.getItem(WISH_KEY) || "[]");
      if (Array.isArray(c)) setCart(c.filter((x) => x && typeof x.id === "string" && map.has(x.id) && Number.isInteger(x.qty) && x.qty > 0));
      if (Array.isArray(w)) setWish(w.filter((x) => map.has(x)));
    } catch {}
    setReady(true);
  }, [map]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      localStorage.setItem(WISH_KEY, JSON.stringify(wish));
    } catch {}
  }, [cart, wish, ready]);
  useEffect(() => {
    wishRef.current = wish;
    cartRef.current = cart;
  }, [wish, cart]);

  const toast = useCallback((m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 2400);
  }, []);

  // Largest quantity of this line the shopper may hold, from real stock.
  const limitFor = useCallback((id, size) => {
    const p = map.get(id);
    return p ? Math.min(MAX_PER_LINE, stockOf(p, size)) : 0;
  }, [map]);

  const addToCart = useCallback(
    (id, size, quiet = false) => {
      const p = map.get(id);
      if (!p || !size) return toast("Sorry, that one is sold out");
      const key = id + "-" + size;
      const have = cartRef.current.find((x) => x.key === key)?.qty ?? 0;
      const max = limitFor(id, size);
      if (max <= 0) return toast(`Size ${size} is sold out`);
      if (have + 1 > max) return toast(`Only ${max} available in size ${size}`);
      setCart((c) => (c.some((x) => x.key === key) ? c.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x)) : [...c, { key, id, size, qty: 1 }]));
      if (!quiet) toast(`Added ${p.name} (size ${size})`);
    },
    [map, toast, limitFor]
  );
  const setQty = useCallback(
    (key, d) => {
      const it = cartRef.current.find((x) => x.key === key);
      if (!it) return;
      if (d > 0 && it.qty + d > limitFor(it.id, it.size)) return toast(`Only ${limitFor(it.id, it.size)} available in size ${it.size}`);
      setCart((c) => c.flatMap((x) => (x.key !== key ? [x] : x.qty + d <= 0 ? [] : [{ ...x, qty: x.qty + d }])));
    },
    [toast, limitFor]
  );
  const removeItem = useCallback((key) => setCart((c) => c.filter((x) => x.key !== key)), []);
  const clearCart = useCallback(() => setCart([]), []);
  const setSize = useCallback(
    (key, size) => {
      const it = cartRef.current.find((x) => x.key === key);
      if (!it || it.size === size) return;
      const nk = it.id + "-" + size;
      const merged = (cartRef.current.find((x) => x.key === nk)?.qty ?? 0) + it.qty;
      if (merged > limitFor(it.id, size)) return toast(`Not enough stock in size ${size}`);
      setCart((c) => {
        const rest = c.filter((x) => x.key !== key);
        return rest.some((x) => x.key === nk) ? rest.map((x) => (x.key === nk ? { ...x, qty: x.qty + it.qty } : x)) : [...rest, { ...it, key: nk, size }];
      });
    },
    [toast, limitFor]
  );
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
      catalog, products: catalog.products, types: catalog.types, byId, cart, wish, open, ready, showSaved, setShowSaved, toast,
      addToCart, setQty, removeItem, clearCart, setSize, toggleWish, openCart, closeCart,
      cartCount: cart.reduce((s, x) => s + x.qty, 0),
      subtotal: cart.reduce((s, x) => s + (map.get(x.id)?.price ?? 0) * x.qty, 0),
    }),
    [catalog, byId, map, cart, wish, open, ready, showSaved, toast, addToCart, setQty, removeItem, clearCart, setSize, toggleWish, openCart, closeCart]
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
