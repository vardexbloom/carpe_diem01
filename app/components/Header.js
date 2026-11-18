"use client";
import { useShop } from "./Providers";

export default function Header() {
  const { cartCount, wish, openCart, setShowSaved } = useShop();
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Carpe Diem, back to top">
        CARPE DIEM
      </a>
      <nav className="hnav" aria-label="Sections">
        <a href="#rail">This Monday</a>
        <a href="#outfits">Outfits</a>
        <a href="#shop">Shop</a>
      </nav>
      <div className="hact">
        <a className="pill" href="#shop" onClick={() => setShowSaved(true)}>
          Saved ({wish.length})
        </a>
        <button className="pill cart" type="button" onClick={openCart}>
          Cart ({cartCount})
        </button>
      </div>
    </header>
  );
}
