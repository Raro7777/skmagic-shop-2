import type { ReactNode } from "react";

export default function EmptyState({
  icon = "📭",
  message,
  hint,
  action,
}: {
  icon?: string;
  message: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-8 px-4">
      <div className="text-[28px] mb-1.5">{icon}</div>
      <div className="text-[14px] text-rk-text font-medium">{message}</div>
      {hint && <div className="text-[13px] text-rk-muted mt-1">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
