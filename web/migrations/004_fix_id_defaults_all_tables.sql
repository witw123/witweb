-- 修复历史库中多个表 id 列无默认自增的问题
-- 场景：旧表已存在，且 id 为 NOT NULL，但没有 DEFAULT nextval(...)

DO $$
DECLARE
  tbl TEXT;
  seq_name TEXT;
  max_id BIGINT;
  tables TEXT[] := ARRAY[
    'users',
    'follows',
    'categories',
    'posts',
    'friend_links',
    'comments',
    'likes',
    'dislikes',
    'comment_votes',
    'favorites',
    'site_visits',
    'unique_visitors',
    'video_results',
    'characters',
    'studio_history',
    'conversations',
    'private_messages',
    'agent_steps',
    'agent_artifacts',
    'topic_sources',
    'topic_items',
    'topic_keywords',
    'radar_notifications',
    'radar_alert_rules',
    'radar_alert_logs',
    'radar_topics'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'id'
    ) THEN
      SELECT pg_get_serial_sequence(format('public.%I', tbl), 'id') INTO seq_name;

      IF seq_name IS NULL THEN
        seq_name := format('public.%I_id_seq', tbl);
        IF to_regclass(seq_name) IS NULL THEN
          EXECUTE format('CREATE SEQUENCE %s', seq_name);
        END IF;
        EXECUTE format('ALTER SEQUENCE %s OWNED BY public.%I.id', seq_name, tbl);
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT nextval(%L)', tbl, seq_name);
      END IF;

      EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM public.%I', tbl) INTO max_id;
      IF max_id < 1 THEN
        EXECUTE format('SELECT setval(%L, 1, false)', seq_name);
      ELSE
        EXECUTE format('SELECT setval(%L, %s, true)', seq_name, max_id);
      END IF;
    END IF;
  END LOOP;
END
$$;
