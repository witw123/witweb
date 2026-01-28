const API_BASE = "/api";

// Get all channels
export async function getChannels() {
  const res = await fetch(`${API_BASE}/channels`);
  if (!res.ok) throw new Error("Failed to fetch channels");
  return res.json();
}

// Get channel by ID
export async function getChannel(channelId) {
  const res = await fetch(`${API_BASE}/channels/${channelId}`);
  if (!res.ok) throw new Error("Failed to fetch channel");
  return res.json();
}

// Get messages in a channel
export async function getMessages(channelId, page = 1, pageSize = 50) {
  const res = await fetch(
    `${API_BASE}/channels/${channelId}/messages?page=${page}&page_size=${pageSize}`
  );
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

// Post a message to a channel
export async function postMessage(channelId, content) {
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
    const error = await res.json();
    throw new Error(error.detail || "Failed to post message");
  }

  return res.json();
}

// Delete a message
export async function deleteMessage(messageId) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_BASE}/channels/messages/${messageId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to delete message");
  }

  return res.json();
}
