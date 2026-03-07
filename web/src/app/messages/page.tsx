import dynamic from "next/dynamic";

const MessagesPageContent = dynamic(
  () => import("@/features/messages/components/MessagesPageContent"),
  { loading: () => <div className="app-loading-fallback">加载中...</div> }
);

export default function MessagesPage() {
  return <MessagesPageContent />;
}
