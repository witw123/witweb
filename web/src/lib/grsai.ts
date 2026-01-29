import { getApiBaseUrl, getApiToken } from "./api-config";

async function request(method: string, endpoint: string, body?: any) {
  const base = getApiBaseUrl();
  const token = getApiToken();
  const res = await fetch(`${base}${endpoint}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify({ ...body, token }) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.code !== 0) throw new Error(data?.msg || "API error");
  return data?.data || {};
}

export async function getCredits() {
  const data = await request("POST", "/client/openapi/getCredits", {});
  return data?.credits || 0;
}

export async function createApiKey(payload: any) {
  return request("POST", "/client/openapi/createAPIKey", payload);
}

export async function getApiKeyCredits(apiKey: string) {
  const data = await request("POST", "/client/openapi/getAPIKeyCredits", { apiKey });
  return data?.credits || 0;
}

export async function getModelStatus(model: string) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/client/common/getModelStatus?model=${encodeURIComponent(model)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.code !== 0) throw new Error(data?.msg || "API error");
  return data?.data || {};
}
