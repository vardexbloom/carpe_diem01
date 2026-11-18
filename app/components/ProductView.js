"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useShop } from "./Providers";
import { defaultSize, off, rupee, stockOf, tagOf } from "../data/products";

export default function ProductView({ product: p }) {
  const { addToCart, toggleWish, wish, toast, openCart, catalog } = useShop();
  const [size, setSize] = useState(defaultSize(p));
  const [img, setImg] = useState(0);
  const saved = wish.includes(p.id);
  const left = size ? stockOf(p, size) : 0;
  const soldOut = p.stock <= 0;
  const tag = tagOf(p);
  const cur = p.images[img] ?? p.images[0];

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.name, text: p.name + " at Carpe Diem", url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      }
    } catch {
      /* share sheet closed */
    }
  }

  return (
    <div className="page">
      <Link className="crumb" href="/#shop">
        &larr; Back to shop
      </Link>
      <div className="pdp">
        <div className="gal">
          <div className="big">
            {cur && <Image src={cur.url} alt={cur.alt} fill sizes="(max-width: 820px) 100vw, 55vw" priority />}
            {tag && <span className="tag">{tag}</span>}
            {cur?.demo && <span className="demo-badge">Demo photo</span>}
          </div>
          {p.images.length > 1 && (
            <div className="thumbs">
              {p.images.map((i, k) => (
                <button key={i.url} type="button" aria-label={`Photo ${k + 1} of ${p.images.length}`} aria-current={k === img} onClick={() => setImg(k)}>
                  <Image src={i.url} alt="" fill sizes="72px" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          {p.type && <span className="sub">{p.type}</span>}
          <h1>{p.name}</h1>
          <div className="price">
            <b>{rupee(p.price)}</b>
            {off(p) > 0 && (
              <>
                <s>{rupee(p.mrp)}</s>
                <span className="off">{off(p)}% OFF</span>
              </>
            )}
          </div>
          <div className="sizes" role="group" aria-label="Choose a size">
            {p.variants.map((v) => (
              <button key={v.size} type="button" className={"sz" + (size === v.size ? " on" : "")} aria-pressed={size === v.size} disabled={v.stock <= 0} aria-label={v.stock <= 0 ? v.size + " sold out" : v.size} onClick={() => setSize(v.size)}>
                {v.size}
              </button>
            ))}
          </div>
          <p className={"avail" + (left > 0 && left <= 3 ? " low" : "")} role="status">
            {soldOut ? "Sold out" : !size ? "" : left <= 0 ? `Size ${size} is sold out` : left <= 3 ? `Only ${left} left in size ${size}` : `In stock in size ${size}`}
          </p>
          <div className="buy">
            <button type="button" className="btn dark grow" disabled={soldOut || left <= 0} onClick={() => addToCart(p.id, size)}>
              {soldOut ? "Sold out" : "Add to cart"}
            </button>
            <button type="button" className="sq" aria-pressed={saved} aria-label={(saved ? "Remove " : "Save ") + p.name} onClick={() => toggleWish(p.id)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 20S3.5 15 3.5 9A4.6 4.6 0 0 1 12 6.6 4.6 4.6 0 0 1 20.5 9C20.5 15 12 20 12 20Z" />
              </svg>
            </button>
            <button type="button" className="sq" aria-label={"Share " + p.name} onClick={share}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
              </svg>
            </button>
          </div>
          {p.description && <p className="desc">{p.description}</p>}
          <button type="button" className="link" onClick={openCart}>
            View cart
          </button>
          {catalog.source === "demo" && <p className="notice">Demo catalogue: ordering is switched off until the store database is connected.</p>}
        </div>
      </div>
    </div>
  );
}
