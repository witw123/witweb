#!/usr/bin/env bash
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:8000}"

read -r -p "API Key (leave blank to skip): " API_KEY
read -r -p "Token (leave blank to skip): " TOKEN
read -r -p "Host Mode [auto|domestic|overseas] (leave blank to skip): " HOST_MODE

if [ -n "$API_KEY" ]; then
  curl -sS -X POST "$SERVER_URL/config/api-key" \
    -H "Content-Type: application/json" \
    -d "{\"api_key\": \"$API_KEY\"}" >/dev/null
  echo "API Key configured"
fi

if [ -n "$TOKEN" ]; then
  curl -sS -X POST "$SERVER_URL/config/token" \
    -H "Content-Type: application/json" \
    -d "{\"token\": \"$TOKEN\"}" >/dev/null
  echo "Token configured"
fi

if [ -n "$HOST_MODE" ]; then
  curl -sS -X POST "$SERVER_URL/config/host-mode" \
    -H "Content-Type: application/json" \
    -d "{\"host_mode\": \"$HOST_MODE\"}" >/dev/null
  echo "Host Mode configured"
fi

if [ -z "$API_KEY" ] && [ -z "$TOKEN" ] && [ -z "$HOST_MODE" ]; then
  echo "No values provided, exiting"
fi