CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE agent_goals
  ADD COLUMN IF NOT EXISTS task_type TEXT,
  ADD COLUMN IF NOT EXISTS template_id TEXT REFERENCES prompt_templates(id) ON DELETE SET NULL;

ALTER TABLE prompt_templates
  ADD COLUMN IF NOT EXISTS assistant_name TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS knowledge_chunk_embeddings (
  chunk_id BIGINT PRIMARY KEY REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding VECTOR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_deliveries (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  goal_id TEXT REFERENCES agent_goals(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload_json TEXT NOT NULL DEFAULT '{}',
  response_code INTEGER,
  response_body_preview TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_deliveries_username ON content_deliveries(username);
CREATE INDEX IF NOT EXISTS idx_content_deliveries_goal_id ON content_deliveries(goal_id);
CREATE INDEX IF NOT EXISTS idx_content_deliveries_created_at ON content_deliveries(created_at);
