"use client";

import { useEffect, useState } from "react";

export default function HeroPager({ total = 4 }: { total?: number }) {
  const [idx, setIdx] = useState(1);

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % total), 4000);
    return () => clearInterval(t);
  }, [total]);

  return (
    <div className="absolute left-4 right-4 bottom-3.5 flex justify-between items-center">
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={
              "h-1.5 rounded-full transition-all " +
              (i === idx ? "bg-white w-3.5" : "bg-white/25 w-1.5")
            }
          />
        ))}
      </div>
      <span className="text-[13px] font-mono opacity-80 px-2 py-0.5 bg-black/30 rounded-full text-white rk-num">
        {idx + 1} / {total}
      </span>
    </div>
  );
}
