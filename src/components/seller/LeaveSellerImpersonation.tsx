"use client";

import { useState } from "react";

export default function LeaveSellerImpersonation() {
  const [busy, setBusy] = useState(false);
  const handleClick = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/console/leave-seller", { method: "POST" });
      const j = await res.json();
      window.location.href = j.redirect ?? "/admin/franchise/sellers";
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="ml-auto text-[12px] text-rk-orange-deep hover:text-rk-orange bg-transparent border-0 cursor-pointer font-medium disabled:opacity-50"
    >
      {busy ? "…" : "← 나가기"}
    </button>
  );
}
