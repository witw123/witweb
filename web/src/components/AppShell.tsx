"use client";

import { usePathname } from "next/navigation";
import LegacyLayout from "@/components/LegacyLayout";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) {
    return <>{children}</>;
  }
  return <LegacyLayout>{children}</LegacyLayout>;
}

