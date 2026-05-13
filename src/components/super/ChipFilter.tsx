"use client";

import { useState } from "react";

export default function ChipFilter({
  options,
  defaultIdx = 0,
}: {
  options: string[];
  defaultIdx?: number;
}) {
  const [active, setActive] = useState(defaultIdx);
  return (
    <>
      {options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          onClick={() => setActive(i)}
          className={
            "text-[13px] px-2 py-1 rounded-full cursor-pointer border-0 " +
            (i === active
              ? "bg-rk-tint-blue text-rk-info font-medium"
              : "bg-rk-soft text-rk-muted")
          }
        >
          {opt}
        </button>
      ))}
    </>
  );
}
