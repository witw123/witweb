import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "友情链接",
  description: "浏览本站收录的友情链接与推荐站点。",
  alternates: {
    canonical: "/friends",
  },
};

export default function FriendsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

