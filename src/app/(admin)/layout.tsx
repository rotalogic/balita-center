import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/chrome";
import { currentUser, hasPermission } from "@/lib/current-user";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  // Peran tanpa akses dashboard (orang tua/murid) diarahkan ke portalnya sendiri.
  if (!hasPermission(user, "dashboard.view")) redirect("/connect");

  return <AdminShell>{children}</AdminShell>;
}
