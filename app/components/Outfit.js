"use client";
// The "full outfit" section: a line of outfits that fades into the distance.
// Drag, tap an outfit further back, or use the arrow keys (click the section first) to bring the next one forward.
// It is written with plain DOM code inside useEffect because it animates on every frame.
import { useEffect, useRef } from "react";
import { useShop } from "./Providers";
import { OUTFITS, byId, rupee } from "../data/products";

const KX = [1.2, 0.744, 0.496, 0.346, 0.235, 0.15, 0.085];
const KF = [1.14, 0.89, 0.777, 0.704, 0.651, 0.616, 0.59];
const KH = [1.18, 0.832, 0.574, 0.436, 0.334, 0.258, 0.19];
const KB = [0, 0, 1.5, 4, 8, 12, 17];
const KO = [1, 1, 1, 1, 0.86, 0.5, 0];
const wrap = (x, n) => ((x % n) + n) % n;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const two = (v) => String(v).padStart(2, "0");

export default function Outfit() {
  const { addToCart, toggleWish, toast, wish } = useShop();
  const stageRef = useRef(null);
  const lineRef = useRef(null);
  const railRef = useRef(null);
  const rollRef = useRef(null);
  const sumRef = useRef(null);
  const btnRef = useRef(null);
  const api = useRef({});
  useEffect(() => {
    api.current = { addToCart, toggleWish, toast };
  });

  useEffect(() => {
    const stage = stageRef.current, line = lineRef.current, rail = railRef.current, roll = rollRef.current, sum = sumRef.current, btn = btnRef.current;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const N = OUTFITS.length;
    const ITEMS = OUTFITS.flatMap(([t, b]) => [byId(t), byId(b)]);
    const ac = new AbortController();
    const opt = { signal: ac.signal };

    const people = OUTFITS.map(([t, b], i) => {
      const e = document.createElement("div");
      e.className = "of-m";
      e.dataset.i = i;
      e.setAttribute("role", "img");
      e.setAttribute("aria-label", `Outfit ${i + 1}: ${byId(t).name} with ${byId(b).name}`);
      const top = document.createElement("span");
      top.className = "t";
      top.style.backgroundImage = `url(${byId(t).img})`;
      const bottom = document.createElement("span");
      bottom.className = "b";
      bottom.style.backgroundImage = `url(${byId(b).img})`;
      e.append(top, bottom);
      line.append(e);
      return { e, r: 0.5, f: "", o: "" };
    });
    const cards = ITEMS.map((p, i) => {
      const e = document.createElement("article");
      e.className = "of-card" + (i % 2 ? " alt" : "");
      e.innerHTML = `<button class="fav" type="button" data-id="${p.id}" aria-pressed="false" aria-label="Save ${p.name}"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 20S3.5 15 3.5 9A4.6 4.6 0 0 1 12 6.6 4.6 4.6 0 0 1 20.5 9C20.5 15 12 20 12 20Z"/></svg></button><span class="shot" role="img" aria-label="${p.name}"></span><div class="meta"><h3>${p.name}</h3><span>${rupee(p.price)} \u00B7 ${i % 2 ? "Bottom" : "Top"}</span><button class="add" type="button" data-id="${p.id}" aria-label="Add ${p.name} to cart"></button></div>`;
      e.querySelector(".shot").style.backgroundImage = `url(${p.img})`;
      rail.append(e);
      return e;
    });
    for (let i = 0; i <= N; i++) {
      const b = document.createElement("b");
      b.textContent = two(1 + (i % N));
      roll.append(b);
    }

    let W = 0, H = 0, base = 0, cardS = 0, side = false, dirty = true, p = 0, target = 0, last = 0, cur = -1, raf = 0, wheelT = 0, down = false, sx = 0, st = 0, moved = 0;
    const size = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      base = H * 1.2;
      side = window.innerWidth <= 820;
      people.forEach((m) => {
        m.e.style.width = base * m.r + "px";
        m.e.style.height = base + "px";
      });
      cardS = side ? 170 : rail.clientHeight / 3;
      cards.forEach((c) => {
        c.style.height = side ? "100%" : cardS + "px";
      });
      dirty = true;
    };
    const paint = () => {
      people.forEach((m, i) => {
        let d = wrap(i - p, N);
        if (d > N - 1) d -= N;
        const k = clamp(((d + 1) * 6) / N, 0, 6), a = Math.floor(k), b = Math.min(6, a + 1), t = k - a;
        const mix = (A) => A[a] + (A[b] - A[a]) * t;
        const h = mix(KH) * H, s = h / base, w = h * m.r, x = mix(KX) * W - w / 2, y = mix(KF) * H - h;
        m.e.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s.toFixed(4)})`;
        const f = mix(KB) / s, fs = f < 0.2 ? "none" : `blur(${f.toFixed(1)}px)`, o = mix(KO).toFixed(3);
        if (fs !== m.f) { m.f = fs; m.e.style.filter = fs; }
        if (o !== m.o) { m.o = o; m.e.style.opacity = o; }
        m.e.style.zIndex = 100 - Math.round(d * 10);
      });
      const all = cardS * ITEMS.length;
      cards.forEach((c, i) => {
        let y = wrap(i * cardS - p * 2 * cardS, all);
        if (y > all - cardS) y -= all;
        c.style.transform = side ? `translate3d(${y.toFixed(1)}px,0,0)` : `translate3d(0,${y.toFixed(1)}px,0)`;
      });
      roll.style.transform = `translate3d(0,${(-wrap(p, N) * roll.firstChild.offsetHeight).toFixed(1)}px,0)`;
      const k = Math.round(wrap(p, N)) % N;
      if (k !== cur) {
        cur = k;
        sum.textContent = "Outfit total " + rupee(ITEMS[2 * k].price + ITEMS[2 * k + 1].price);
      }
    };
    const frame = (now) => {
      const dt = Math.min(50, now - last) || 16;
      last = now;
      const was = p;
      if (calm) p = target;
      else p += (target - p) * (1 - Math.exp(-dt * 0.0072));
      if (Math.abs(target - p) < 0.0004) p = target;
      if (p !== was || dirty) { dirty = false; paint(); }
      raf = requestAnimationFrame(frame);
    };

    const PULL = () => Math.max(150, W * 0.2);
    stage.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      down = true; sx = e.clientX; st = target; moved = 0;
      stage.setPointerCapture(e.pointerId);
      stage.classList.add("drag");
    }, opt);
    stage.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      moved = Math.max(moved, Math.abs(dx));
      target = st + dx / PULL();
    }, opt);
    const release = (e) => {
      if (!down) return;
      down = false;
      stage.classList.remove("drag");
      if (moved < 6) {
        const hit = document.elementsFromPoint(e.clientX, e.clientY).find((x) => x.classList && x.classList.contains("of-m"));
        if (hit) {
          const d = Math.round(wrap(+hit.dataset.i - target, N));
          if (d > 0 && d < N) target = Math.round(target) + d;
        }
      } else target = Math.round(target);
    };
    stage.addEventListener("pointerup", release, opt);
    stage.addEventListener("pointercancel", release, opt);
    // only sideways trackpad swipes move the looks, so normal page scrolling is never blocked
    stage.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      target += clamp(e.deltaX, -120, 120) / 420;
      clearTimeout(wheelT);
      wheelT = setTimeout(() => { target = Math.round(target); }, 150);
    }, { signal: ac.signal, passive: false });
    stage.addEventListener("keydown", (e) => {
      if (["ArrowRight", "ArrowDown"].includes(e.key)) { e.preventDefault(); target = Math.round(target) + 1; }
      if (["ArrowLeft", "ArrowUp"].includes(e.key)) { e.preventDefault(); target = Math.round(target) - 1; }
    }, opt);
    rail.addEventListener("click", (e) => {
      const f = e.target.closest(".fav");
      if (f) api.current.toggleWish(+f.dataset.id);
      const a = e.target.closest(".add");
      if (a) api.current.addToCart(+a.dataset.id, "M");
    }, opt);
    btn.addEventListener("click", () => {
      const k = cur < 0 ? 0 : cur;
      api.current.addToCart(OUTFITS[k][0], "M", true);
      api.current.addToCart(OUTFITS[k][1], "M", true);
      api.current.toast("Added the full outfit (size M). Change sizes in your cart.");
    }, opt);
    window.addEventListener("resize", size, opt);

    size();
    paint();
    raf = requestAnimationFrame(frame);
    return () => {
      ac.abort();
      cancelAnimationFrame(raf);
      clearTimeout(wheelT);
      line.innerHTML = "";
      rail.innerHTML = "";
      roll.innerHTML = "";
    };
  }, []);

  // keep the hearts in sync with the saved list
  useEffect(() => {
    railRef.current.querySelectorAll(".fav").forEach((b) => b.setAttribute("aria-pressed", String(wish.includes(+b.dataset.id))));
  }, [wish]);

  return (
    <section id="outfits" className="sec">
      <div className="sec-head">
        <h2>Shop the full outfit</h2>
        <span className="sub">Drag the looks, or tap one further back. Add the whole outfit in one tap.</span>
      </div>
      <div className="of">
        <div className="of-stage" ref={stageRef} tabIndex={0} aria-label="Outfits. Drag or use the arrow keys to change outfit.">
          <div className="of-arc" />
          <div className="of-line" ref={lineRef} />
          <div className="of-intro">
            <h3>Wear the whole look</h3>
            <p>New outfits every Monday. Tops, bottoms and layers that go together.</p>
          </div>
          <div className="of-tag">
            <div className="of-look" aria-live="polite">
              <span>Look</span>
              <span className="of-win">
                <span className="of-roll" ref={rollRef} />
              </span>
            </div>
            <div className="of-sum" ref={sumRef} />
            <button className="of-btn" ref={btnRef} type="button">
              Add full outfit
            </button>
          </div>
        </div>
        <aside className="of-rail" ref={railRef} aria-label="Pieces in this outfit" />
      </div>
    </section>
  );
}
