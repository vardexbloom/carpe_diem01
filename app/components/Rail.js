"use client";
import { useShop } from "./Providers";
import { RAIL, byId, rupee, tagOf } from "../data/products";

export default function Rail() {
  const { addToCart } = useShop();
  return (
    <section id="rail" className="sec">
      <div className="sec-head">
        <h2>This Monday&rsquo;s rail</h2>
        <span className="sub">Tap a piece to pull it off the rail. It pops out and turns around.</span>
      </div>
      <div className="rail-wrap">
        <div className="rail-bar" />
        <div className="rail-scroll">
          {RAIL.map((id, k) => {
            const p = byId(id);
            const tag = tagOf(p);
            const rid = "rail-" + id;
            return (
              <div className="rt" key={id}>
                <input type="radio" name="rail" id={rid} className="rr" defaultChecked={k === 2} aria-label={p.name} />
                <label htmlFor={rid} className="hang" style={{ animationDelay: `${k * 0.6}s` }}>
                  <span className="hook">
                    <svg width="64" height="36" viewBox="0 0 64 36" fill="none" stroke="#0E0E0E" strokeWidth="3" aria-hidden="true">
                      <path d="M32 0V12M32 12L4 34H60Z" />
                    </svg>
                  </span>
                  <span className="stage">
                    <span className="spin">
                      <span className="fc" style={{ backgroundImage: `url(${p.img})` }} />
                      <span className="fc bc" style={{ backgroundImage: `url(${p.img})` }} />
                    </span>
                    {tag && <span className="gl rtag">{tag}</span>}
                  </span>
                  <span className="rname">
                    <b>{p.name}</b>
                    <span className="sub">{rupee(p.price)}</span>
                    <button
                      type="button"
                      className="sb"
                      onClick={(e) => {
                        e.preventDefault();
                        addToCart(p.id, "M");
                      }}
                    >
                      Add to cart
                    </button>
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
