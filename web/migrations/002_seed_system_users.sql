-- 初始化系统内置用户（幂等）
-- 注意：首次插入管理员 witw 的默认密码为 witw，生产环境请立即修改

INSERT INTO users (
  id,
  username,
  password,
  role,
  nickname,
  avatar_url,
  cover_url,
  bio,
  balance,
  is_bot
)
SELECT
  COALESCE(MAX(id), 0) + 1,
  'witw',
  '$2a$10$GSrjwYN8D7FQnDJi5xcPzufnr8Lv6q3AvtcAesCqr1J9gPT6CKOqe',
  'admin',
  'witw',
  '',
  '',
  '',
  0,
  0
FROM users
ON CONFLICT (username) DO UPDATE
SET role = 'admin';

INSERT INTO users (
  id,
  username,
  password,
  role,
  nickname,
  avatar_url,
  cover_url,
  bio,
  balance,
  is_bot
)
SELECT
  COALESCE(MAX(id), 0) + 1,
  'WitAI',
  '$2a$10$58ap.78k1fLaAkt5JXboiei6CUc9T3f422LR9pF5Y8ZKoW/Kc.l72',
  'bot',
  'WitWeb Assistant',
  '',
  '',
  'I am WitWeb''s AI assistant.',
  0,
  1
FROM users
ON CONFLICT (username) DO UPDATE
SET role = 'bot',
    is_bot = 1;
