"use client";

import { useEffect, type ReactNode } from "react";
import { initErrorMonitoring } from "@/lib/monitoring";

export default function ErrorMonitoringProvider({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    initErrorMonitoring();
  }, []);

  return <>{children}</>;
}
