"use client";

import { useEffect } from "react";
import { useAuth } from "@/app/providers";
import { getVersionedApiPath } from "@/lib/api-version";

// Generate a unique visitor ID and store it in localStorage
function getVisitorId(): string {
  if (typeof window === "undefined") return "";

  let visitorId = localStorage.getItem("visitor_id");
  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("visitor_id", visitorId);
  }
  return visitorId;
}

export default function VisitTracker() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    const trackVisit = async () => {
      try {
        const visitorId = getVisitorId();
        const pageUrl = window.location.pathname;

        await fetch(getVersionedApiPath("/track-visit"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ visitorId, pageUrl }),
        });
      } catch (error) {
        console.error("Failed to track visit:", error);
      }
    };

    // Track visit on mount
    trackVisit();
  }, [isAuthenticated]);

  return null; // This component doesn't render anything
}
