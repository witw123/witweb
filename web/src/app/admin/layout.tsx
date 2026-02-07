"use client";

import AdminLayout from "@/features/admin/components/AdminLayout";
import { usePathname } from "next/navigation";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }
  return <AdminLayout>{children}</AdminLayout>;
}
