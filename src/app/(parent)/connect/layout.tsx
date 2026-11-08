import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ParentShell } from "@/components/chrome";
import { currentUser, hasPermission } from "@/lib/current-user";

export default async function ConnectLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  // Portal orang tua/murid untuk peran dengan child.view_own.
  // Staf dengan students.view boleh masuk HANYA untuk pratinjau (Blok 7) —
  // aksi tulis ditolak server dan tombolnya disembunyikan di mode pratinjau.
  const ortu = hasPermission(user, "child.view_own");
  const staf = hasPermission(user, "students.view");
  if (!ortu && !staf) redirect("/");

  return <ParentShell pratinjauMungkin={!ortu && staf}>{children}</ParentShell>;
}
