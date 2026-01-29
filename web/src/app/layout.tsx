import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./providers";
import LegacyLayout from "@/components/LegacyLayout";

export const metadata: Metadata = {
  title: "witweb",
  description: "Sora2 Web Studio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <LegacyLayout>{children}</LegacyLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
