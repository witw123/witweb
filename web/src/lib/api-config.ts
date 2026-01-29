import fs from "fs";
import path from "path";

const configFile = path.resolve(process.cwd(), "..", "data", "api_config.json");

function readConfig() {
  try {
    if (!fs.existsSync(configFile)) return {};
    return JSON.parse(fs.readFileSync(configFile, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(data: any) {
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify(data, null, 2));
}

export function getApiToken() {
  const cfg = readConfig();
  return cfg.grsai_token || "";
}

export function saveApiToken(token: string) {
  const cfg = readConfig();
  cfg.grsai_token = token;
  writeConfig(cfg);
}

export function getApiBaseUrl() {
  const cfg = readConfig();
  return cfg.api_base_url || "https://grsaiapi.com";
}

export function saveApiBaseUrl(baseUrl: string) {
  const cfg = readConfig();
  cfg.api_base_url = baseUrl;
  writeConfig(cfg);
}

export function getSora2Key() {
  const cfg = readConfig();
  return cfg.sora2_api_key || "";
}

export function saveSora2Key(key: string) {
  const cfg = readConfig();
  cfg.sora2_api_key = key;
  writeConfig(cfg);
}
