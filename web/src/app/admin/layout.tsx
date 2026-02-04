"use client";

import AdminLayout from "@/features/admin/components/AdminLayout";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
