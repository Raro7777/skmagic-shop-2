"use client";

export default function PrintButton({ label = "🖨 인쇄 / PDF 저장", className }: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className ?? "ml-auto bg-rk-orange hover:bg-rk-orange-deep text-white border-0 px-3 py-1.5 rounded text-[14px] font-medium cursor-pointer"}
    >
      {label}
    </button>
  );
}
