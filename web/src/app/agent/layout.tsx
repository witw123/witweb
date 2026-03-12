import RequireAuth from "@/components/RequireAuth";
import { AgentChatLayout } from "@/features/agent/components/AgentChatLayout";

export const dynamic = "force-dynamic";

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AgentChatLayout>{children}</AgentChatLayout>
    </RequireAuth>
  );
}
