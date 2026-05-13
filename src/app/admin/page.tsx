import { redirect } from "next/navigation";
import { auth } from "@/auth";

// /admin entry point — routes user to the right console based on role.
export default async function AdminEntry() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Fadmin");
  if (session.user.role === "hq") redirect("/admin/super");
  if (session.user.role === "partner_admin") redirect("/admin/franchise");
  if (session.user.role === "seller") redirect("/admin/seller");
  redirect("/login");
}
