"use client";

import { useChat, ChatProvider } from "@/context/ChatContext";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";
import VoiceChannelView from "./VoiceChannelView";

function ChatContent() {
  const { isLoading, activeChannelId, channels } = useChat();
  const currentChannel = channels.find(c => c.id === activeChannelId);
  const isVoice = currentChannel?.type === "voice";

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0b] text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex w-full h-full overflow-hidden bg-[#0a0a0b]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Area */}
      {isVoice ? (
        <VoiceChannelView />
      ) : (
        <ChatArea />
      )}
    </div>
  );
}

export default function ChatLayout() {
  return (
    <ChatProvider>
      <div className="h-[calc(100vh-64px)] w-full relative">
        <ChatContent />
      </div>
    </ChatProvider>
  );
}
