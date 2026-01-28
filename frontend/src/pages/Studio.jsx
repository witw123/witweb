import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function Studio() {
  const [iframeHeight, setIframeHeight] = useState("100vh");
  const { user } = useAuth();

  useEffect(() => {
    // Optional: Adjust height logic
    const updateHeight = () => {
      setIframeHeight(`${window.innerHeight - 64}px`); // Subtract header height approximately
    };
    window.addEventListener("resize", updateHeight);
    updateHeight();
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const balance = user?.balance !== undefined ? user.balance : 0.0;

  return (
    <div style={{ width: "100%", height: "calc(100vh - 65px)", overflow: "hidden", position: "relative" }}>
      <iframe
        src="/studio-static/index.html?embed=true"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          backgroundColor: "transparent",
          display: "block"
        }}
        title="Studio"
      />
    </div>
  );
}
