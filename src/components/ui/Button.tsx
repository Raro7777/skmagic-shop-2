/**
 * Button — 통일된 버튼 컴포넌트.
 * variant: primary (navy) | accent (orange) | secondary | ghost | danger | success
 * size:    sm | md | lg
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:   "bg-rk-navy hover:bg-rk-navy-deep text-white border-0",
  accent:    "bg-rk-orange hover:bg-rk-orange-deep text-white border-0",
  secondary: "bg-white hover:bg-rk-soft-2 text-rk-text border border-rk-line",
  ghost:     "bg-transparent hover:bg-rk-soft-2 text-rk-text border-0",
  danger:    "bg-rk-sale hover:opacity-90 text-white border-0",
  success:   "bg-rk-success hover:opacity-90 text-white border-0",
};

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1 text-[12px] rounded-md",
  md: "px-3 py-1.5 text-[13px] rounded-md",
  lg: "px-4 py-2.5 text-[14px] rounded-lg",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className = "", disabled, children, ...rest },
  ref,
) {
  const cls = [
    "font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    className,
  ].filter(Boolean).join(" ");

  return (
    <button ref={ref} className={cls} disabled={disabled || loading} {...rest}>
      {loading ? "…" : children}
    </button>
  );
});

export default Button;
