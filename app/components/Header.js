"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useShop } from "./Providers";

export default function Header() {
  const { cartCount, wish, openCart, setShowSaved } = useShop();
  const [menu, setMenu] = useState(false);
  const btn = useRef(null);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenu(false);
        btn.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  const close = () => setMenu(false);
  const saved = () => {
    setShowSaved(true);
    setMenu(false);
  };

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Carpe Diem, home">
        CARPE DIEM
      </Link>
      <nav className="hnav" aria-label="Sections">
        <Link href="/#rail">This Monday</Link>
        <Link href="/#outfits">Outfits</Link>
        <Link href="/#shop">Shop</Link>
      </nav>
      <div className="hact">
        <Link className="pill saved" href="/#shop" onClick={() => setShowSaved(true)}>
          Saved ({wish.length})
        </Link>
        <button className="pill cart" type="button" onClick={openCart}>
          Cart ({cartCount})
        </button>
        <button ref={btn} className="menu-btn" type="button" aria-expanded={menu} aria-controls="mobile-nav" aria-label={menu ? "Close menu" : "Open menu"} onClick={() => setMenu((m) => !m)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            {menu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
      <nav id="mobile-nav" className={"mnav" + (menu ? " open" : "")} aria-label="Sections" inert={!menu}>
        <Link href="/#rail" onClick={close}>This Monday</Link>
        <Link href="/#outfits" onClick={close}>Outfits</Link>
        <Link href="/#shop" onClick={close}>Shop</Link>
        <Link href="/#shop" onClick={saved}>Saved ({wish.length})</Link>
      </nav>
    </header>
  );
}
