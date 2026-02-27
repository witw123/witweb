CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  nickname TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  bio TEXT,
  balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_notifications_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01 00:00:00+00',
  is_bot INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS follows (
  id BIGSERIAL PRIMARY KEY,
  follower TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  following TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower, following)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

CREATE TABLE IF NOT EXISTS posts (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  author TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  tags TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  view_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_posts_category_id ON posts(category_id);

CREATE TABLE IF NOT EXISTS friend_links (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_friend_links_sort_order ON friend_links(sort_order);

CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parent_id BIGINT REFERENCES comments(id) ON DELETE SET NULL,
  ip_address TEXT
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

CREATE TABLE IF NOT EXISTS likes (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, username)
);
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);

CREATE TABLE IF NOT EXISTS dislikes (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, username)
);
CREATE INDEX IF NOT EXISTS idx_dislikes_post ON dislikes(post_id);

CREATE TABLE IF NOT EXISTS comment_votes (
  id BIGSERIAL PRIMARY KEY,
  comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  value INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, username)
);

CREATE TABLE IF NOT EXISTS favorites (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, username)
);
CREATE INDEX IF NOT EXISTS idx_favorites_post ON favorites(post_id);

CREATE TABLE IF NOT EXISTS site_visits (
  id BIGSERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  page_url TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_site_visits_visitor ON site_visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_created_at ON site_visits(created_at);

CREATE TABLE IF NOT EXISTS unique_visitors (
  id BIGSERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL UNIQUE,
  last_visit TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visit_count INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_unique_visitors_last_visit ON unique_visitors(last_visit);

CREATE TABLE IF NOT EXISTS video_tasks (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  prompt TEXT,
  model TEXT,
  url TEXT,
  aspect_ratio TEXT,
  duration INTEGER,
  remix_target_id TEXT,
  size TEXT,
  pid TEXT,
  timestamps TEXT,
  result_json TEXT,
  failure_reason TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_tasks_user_created ON video_tasks(username, created_at DESC);

CREATE TABLE IF NOT EXISTS video_results (
  id BIGSERIAL PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES video_tasks(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  remove_watermark BOOLEAN NOT NULL DEFAULT FALSE,
  pid TEXT,
  character_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_results_task ON video_results(task_id, created_at ASC);

CREATE TABLE IF NOT EXISTS characters (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  character_id TEXT NOT NULL UNIQUE,
  name TEXT,
  source_task_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_characters_user_created ON characters(username, created_at DESC);

CREATE TABLE IF NOT EXISTS studio_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS studio_history (
  id BIGSERIAL PRIMARY KEY,
  file TEXT,
  prompt TEXT,
  time BIGINT,
  task_id TEXT,
  pid TEXT,
  url TEXT,
  duration_seconds INTEGER
);
CREATE INDEX IF NOT EXISTS idx_studio_history_time ON studio_history(time DESC);

CREATE TABLE IF NOT EXISTS studio_task_times (
  task_id TEXT PRIMARY KEY,
  ts BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_active_tasks (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL DEFAULT '',
  start_time BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  user1 TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  user2 TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  last_message TEXT,
  last_time TIMESTAMPTZ,
  unread_count_user1 INTEGER NOT NULL DEFAULT 0,
  unread_count_user2 INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user1, user2)
);
CREATE INDEX IF NOT EXISTS idx_conv_user1 ON conversations(user1);
CREATE INDEX IF NOT EXISTS idx_conv_user2 ON conversations(user2);

CREATE TABLE IF NOT EXISTS private_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  receiver TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON private_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_msg_sender ON private_messages(sender);
CREATE INDEX IF NOT EXISTS idx_msg_receiver ON private_messages(receiver);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  goal TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  model TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user_created ON agent_runs(username, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_steps (
  id BIGSERIAL PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  step_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_agent_steps_run ON agent_steps(run_id, id ASC);

CREATE TABLE IF NOT EXISTS agent_artifacts (
  id BIGSERIAL PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_artifacts_run_kind ON agent_artifacts(run_id, kind, id DESC);

CREATE TABLE IF NOT EXISTS topic_sources (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'rss',
  parser_config_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_fetch_status TEXT NOT NULL DEFAULT 'idle',
  last_fetch_error TEXT NOT NULL DEFAULT '',
  last_fetched_at TIMESTAMPTZ,
  last_fetch_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_topic_sources_user ON topic_sources(created_by, enabled, id DESC);

CREATE TABLE IF NOT EXISTS topic_items (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES topic_sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '{}',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, url)
);
CREATE INDEX IF NOT EXISTS idx_topic_items_source ON topic_items(source_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_items_score ON topic_items(score DESC, published_at DESC);

CREATE TABLE IF NOT EXISTS topic_keywords (
  id BIGSERIAL PRIMARY KEY,
  keyword TEXT NOT NULL,
  weight DOUBLE PRECISION NOT NULL DEFAULT 10,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (created_by, keyword)
);
CREATE INDEX IF NOT EXISTS idx_topic_keywords_user ON topic_keywords(created_by, enabled, id DESC);

CREATE TABLE IF NOT EXISTS radar_notifications (
  id BIGSERIAL PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'webhook',
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_radar_notifications_user ON radar_notifications(created_by, enabled, id DESC);

CREATE TABLE IF NOT EXISTS radar_alert_rules (
  id BIGSERIAL PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  keyword TEXT NOT NULL DEFAULT '',
  source_id BIGINT REFERENCES topic_sources(id) ON DELETE SET NULL,
  min_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  channel_id BIGINT NOT NULL REFERENCES radar_notifications(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_radar_alert_rules_user ON radar_alert_rules(created_by, enabled, id DESC);

CREATE TABLE IF NOT EXISTS radar_alert_logs (
  id BIGSERIAL PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES topic_items(id) ON DELETE CASCADE,
  channel_id BIGINT NOT NULL REFERENCES radar_notifications(id) ON DELETE CASCADE,
  rule_id BIGINT NOT NULL REFERENCES radar_alert_rules(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  response_text TEXT NOT NULL DEFAULT '',
  error_text TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, channel_id, rule_id)
);
CREATE INDEX IF NOT EXISTS idx_radar_alert_logs_user ON radar_alert_logs(created_by, sent_at DESC);

CREATE TABLE IF NOT EXISTS radar_topics (
  id BIGSERIAL PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'item',
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_radar_topics_user ON radar_topics(created_by, id DESC);

CREATE TABLE IF NOT EXISTS secure_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
