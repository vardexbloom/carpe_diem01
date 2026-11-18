"use client";
import { useMemo, useState } from "react";
import { useShop } from "./Providers";
import { PRODUCTS, SIZES, TYPES, off, rupee, tagOf } from "../data/products";

export default function ProductGrid() {
  const { addToCart, wish, toggleWish, showSaved, setShowSaved, toast } = useShop();
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const [sort, setSort] = useState("new");
  const [size, setSize] = useState({});

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let l = PRODUCTS.filter((p) => (type === "All" || p.type === type) && p.name.toLowerCase().includes(needle) && (!showSaved || wish.includes(p.id)));
    if (sort === "low") l = [...l].sort((a, b) => a.price - b.price);
    if (sort === "high") l = [...l].sort((a, b) => b.price - a.price);
    if (sort === "off") l = [...l].sort((a, b) => off(b) - off(a));
    return l;
  }, [q, type, sort, showSaved, wish]);

  async function share(p) {
    const url = window.location.origin + "/#shop";
    try {
      if (navigator.share) await navigator.share({ title: "Carpe Diem", text: p.name + " at Carpe Diem", url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      }
    } catch {
      /* the person closed the share sheet */
    }
  }

  return (
    <section id="shop" className="sec">
      <div className="sec-head">
        <h2>Shop everything</h2>
        <span className="sub">Sample products and sample prices.</span>
      </div>
      <div className="tools">
        <label className="sr" htmlFor="q">
          Search clothes
        </label>
        <input id="q" className="inp" type="search" placeholder="Search tees, jeans..." value={q} onChange={(e) => setQ(e.target.value)} />
        {["All", ...TYPES].map((t) => (
          <button key={t} type="button" className={"chip" + (type === t ? " on" : "")} aria-pressed={type === t} onClick={() => setType(t)}>
            {t}
          </button>
        ))}
        <button type="button" className={"chip" + (showSaved ? " on" : "")} aria-pressed={showSaved} onClick={() => setShowSaved(!showSaved)}>
          Saved ({wish.length})
        </button>
        <label className="sr" htmlFor="sort">
          Sort
        </label>
        <select id="sort" className="chip" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="new">Newest first</option>
          <option value="low">Price: low to high</option>
          <option value="high">Price: high to low</option>
          <option value="off">Biggest discount</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="empty-box">
          <p>Nothing matches. Try another word or clear the filters.</p>
          <button
            type="button"
            className="btn dark"
            onClick={() => {
              setQ("");
              setType("All");
              setShowSaved(false);
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid">
          {list.map((p) => {
            const s = size[p.id] || "M";
            const tag = tagOf(p);
            const saved = wish.includes(p.id);
            return (
              <article key={p.id} className="pc">
                <div className="ph">
                  <img src={p.img} alt={p.name} loading="lazy" />
                  {tag && <span className="tag">{tag}</span>}
                  <button type="button" className="heart" aria-pressed={saved} aria-label={(saved ? "Remove " : "Save ") + p.name} onClick={() => toggleWish(p.id)}>
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                      <path d="M12 20S3.5 15 3.5 9A4.6 4.6 0 0 1 12 6.6 4.6 4.6 0 0 1 20.5 9C20.5 15 12 20 12 20Z" />
                    </svg>
                  </button>
                </div>
                <h3 className="pn">{p.name}</h3>
                <div className="price">
                  <b>{rupee(p.price)}</b>
                  <s>{rupee(p.mrp)}</s>
                  <span className="off">{off(p)}% OFF</span>
                </div>
                <div className="sizes" role="group" aria-label={"Size for " + p.name}>
                  {SIZES.map((z) => (
                    <button key={z} type="button" className={"sz" + (s === z ? " on" : "")} aria-pressed={s === z} onClick={() => setSize({ ...size, [p.id]: z })}>
                      {z}
                    </button>
                  ))}
                </div>
                <div className="buy">
                  <button type="button" className="btn dark grow" onClick={() => addToCart(p.id, s)}>
                    Add to cart
                  </button>
                  <button type="button" className="sq" aria-label={"Share " + p.name} onClick={() => share(p)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
                    </svg>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
