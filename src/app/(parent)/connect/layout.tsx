import type { ReactNode } from "react";
import { ParentShell } from "@/components/chrome";

export default function ConnectLayout({ children }: { children: ReactNode }) {
  return <ParentShell>{children}</ParentShell>;
}
