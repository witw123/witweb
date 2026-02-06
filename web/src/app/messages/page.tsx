import { Suspense } from "react";
import MessagesPageContent from "@/features/messages/components/MessagesPageContent";

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-zinc-500">加载中...</div>}>
      <MessagesPageContent />
    </Suspense>
  );
}

