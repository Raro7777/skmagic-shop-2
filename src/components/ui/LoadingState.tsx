export default function LoadingState({ message = "로딩 중…", size = "md" }: { message?: string; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "py-3 text-[13px]" : "py-8 text-[14px]";
  return (
    <div className={`text-center text-rk-muted ${cls}`}>
      <span className="inline-block animate-spin mr-1.5">◐</span>
      {message}
    </div>
  );
}
