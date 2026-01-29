"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../providers";

export default function UserProfilePage() {
  const { username } = useParams();
  const { token } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/users/${username}/profile`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => res.json())
      .then(setProfile);
  }, [username, token]);

  async function toggleFollow() {
    if (!token) {
      router.push("/login");
      return;
    }
    if (profile?.is_following) {
      await fetch(`/api/follow/${username}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    } else {
      await fetch(`/api/follow`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ username }) });
    }
    const data = await fetch(`/api/users/${username}/profile`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then((r) => r.json());
    setProfile(data);
  }

  if (!profile) return <div>鍔犺浇涓?..</div>;

  return (
    <div className="card p-6 space-y-3">
      <div className="text-xl font-semibold">{profile.nickname || profile.username}</div>
      <div className="text-sm text-zinc-500">@{profile.username}</div>
      <div className="text-sm text-zinc-400">鍏虫敞 {profile.following_count} 路 绮変笣 {profile.follower_count}</div>
      <button className="btn-primary w-32" onClick={toggleFollow}>{profile.is_following ? "鍙栨秷鍏虫敞" : "鍏虫敞"}</button>
    </div>
  );
}

