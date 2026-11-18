"use client";
import { useEffect, useState } from "react";
import { SITE } from "../data/site";

export default function Footer() {
  const [year, setYear] = useState("");
  useEffect(() => {
    setYear(String(new Date().getFullYear()));
  }, []);
  return (
    <footer className="foot">
      <div>
        <div className="brand">CARPE DIEM</div>
        <p className="sub">Seize the day. New stock every Monday.</p>
      </div>
      <nav className="flinks" aria-label="Contact">
        {SITE.instagram && (
          <a href={"https://instagram.com/" + SITE.instagram} target="_blank" rel="noreferrer">
            Instagram
          </a>
        )}
        {SITE.whatsapp && (
          <a href={"https://wa.me/" + SITE.whatsapp} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        )}
        {SITE.phone && <a href={"tel:" + SITE.phone}>Call us</a>}
        {SITE.email && <a href={"mailto:" + SITE.email}>Email us</a>}
        <a href="#top">Back to top</a>
      </nav>
      <p className="copy">&copy; {year} Carpe Diem. All rights reserved.</p>
    </footer>
  );
}
