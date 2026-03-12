ALTER TABLE agent_messages
  ADD COLUMN IF NOT EXISTS meta_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS agent_conversation_memory (
  conversation_id TEXT PRIMARY KEY REFERENCES agent_conversations(id) ON DELETE CASCADE,
  username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  key_points_json TEXT NOT NULL DEFAULT '[]',
  turn_count INTEGER NOT NULL DEFAULT 0,
  last_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversation_memory_username
  ON agent_conversation_memory(username);

CREATE TABLE IF NOT EXISTS agent_user_memory (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  memory_key TEXT NOT NULL,
  memory_value TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'explicit_user_preference',
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(username, memory_key, memory_value)
);

CREATE INDEX IF NOT EXISTS idx_agent_user_memory_username
  ON agent_user_memory(username);
