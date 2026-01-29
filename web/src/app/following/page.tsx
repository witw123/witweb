"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "../providers";
import Link from "next/link";

export default function FollowingPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/following?page=1&size=20`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then((data) => setItems(data.items || []));
  }, [token]);

  return (
    <RequireAuth>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">????</h1>
        {items.map((user) => (
          <Link key={user.username} href={`/user/${user.username}`} className="card p-4 block">
            <div className="font-semibold">{user.nickname || user.username}</div>
            <div className="text-xs text-zinc-500">?? {user.following_count} ? ?? {user.follower_count}</div>
          </Link>
        ))}
      </div>
    </RequireAuth>
  );
}
