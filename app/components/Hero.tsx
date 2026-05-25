"use client";

import { useEffect, useState } from "react";
import { heroSequence } from "@/app/data/programs";

export function Hero() {
  const [index, setIndex] = useState(0);
  const [activeImage, setActiveImage] = useState(0);
  const [images, setImages] = useState([
    heroSequence[0].image,
    heroSequence[0].image,
  ]);
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIsChanging(true);

      window.setTimeout(() => {
        setIndex((current) => {
          const next = (current + 1) % heroSequence.length;
          setImages((currentImages) => {
            const nextImages = [...currentImages];
            nextImages[1 - activeImage] = heroSequence[next].image;
            return nextImages;
          });
          setActiveImage((currentImage) => 1 - currentImage);
          setIsChanging(false);
          return next;
        });
      }, 220);
    }, 2200);

    return () => window.clearInterval(interval);
  }, [activeImage]);

  return (
    <section className="hero">
      {images.map((image, imageIndex) => (
        <img
          key={`${imageIndex}-${image}`}
          className={`hero-image ${activeImage === imageIndex ? "is-active" : ""}`}
          src={image}
          alt={imageIndex === activeImage ? "AIforX program audience" : ""}
          aria-hidden={imageIndex !== activeImage}
        />
      ))}
      <div className="hero-overlay" aria-hidden="true" />
      <div className="hero-inner">
        <p className="kicker">AIFORX | Applied AI education for real work</p>
        <h1>
          AI for{" "}
          <span className={`hero-audience ${isChanging ? "is-changing" : ""}`}>
            {heroSequence[index].text}
          </span>
        </h1>
        <p className="hero-copy">
          Choose the AIforX track built for your role. Practical AI workshops
          for founders, operators, doctors, engineers, and business teams who
          want workflows they can use at work.
        </p>
        <div className="hero-actions">
          <a className="button primary" href="#programs">
            Choose Your Track
          </a>
          <a className="button secondary" href="#why">
            Why AIforX
          </a>
        </div>
      </div>
    </section>
  );
}
