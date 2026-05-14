/**
 * StatusBadge — 일관된 상태/태그 표시.
 * tone: success | warn | sale | info | muted | brand
 * size: sm | md
 */
import type { ReactNode } from "react";

type Tone = "success" | "warn" | "sale" | "info" | "muted" | "brand";
type Size = "sm" | "md";

const TONES: Record<Tone, string> = {
  success: "bg-rk-tint-green text-rk-success",
  warn:    "bg-rk-tint-orange text-rk-orange-deep",
  sale:    "bg-rk-tint-red text-rk-sale",
  info:    "bg-rk-tint-blue text-rk-info",
  muted:   "bg-rk-soft-2 text-rk-muted",
  brand:   "bg-rk-orange text-white",
};

const SIZES: Record<Size, string> = {
  sm: "px-1.5 py-0.5 text-[11px] rounded",
  md: "px-2 py-1 text-[12px] rounded-md",
};

export default function StatusBadge({
  children,
  tone = "muted",
  size = "sm",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  size?: Size;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center font-medium ${TONES[tone]} ${SIZES[size]} ${className}`}>
      {children}
    </span>
  );
}
