import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./providers";
import LegacyLayout from "@/components/LegacyLayout";
import { getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "witweb",
    template: "%s | witweb",
  },
  description: "WitWeb 社区：文章、分类、收藏、互动与创作。",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "witweb",
    title: "witweb",
    description: "WitWeb 社区：文章、分类、收藏、互动与创作。",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "witweb",
    description: "WitWeb 社区：文章、分类、收藏、互动与创作。",
  },
  robots: {
    index: true,
    follow: true,
  },
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
