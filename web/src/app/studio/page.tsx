"use client";

export default function StudioPage() {
  return (
    <div className="card p-4">
      <iframe src="/studio-static/index.html?embed=true" className="w-full" style={{ height: "80vh", border: "none" }} />
    </div>
  );
}
