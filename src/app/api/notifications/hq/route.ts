import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getHqNotifications } from "@/lib/hqNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const data = await getHqNotifications();
  return NextResponse.json(data);
}
