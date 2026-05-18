import { redirect } from "next/navigation";
import { listActivePartners } from "@/lib/partnerSite";

// Legacy URL — canonical is now /p/[partnerCode]. 첫 활성 협력점으로 라우팅, 없으면 메인.
export default async function ConsumerLegacy() {
  const partners = await listActivePartners();
  const fallback = partners[0]?.partnerCode;
  redirect(fallback ? `/p/${fallback}` : "/");
}
