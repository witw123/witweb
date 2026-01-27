import React, { useEffect, useState } from "react";

export default function Studio() {
  const [iframeHeight, setIframeHeight] = useState("100vh");

  useEffect(() => {
    // Optional: Adjust height logic
    const updateHeight = () => {
      setIframeHeight(`${window.innerHeight - 64}px`); // Subtract header height approximately
    };
    window.addEventListener("resize", updateHeight);
    updateHeight();
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  return (
    <div style={{ width: "100%", height: "calc(100vh - 65px)", overflow: "hidden" }}>
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
