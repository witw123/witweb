"use client";

import { useEffect, useState } from "react";

export default function Footer() {
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalVisits: 0,
    totalVisitors: 0,
  });
  const [runningDays, setRunningDays] = useState(0);

  useEffect(() => {
    // Calculate running days since site launch
    const launchDate = new Date("2026-01-28");
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - launchDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setRunningDays(diffDays);

    // Fetch site statistics
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats({
          totalPosts: data.totalPosts || 0,
          totalVisits: data.totalVisits || 0,
          totalVisitors: data.totalVisitors || 0,
        });
      })
      .catch(() => {
        // Use default values if API fails
      });
  }, []);

  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-white/10 bg-gradient-to-b from-transparent to-black/20">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row items-center justify-center gap-0 text-sm text-gray-400">
          {/* Copyright */}
          <div className="flex items-center gap-2">
            <span>Copyright © 2026 - {currentYear}</span>
            <span className="text-blue-400 font-medium">WitWeb</span>
            <span className="hidden md:inline">|</span>
            <span className="hidden md:inline">Powered by Next.js</span>
          </div>

          {/* Separator */}
          <span className="hidden md:inline text-white/20">|</span>

          {/* Statistics */}
          <div className="flex items-center gap-1 flex-wrap justify-center text-xs md:text-sm">
            <span>文章总数: <span className="text-white font-medium">{stats.totalPosts}</span></span>

            <span className="text-white/20">|</span>

            <span>总访问量: <span className="text-white font-medium">{stats.totalVisits}</span></span>

            <span className="text-white/20">|</span>

            <span>总访问人数: <span className="text-white font-medium">{stats.totalVisitors}</span></span>
          </div>

          {/* Separator */}
          <span className="hidden md:inline text-white/20">|</span>

          {/* Running days */}
          <div className="text-xs md:text-sm">
            <span>本站已运行 <span className="text-white font-medium">{runningDays}</span> 天</span>
          </div>
        </div>

        {/* ICP Filing */}
        <div className="mt-0 text-center text-xs text-gray-500">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            皖ICP备2026003097号
          </a>
        </div>
      </div>
    </footer>
  );
}
