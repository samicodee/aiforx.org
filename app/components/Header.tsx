"use client";
import { useEffect, useState } from "react";

export function Header() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 48);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header${solid ? " is-solid" : ""}`}>
      <a className="brand" href="/" aria-label="AIforX home">
        <span className="wordmark">
          AI for <span>X</span>
        </span>
        <span className="tagline">INDIA &amp; THE WORLD.</span>
      </a>
      <nav className="nav" aria-label="Primary navigation">
        <a href="/#programs">Programs</a>
        <a href="/#mission">Mission</a>
        <a href="/#regions">Regions</a>
        <a href="/#apply">Contact</a>
      </nav>
      <a className="header-cta" href="/#apply">
        Apply Now
      </a>
    </header>
  );
}
