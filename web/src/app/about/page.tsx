import type { Metadata } from "next";
import AboutPage from "@/features/about/components/AboutPage";

export const metadata: Metadata = {
  title: "关于我",
  description: "了解站点作者的背景、方向与实践。",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutRoutePage() {
  return <AboutPage />;
}
