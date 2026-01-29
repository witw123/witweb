const API_BASE = "/api";

export async function getChannels() {
  const res = await fetch(`${API_BASE}/channels`);
  if (!res.ok) throw new Error("Failed to fetch channels");
  return res.json();
}

export async function getChannel(channelId: string | number) {
  const res = await fetch(`${API_BASE}/channels/${channelId}`);
  if (!res.ok) throw new Error("Failed to fetch channel");
  return res.json();
}

export async function getMessages(channelId: string | number, page = 1, pageSize = 50) {
  const res = await fetch(
    `${API_BASE}/channels/${channelId}/messages?page=${page}&page_size=${pageSize}`,
  );
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export async function postMessage(channelId: string | number, content: string) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to post message");
  }

  return res.json();
}

export async function deleteMessage(messageId: string | number) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_BASE}/channels/messages/${messageId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to delete message");
  }

  return res.json();
}
