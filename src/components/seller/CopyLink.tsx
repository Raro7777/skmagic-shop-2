"use client";

import { useState } from "react";

export default function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        className="flex-1 border border-rk-line rounded px-2.5 py-1.5 text-[14px] bg-rk-soft-2 font-mono text-rk-text"
      />
      <button
        type="button"
        onClick={copy}
        className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-1.5 rounded text-[14px] font-medium cursor-pointer"
        title={label}
      >
        {copied ? "✓ 복사됨" : "복사"}
      </button>
    </div>
  );
}
