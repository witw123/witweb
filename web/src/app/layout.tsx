import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import ErrorMonitoringProvider from "@/components/ErrorMonitoringProvider";
import QueryProvider from "@/components/QueryProvider";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { getSiteUrl } from "@/lib/site-url";
import { AuthProvider } from "./providers";

const siteUrl = getSiteUrl();
const siteDescription = "WitWeb community platform for publishing, discussion, and creative tools.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "witweb",
    template: "%s | witweb",
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "witweb",
    title: "witweb",
    description: siteDescription,
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "witweb",
    description: siteDescription,
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
          <QueryProvider>
            <ErrorMonitoringProvider>
              <ErrorBoundary>
                <AppShell>{children}</AppShell>
              </ErrorBoundary>
            </ErrorMonitoringProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
