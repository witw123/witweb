"use client";

import { useEffect, useState } from "react";
import { getThumbnailUrl } from "@/utils/url";

interface Member {
  username: string;
  nickname?: string;
  avatar_url?: string;
  status: "online" | "idle" | "dnd" | "offline";
}

export default function MemberList({ serverId }: { serverId: number | null }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!serverId) return;

    const fetchMembers = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/channels/members?server_id=${serverId}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          // For now, mock status as online or offline based on some logic or hardcode
          const mapped: Member[] = data.map((m: any) => ({
            ...m,
            status: "online" // Default to online for now
          }));
          setMembers(mapped);
        }
      } catch (err) {
        console.error("Failed to fetch members", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [serverId]);

  if (loading && members.length === 0) {
    return (
      <aside className="member-sidebar">
        <div className="animate-pulse flex flex-col gap-4 p-4">
          <div className="h-4 bg-zinc-800 rounded w-1/2"></div>
          <div className="flex gap-2 items-center"><div className="w-8 h-8 bg-zinc-800 rounded-full"></div><div className="h-3 bg-zinc-800 rounded w-1/3"></div></div>
        </div>
      </aside>
    );
  }

  const onlineMembers = members.filter(m => m.status !== "offline");
  const offlineMembers = members.filter(m => m.status === "offline");

  return (
    <aside className="member-sidebar">
      <div className="member-group-title">在线 — {onlineMembers.length}</div>
      {onlineMembers.map(member => (
        <MemberItem key={member.username} member={member} />
      ))}

      <div className="member-group-title">离线 — {offlineMembers.length}</div>
      {offlineMembers.map(member => (
        <MemberItem key={member.username} member={member} />
      ))}
    </aside>
  );
}

function MemberItem({ member }: { member: Member }) {
  return (
    <div className="member-item">
      <div className="member-avatar">
        {member.avatar_url ? (
          <img src={getThumbnailUrl(member.avatar_url, 64)} alt="" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400 text-xs rounded-full">
            {member.username[0].toUpperCase()}
          </div>
        )}
        <div className={`status-dot status-${member.status}`}></div>
      </div>
      <div className="member-name">{member.nickname || member.username}</div>
    </div>
  );
}
