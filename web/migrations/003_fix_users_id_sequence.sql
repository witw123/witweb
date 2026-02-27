-- 修复历史库中 users.id 非标准自增问题
-- 目标：确保 users.id 默认值为 nextval(sequence)，并与当前最大 id 对齐

DO $$
DECLARE
  seq_name TEXT;
  max_id BIGINT;
BEGIN
  SELECT pg_get_serial_sequence('users', 'id') INTO seq_name;

  IF seq_name IS NULL THEN
    IF to_regclass('public.users_id_seq') IS NULL THEN
      EXECUTE 'CREATE SEQUENCE public.users_id_seq';
    END IF;
    EXECUTE 'ALTER SEQUENCE public.users_id_seq OWNED BY users.id';
    EXECUTE 'ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval(''public.users_id_seq'')';
    seq_name := 'public.users_id_seq';
  END IF;

  EXECUTE 'SELECT COALESCE(MAX(id), 0) FROM users' INTO max_id;
  EXECUTE format('SELECT setval(%L, %s, true)', seq_name, max_id);
END
$$;
