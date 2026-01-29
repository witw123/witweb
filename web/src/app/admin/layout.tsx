"use client";

import AdminLayout from "@/components/legacy/admin/AdminLayout";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
