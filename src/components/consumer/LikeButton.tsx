"use client";

import { useState } from "react";

export default function LikeButton() {
  const [liked, setLiked] = useState(false);
  return (
    <span
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        setLiked(v => !v);
      }}
      className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-white/85 grid place-items-center text-sm cursor-pointer"
      style={{ color: liked ? "var(--color-rk-sale)" : "var(--color-rk-ink)" }}
    >
      {liked ? "♥" : "♡"}
    </span>
  );
}
