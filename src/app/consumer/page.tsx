import { redirect } from "next/navigation";

// Legacy URL — canonical is now /p/[partnerCode].
export default function ConsumerLegacy() {
  redirect("/p/gangnam-skmagic");
}
