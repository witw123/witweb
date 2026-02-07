import { Suspense } from "react";
import MessagesPageContent from "@/features/messages/components/MessagesPageContent";

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="app-loading-fallback">加载中...</div>}>
      <MessagesPageContent />
    </Suspense>
  );
}
