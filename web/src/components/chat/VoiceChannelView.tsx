"use client";

import { useChat } from "@/context/ChatContext";
import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  LayoutContextProvider,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";

export default function VoiceChannelView() {
  const { activeChannelId, channels, userProfile } = useChat();
  const channel = channels.find(c => c.id === activeChannelId);
  const [token, setToken] = useState("");

  // Determine Identity
  const user = userProfile || { username: "guest", nickname: "Guest" };
  const username = user.username || "guest_" + Date.now();
  const roomName = activeChannelId;

  // Fetch Token
  useEffect(() => {
    if (!roomName || !username) return;

    (async () => {
      try {
        const resp = await fetch(`/api/livekit/token?room=${roomName}&username=${username}`);
        const data = await resp.json();
        setToken(data.token);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [roomName, username]);

  if (!channel) return null;

  if (token === "") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#313338] text-zinc-400">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p>正在连接语音服务器...</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_API_URL}
      connect={true}
      data-lk-theme="default"
      className="flex-1 flex flex-col bg-[#313338] overflow-hidden"
    >
      <LayoutContextProvider>
        {/* Header */}
        <div className="h-12 px-4 flex items-center shadow-sm z-10 border-b border-black/20 shrink-0 bg-[#313338]">
          <svg className="w-5 h-5 text-zinc-400 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          <h3 className="font-bold text-white text-base mr-3">{channel.name}</h3>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs text-green-500 font-bold">语音已连接</span>
          </div>
        </div>

        {/* Main Content: Audio Participants Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Loop through all participants */}
            <CustomParticipantLoop />
          </div>
          <RoomAudioRenderer />
        </div>

        {/* Bottom Control Bar */}
        <div className="p-4 bg-[#1e1f22] border-t border-black/50 flex justify-center">
          <ControlBar
            variation="minimal"
            controls={{ microphone: true, camera: false, screenShare: false, chat: false, leave: true, settings: true }}
          />
        </div>
      </LayoutContextProvider>
    </LiveKitRoom>
  );
}

// Custom Component to render participants as avatars
import { useParticipants, ParticipantLoop, ParticipantContext, useParticipantContext } from "@livekit/components-react";

function CustomParticipantLoop() {
  const participants = useParticipants();

  return (
    <ParticipantLoop participants={participants}>
      <AudioParticipantTile />
    </ParticipantLoop>
  );
}

// Custom Tile Component for Audio
function AudioParticipantTile() {
  const participant = useParticipantContext();
  const isSpeaking = participant.isSpeaking;
  const identity = participant.identity || "Unknown";

  return (
    <div className={`aspect-video bg-[#2b2d31] rounded-xl flex flex-col items-center justify-center relative border-2 transition-colors ${isSpeaking ? "border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : "border-transparent"}`}>
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white mb-2 relative">
        {identity[0]?.toUpperCase()}
        {isSpeaking && (
          <span className="absolute -right-1 -bottom-1 w-4 h-4 bg-green-500 border-2 border-[#2b2d31] rounded-full"></span>
        )}
      </div>
      <div className="text-white font-medium text-sm px-2 truncate max-w-full">
        {identity}
      </div>
      <div className="absolute top-2 right-2">
        {participant.isMicrophoneEnabled ? (
          <div className="w-2 h-2 bg-zinc-500 rounded-full"></div>
        ) : (
          <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path d="M3 3l18 18" /></svg>
        )}
      </div>
    </div>
  )
}
