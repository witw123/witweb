import "server-only";

import { pgQuery, pgQueryOne, pgRun } from "@/lib/postgres-query";

export interface ApiProviderRow {
  id: string;
  code: string;
  name: string;
  category: string;
  protocol_type: string;
  auth_scheme: string;
  docs_url: string;
  default_base_url: string;
  supports_models: boolean;
  supports_custom_headers: boolean;
  supports_webhook: boolean;
  is_builtin: boolean;
  enabled: boolean;
  config_schema_json: string;
  created_at: string;
  updated_at: string;
}

export interface ApiConnectionRow {
  id: string;
  provider_id: string;
  name: string;
  base_url: string;
  model: string;
  organization_id: string;
  project_id: string;
  api_version: string;
  status: string;
  is_default_candidate: boolean;
  public_config_json: string;
  secret_config_encrypted: string;
  last_checked_at: string | null;
  last_check_status: string;
  last_check_message: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ApiBindingRow {
  capability: string;
  connection_id: string | null;
  model_override: string;
  enabled: boolean;
  updated_by: string;
  updated_at: string;
}

class ApiRegistryRepository {
  async listProviders() {
    return await pgQuery<ApiProviderRow>("SELECT * FROM api_providers ORDER BY is_builtin DESC, name ASC");
  }

  async getProviderById(id: string) {
    return await pgQueryOne<ApiProviderRow>("SELECT * FROM api_providers WHERE id = ?", [id]);
  }

  async getProviderByCode(code: string) {
    return await pgQueryOne<ApiProviderRow>("SELECT * FROM api_providers WHERE code = ?", [code]);
  }

  async createProvider(row: ApiProviderRow) {
    await pgRun(
      `INSERT INTO api_providers
       (id, code, name, category, protocol_type, auth_scheme, docs_url, default_base_url,
        supports_models, supports_custom_headers, supports_webhook, is_builtin, enabled, config_schema_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.code,
        row.name,
        row.category,
        row.protocol_type,
        row.auth_scheme,
        row.docs_url,
        row.default_base_url,
        row.supports_models,
        row.supports_custom_headers,
        row.supports_webhook,
        row.is_builtin,
        row.enabled,
        row.config_schema_json,
        row.created_at,
        row.updated_at,
      ]
    );
  }

  async updateProvider(
    id: string,
    patch: Partial<
      Pick<
        ApiProviderRow,
        | "name"
        | "category"
        | "protocol_type"
        | "auth_scheme"
        | "docs_url"
        | "default_base_url"
        | "supports_models"
        | "supports_custom_headers"
        | "supports_webhook"
        | "enabled"
        | "config_schema_json"
        | "updated_at"
      >
    >
  ) {
    const fields: string[] = [];
    const values: unknown[] = [];
    const add = (field: string, value: unknown) => {
      fields.push(`${field} = ?`);
      values.push(value);
    };

    if (patch.name !== undefined) add("name", patch.name);
    if (patch.category !== undefined) add("category", patch.category);
    if (patch.protocol_type !== undefined) add("protocol_type", patch.protocol_type);
    if (patch.auth_scheme !== undefined) add("auth_scheme", patch.auth_scheme);
    if (patch.docs_url !== undefined) add("docs_url", patch.docs_url);
    if (patch.default_base_url !== undefined) add("default_base_url", patch.default_base_url);
    if (patch.supports_models !== undefined) add("supports_models", patch.supports_models);
    if (patch.supports_custom_headers !== undefined) add("supports_custom_headers", patch.supports_custom_headers);
    if (patch.supports_webhook !== undefined) add("supports_webhook", patch.supports_webhook);
    if (patch.enabled !== undefined) add("enabled", patch.enabled);
    if (patch.config_schema_json !== undefined) add("config_schema_json", patch.config_schema_json);
    if (patch.updated_at !== undefined) add("updated_at", patch.updated_at);
    if (fields.length === 0) return;

    values.push(id);
    await pgRun(`UPDATE api_providers SET ${fields.join(", ")} WHERE id = ?`, values);
  }

  async listConnections() {
    return await pgQuery<
      ApiConnectionRow & {
        provider_name: string;
        provider_code: string;
        provider_protocol_type: string;
        provider_auth_scheme: string;
      }
    >(
      `SELECT c.*, p.name AS provider_name, p.code AS provider_code, p.protocol_type AS provider_protocol_type, p.auth_scheme AS provider_auth_scheme
       FROM api_connections c
       INNER JOIN api_providers p ON p.id = c.provider_id
       ORDER BY c.updated_at DESC, c.created_at DESC`
    );
  }

  async getConnectionById(id: string) {
    return await pgQueryOne<
      ApiConnectionRow & {
        provider_name: string;
        provider_code: string;
        provider_protocol_type: string;
        provider_auth_scheme: string;
      }
    >(
      `SELECT c.*, p.name AS provider_name, p.code AS provider_code, p.protocol_type AS provider_protocol_type, p.auth_scheme AS provider_auth_scheme
       FROM api_connections c
       INNER JOIN api_providers p ON p.id = c.provider_id
       WHERE c.id = ?`,
      [id]
    );
  }

  async createConnection(row: ApiConnectionRow) {
    await pgRun(
      `INSERT INTO api_connections
       (id, provider_id, name, base_url, model, organization_id, project_id, api_version, status, is_default_candidate,
        public_config_json, secret_config_encrypted, last_checked_at, last_check_status, last_check_message,
        created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.provider_id,
        row.name,
        row.base_url,
        row.model,
        row.organization_id,
        row.project_id,
        row.api_version,
        row.status,
        row.is_default_candidate,
        row.public_config_json,
        row.secret_config_encrypted,
        row.last_checked_at,
        row.last_check_status,
        row.last_check_message,
        row.created_by,
        row.created_at,
        row.updated_at,
      ]
    );
  }

  async updateConnection(
    id: string,
    patch: Partial<
      Pick<
        ApiConnectionRow,
        | "provider_id"
        | "name"
        | "base_url"
        | "model"
        | "organization_id"
        | "project_id"
        | "api_version"
        | "status"
        | "is_default_candidate"
        | "public_config_json"
        | "secret_config_encrypted"
        | "last_checked_at"
        | "last_check_status"
        | "last_check_message"
        | "updated_at"
      >
    >
  ) {
    const fields: string[] = [];
    const values: unknown[] = [];
    const add = (field: string, value: unknown) => {
      fields.push(`${field} = ?`);
      values.push(value);
    };

    if (patch.provider_id !== undefined) add("provider_id", patch.provider_id);
    if (patch.name !== undefined) add("name", patch.name);
    if (patch.base_url !== undefined) add("base_url", patch.base_url);
    if (patch.model !== undefined) add("model", patch.model);
    if (patch.organization_id !== undefined) add("organization_id", patch.organization_id);
    if (patch.project_id !== undefined) add("project_id", patch.project_id);
    if (patch.api_version !== undefined) add("api_version", patch.api_version);
    if (patch.status !== undefined) add("status", patch.status);
    if (patch.is_default_candidate !== undefined) add("is_default_candidate", patch.is_default_candidate);
    if (patch.public_config_json !== undefined) add("public_config_json", patch.public_config_json);
    if (patch.secret_config_encrypted !== undefined) add("secret_config_encrypted", patch.secret_config_encrypted);
    if (patch.last_checked_at !== undefined) add("last_checked_at", patch.last_checked_at);
    if (patch.last_check_status !== undefined) add("last_check_status", patch.last_check_status);
    if (patch.last_check_message !== undefined) add("last_check_message", patch.last_check_message);
    if (patch.updated_at !== undefined) add("updated_at", patch.updated_at);
    if (fields.length === 0) return;

    values.push(id);
    await pgRun(`UPDATE api_connections SET ${fields.join(", ")} WHERE id = ?`, values);
  }

  async deleteConnection(id: string) {
    return await pgRun("DELETE FROM api_connections WHERE id = ?", [id]);
  }

  async countBindingsByConnection(id: string) {
    const row = await pgQueryOne<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM api_bindings WHERE connection_id = ?",
      [id]
    );
    return Number(row?.count || 0);
  }

  async listBindings() {
    return await pgQuery<
      ApiBindingRow & {
        connection_name: string | null;
        provider_name: string | null;
        provider_code: string | null;
      }
    >(
      `SELECT b.*,
              c.name AS connection_name,
              p.name AS provider_name,
              p.code AS provider_code
       FROM api_bindings b
       LEFT JOIN api_connections c ON c.id = b.connection_id
       LEFT JOIN api_providers p ON p.id = c.provider_id
       ORDER BY b.capability ASC`
    );
  }

  async getBinding(capability: string) {
    return await pgQueryOne<ApiBindingRow>("SELECT * FROM api_bindings WHERE capability = ?", [capability]);
  }

  async upsertBinding(row: ApiBindingRow) {
    await pgRun(
      `INSERT INTO api_bindings (capability, connection_id, model_override, enabled, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(capability) DO UPDATE SET
         connection_id = excluded.connection_id,
         model_override = excluded.model_override,
         enabled = excluded.enabled,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`,
      [row.capability, row.connection_id, row.model_override, row.enabled, row.updated_by, row.updated_at]
    );
  }
}

export const apiRegistryRepository = new ApiRegistryRepository();
