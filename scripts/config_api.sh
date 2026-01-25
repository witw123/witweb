#!/usr/bin/env bash
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:8000}"

read -r -p "API Key (留空跳过): " API_KEY
read -r -p "Token (留空跳过): " TOKEN
read -r -p "Host Mode [auto|domestic|overseas] (留空跳过): " HOST_MODE

if [ -n "$API_KEY" ]; then
  curl -sS -X POST "$SERVER_URL/config/api-key" \
    -H "Content-Type: application/json" \
    -d "{\"api_key\": \"$API_KEY\"}" >/dev/null
  echo "API Key 已配置"
fi

if [ -n "$TOKEN" ]; then
  curl -sS -X POST "$SERVER_URL/config/token" \
    -H "Content-Type: application/json" \
    -d "{\"token\": \"$TOKEN\"}" >/dev/null
  echo "Token 已配置"
fi

if [ -n "$HOST_MODE" ]; then
  curl -sS -X POST "$SERVER_URL/config/host-mode" \
    -H "Content-Type: application/json" \
    -d "{\"host_mode\": \"$HOST_MODE\"}" >/dev/null
  echo "Host Mode 已配置"
fi

if [ -z "$API_KEY" ] && [ -z "$TOKEN" ] && [ -z "$HOST_MODE" ]; then
  echo "未输入任何配置，已退出"
fi
