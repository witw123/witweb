CREATE TABLE IF NOT EXISTS agent_conversations (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  last_message_preview TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_username ON agent_conversations(username);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_updated_at ON agent_conversations(updated_at DESC);

ALTER TABLE agent_goals
  ADD COLUMN IF NOT EXISTS conversation_id TEXT REFERENCES agent_conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_agent_goals_conversation_id ON agent_goals(conversation_id);

CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  goal_id TEXT REFERENCES agent_goals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_id ON agent_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_goal_id ON agent_messages(goal_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created_at ON agent_messages(created_at);

INSERT INTO agent_conversations (id, username, title, last_message_preview, status, created_at, updated_at)
SELECT
  'conv_' || substr(md5(g.id || ':' || g.username), 1, 24),
  g.username,
  left(g.goal, 80),
  left(COALESCE(NULLIF(g.summary, ''), g.goal), 120),
  'active',
  g.created_at,
  g.updated_at
FROM agent_goals g
WHERE g.conversation_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE agent_goals g
SET conversation_id = 'conv_' || substr(md5(g.id || ':' || g.username), 1, 24)
WHERE g.conversation_id IS NULL;

INSERT INTO agent_messages (id, conversation_id, role, content, goal_id, created_at)
SELECT
  'msg_user_' || substr(md5(g.id || ':user'), 1, 24),
  g.conversation_id,
  'user',
  g.goal,
  g.id,
  g.created_at
FROM agent_goals g
WHERE g.conversation_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO agent_messages (id, conversation_id, role, content, goal_id, created_at)
SELECT
  'msg_assistant_' || substr(md5(g.id || ':assistant'), 1, 24),
  g.conversation_id,
  'assistant',
  COALESCE(NULLIF(g.summary, ''), ''),
  g.id,
  g.updated_at
FROM agent_goals g
WHERE g.conversation_id IS NOT NULL AND COALESCE(NULLIF(g.summary, ''), '') <> ''
ON CONFLICT (id) DO NOTHING;
