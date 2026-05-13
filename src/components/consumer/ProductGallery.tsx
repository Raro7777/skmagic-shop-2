"use client";

import { useState } from "react";

export default function ProductGallery({
  images,
  fallbackBg,
  fallbackBadges,
}: {
  images: string[];
  fallbackBg: string;
  fallbackBadges?: React.ReactNode;
}) {
  const [active, setActive] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="relative aspect-square w-full" style={{ backgroundImage: fallbackBg }}>
        <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">{fallbackBadges}</div>
      </div>
    );
  }

  const total = images.length;
  return (
    <div>
      {/* Main image */}
      <div className="relative aspect-square w-full bg-rk-soft overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[active]}
          alt=""
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-1 items-start z-10">{fallbackBadges}</div>
        <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-black/50 text-white text-[10px] font-mono rounded-full z-10">
          {active + 1} / {total}
        </div>
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActive(a => (a - 1 + total) % total)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full grid place-items-center text-[14px] cursor-pointer border-0 z-10"
              aria-label="이전 이미지"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setActive(a => (a + 1) % total)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full grid place-items-center text-[14px] cursor-pointer border-0 z-10"
              aria-label="다음 이미지"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {total > 1 && (
        <div className="flex gap-2 px-2 py-2 overflow-x-auto bg-rk-soft-2 border-b border-rk-line">
          {images.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={
                "w-14 h-14 rounded shrink-0 overflow-hidden border-2 cursor-pointer p-0 " +
                (i === active ? "border-rk-orange" : "border-rk-line-2")
              }
              aria-label={`이미지 ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
