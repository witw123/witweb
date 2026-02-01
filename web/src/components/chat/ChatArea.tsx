"use client";

import { useChat } from "@/context/ChatContext";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

export default function ChatArea() {
  const { activeChannelId } = useChat();

  /* Background Glow Effect */
  const Background = () => (
    <div className="absolute top-0 right-0 w-2/3 h-2/3 bg-indigo-900/10 blur-[100px] pointer-events-none rounded-full translate-x-1/2 -translate-y-1/2 opacity-50" />
  );

  if (!activeChannelId) {
    return (
      <div className="flex-1 bg-[#1e1f23] flex items-center justify-center text-zinc-500">
        Select a channel to start chatting
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 relative bg-[#313338]/0">
      <Background />

      <ChatHeader />

      <MessageList />

      <ChatInput />
    </div>
  );
}
