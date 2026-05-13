"use client";

import { useEffect, useState } from "react";

const fmt = (n: number) => n.toLocaleString("ko-KR");

/**
 * 카운트업 애니메이션 — 페이지 로드 시 0 에서 target 까지 1.2초 증가.
 * suffix 단위, prefix(₩) 옵션.
 */
export default function LiveCounter({
  value, suffix, prefix, decimals = 0, duration = 1200, className,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setN(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const display = decimals > 0 ? n.toFixed(decimals) : fmt(Math.round(n));
  return (
    <span className={className}>
      {prefix}{display}{suffix}
    </span>
  );
}
