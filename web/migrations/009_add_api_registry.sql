CREATE TABLE IF NOT EXISTS api_providers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  protocol_type TEXT NOT NULL,
  auth_scheme TEXT NOT NULL,
  docs_url TEXT NOT NULL DEFAULT '',
  default_base_url TEXT NOT NULL DEFAULT '',
  supports_models BOOLEAN NOT NULL DEFAULT FALSE,
  supports_custom_headers BOOLEAN NOT NULL DEFAULT FALSE,
  supports_webhook BOOLEAN NOT NULL DEFAULT FALSE,
  is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config_schema_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_connections (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES api_providers(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  organization_id TEXT NOT NULL DEFAULT '',
  project_id TEXT NOT NULL DEFAULT '',
  api_version TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  is_default_candidate BOOLEAN NOT NULL DEFAULT FALSE,
  public_config_json TEXT NOT NULL DEFAULT '{}',
  secret_config_encrypted TEXT NOT NULL DEFAULT '',
  last_checked_at TIMESTAMPTZ,
  last_check_status TEXT NOT NULL DEFAULT 'unknown',
  last_check_message TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_connections_provider_id ON api_connections(provider_id);
CREATE INDEX IF NOT EXISTS idx_api_connections_status ON api_connections(status);

CREATE TABLE IF NOT EXISTS api_bindings (
  capability TEXT PRIMARY KEY,
  connection_id TEXT REFERENCES api_connections(id) ON DELETE SET NULL,
  model_override TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by TEXT NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO api_providers (
  id,
  code,
  name,
  category,
  protocol_type,
  auth_scheme,
  docs_url,
  default_base_url,
  supports_models,
  supports_custom_headers,
  supports_webhook,
  is_builtin,
  enabled,
  config_schema_json
)
VALUES
  ('provider_openai', 'openai', 'OpenAI', 'llm', 'openai_compatible', 'bearer', 'https://platform.openai.com/docs/api-reference', 'https://api.openai.com/v1', TRUE, TRUE, FALSE, TRUE, TRUE, '{"fields":["base_url","api_key","model","organization_id","project_id","extra_headers"]}'),
  ('provider_gemini', 'gemini', 'Gemini', 'llm', 'openai_compatible', 'bearer', 'https://ai.google.dev/gemini-api/docs/openai', 'https://generativelanguage.googleapis.com/v1beta/openai', TRUE, TRUE, FALSE, TRUE, TRUE, '{"fields":["base_url","api_key","model","extra_headers"]}'),
  ('provider_deepseek', 'deepseek', 'DeepSeek', 'llm', 'openai_compatible', 'bearer', 'https://api-docs.deepseek.com/', 'https://api.deepseek.com/v1', TRUE, TRUE, FALSE, TRUE, TRUE, '{"fields":["base_url","api_key","model","extra_headers"]}'),
  ('provider_dashscope', 'dashscope', 'DashScope', 'llm', 'openai_compatible', 'bearer', 'https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope', 'https://dashscope.aliyuncs.com/compatible-mode/v1', TRUE, TRUE, FALSE, TRUE, TRUE, '{"fields":["base_url","api_key","model","extra_headers"]}'),
  ('provider_openrouter', 'openrouter', 'OpenRouter', 'llm', 'openai_compatible', 'bearer', 'https://openrouter.ai/docs/api-reference/overview', 'https://openrouter.ai/api/v1', TRUE, TRUE, FALSE, TRUE, TRUE, '{"fields":["base_url","api_key","model","extra_headers"]}'),
  ('provider_anthropic', 'anthropic', 'Anthropic', 'llm', 'anthropic', 'x_api_key', 'https://docs.anthropic.com/en/api/messages', 'https://api.anthropic.com/v1', TRUE, TRUE, FALSE, TRUE, TRUE, '{"fields":["base_url","api_key","model","anthropic_version","extra_headers"]}'),
  ('provider_dify', 'dify', 'Dify', 'integration', 'dify', 'bearer', 'https://docs.dify.ai/api-reference', '', TRUE, TRUE, FALSE, TRUE, TRUE, '{"fields":["base_url","api_key","app_id","workflow_id","extra_headers"]}'),
  ('provider_n8n', 'n8n', 'n8n', 'integration', 'webhook', 'token', 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/', '', FALSE, TRUE, TRUE, TRUE, TRUE, '{"fields":["webhook_url","token","secret","extra_headers"]}'),
  ('provider_custom_openai', 'custom_openai', 'Custom OpenAI Compatible', 'llm', 'openai_compatible', 'bearer', '', '', TRUE, TRUE, FALSE, TRUE, TRUE, '{"fields":["base_url","api_key","model","extra_headers"]}'),
  ('provider_custom_webhook', 'custom_webhook', 'Custom Webhook', 'integration', 'webhook', 'token', '', '', FALSE, TRUE, TRUE, TRUE, TRUE, '{"fields":["webhook_url","token","secret","extra_headers"]}')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  protocol_type = EXCLUDED.protocol_type,
  auth_scheme = EXCLUDED.auth_scheme,
  docs_url = EXCLUDED.docs_url,
  default_base_url = EXCLUDED.default_base_url,
  supports_models = EXCLUDED.supports_models,
  supports_custom_headers = EXCLUDED.supports_custom_headers,
  supports_webhook = EXCLUDED.supports_webhook,
  is_builtin = EXCLUDED.is_builtin,
  enabled = EXCLUDED.enabled,
  config_schema_json = EXCLUDED.config_schema_json,
  updated_at = NOW();
