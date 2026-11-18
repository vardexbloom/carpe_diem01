"use client";
import { useSyncExternalStore } from "react";
import { useShop } from "./Providers";
import { RING, rupee } from "../data/products";
import { SITE } from "../data/site";

const HERO = [
  { badge: "Next drop: Monday", a: "Seize", b: "the day", sub: "Unisex tees, jeans and more. Fresh stock every Monday at very low prices.", cta: "Shop this week\u2019s drop" },
  { badge: "Festive season", a: "Festive", b: "sale live", sub: "Festive season is here. Big discounts and a free gift on bigger orders.", cta: "Grab festive deals" },
  { badge: "Hunted worldwide", a: "World", b: "class fits", sub: "We hunt good clothes from all over the world and bring them to you at crazy-low prices.", cta: "See the finds" },
  { badge: "Unisex for everyone", a: "Your fit", b: "your way", sub: "Clothes for guys, girls and everyone in between. Wear it how you like.", cta: "Find your fit" },
  { badge: "Fresh stock", a: "New drop", b: "Monday", sub: "A brand new batch lands every Monday. Come early, the good sizes go first.", cta: "See what\u2019s new" },
];

function nextDrop() {
  const n = new Date();
  const d = new Date(n);
  d.setHours(SITE.dropHour, 0, 0, 0);
  d.setDate(n.getDate() + ((1 - n.getDay() + 7) % 7));
  if (d <= n) d.setDate(d.getDate() + 7);
  return d;
}
const two = (v) => String(v).padStart(2, "0");

const noop = () => () => {};
let picked = -1; // one random headline per page visit
const pickHeadline = () => (picked < 0 ? (picked = Math.floor(Math.random() * HERO.length)) : picked);
const everySecond = (cb) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};
const nowSecond = () => Math.floor(Date.now() / 1000);

export default function Hero() {
  const { byId } = useShop();
  const ring = RING.filter((id) => byId(id));
  const idx = useSyncExternalStore(noop, pickHeadline, () => 0);
  const sec = useSyncExternalStore(everySecond, nowSecond, () => null);
  const left = sec === null ? null : Math.max(0, Math.floor((nextDrop() - new Date(sec * 1000)) / 1000));
  const v = HERO[idx];
  const clock = left === null ? "-- : -- : -- : --" : [Math.floor(left / 86400), Math.floor((left % 86400) / 3600), Math.floor((left % 3600) / 60), left % 60].map(two).join(" : ");

  return (
    <section className="hero">
      <div className="arc" />
      <div className="hero-body">
        <div className="badge" key={"b" + idx}>{v.badge}</div>
        <h1 className="hl" key={"h" + idx}>
          {v.a}
          <br />
          <span>{v.b}</span>
        </h1>
        <p key={"p" + idx}>{v.sub}</p>
        <div className="cta-row">
          <a className="btn acc" href="#shop">
            {v.cta}
          </a>
          <a className="btn line" href="#outfits">
            Shop full outfits
          </a>
        </div>
      </div>
      <div className="ring-wrap">
        <div className="glass" style={{ left: 48 }} role="timer" aria-label="Time until the next Monday drop">
          <small>Monday drop in</small>
          <b>{clock}</b>
        </div>
        {SITE.freeShippingAbove > 0 && (
          <div className="glass" style={{ right: 48 }}>
            <small>Free shipping above</small>
            <b>{rupee(SITE.freeShippingAbove)}</b>
          </div>
        )}
        <div className="orbit" aria-hidden="true">
          {ring.map((id, k) => {
            const p = byId(id);
            return (
              <div key={id} className="rc" style={{ backgroundImage: `url(${p.img})`, transform: `rotateY(${k * (360 / ring.length)}deg) translateZ(480px) translateY(${k % 2 ? 24 : -24}px)` }}>
                <span>from {rupee(p.price)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="band">New drop every Monday &middot; Unisex &middot; Jeans &middot; Tees &middot; Shirts &middot; New drop every Monday</div>
    </section>
  );
}
