import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/franchise/Sidebar";
import Topbar from "@/components/franchise/Topbar";

export default async function FranchiseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const partnerCode = session?.user?.partnerId;
  const partner = partnerCode
    ? await prisma.partner.findUnique({ where: { partnerCode } })
    : null;

  return (
    <div className="grid grid-cols-[220px_1fr] min-h-screen bg-rk-admin-bg">
      <Sidebar
        user={session?.user}
        partnerName={partner?.partnerName}
      />
      <main className="px-[22px] pt-[18px] pb-[60px] max-w-[1400px]">
        <Topbar />
        {children}
      </main>
    </div>
  );
}
