#!/usr/bin/env node

/**
 * 安全密钥生成脚本
 * 用于生成随机的 ENCRYPTION_KEY 和 AUTH_SECRET
 * 
 * 使用方法:
 *   node scripts/generate-keys.js
 */

const crypto = require("crypto");

function generateKey(length = 32) {
  return crypto.randomBytes(length).toString("hex");
}

function generateBase64(length = 32) {
  return crypto.randomBytes(length).toString("base64");
}

console.log("=".repeat(60));
console.log("WitWeb 安全密钥生成器");
console.log("=".repeat(60));
console.log();

console.log("生成的密钥（用于 .env.local 文件）：");
console.log("-".repeat(60));
console.log();

console.log("# 加密密钥 - 用于敏感数据加密（建议使用 32 字节）");
console.log(`ENCRYPTION_KEY=${generateKey(32)}`);
console.log();

console.log("# JWT 签名密钥 - 用于认证（建议使用 32 字节）");
console.log(`AUTH_SECRET=${generateKey(32)}`);
console.log();

console.log("# 备选 JWT 密钥（Base64 格式）");
console.log(`# AUTH_SECRET=${generateBase64(32)}`);
console.log();

console.log("-".repeat(60));
console.log();
console.log("使用方法：");
console.log("1. 复制上面的密钥到 .env.local 文件");
console.log("2. 确保 .env.local 已添加到 .gitignore");
console.log("3. 重启应用使配置生效");
console.log();
console.log("警告：");
console.log("- 永远不要将这些密钥提交到版本控制！");
console.log("- 生产环境应该使用不同的密钥");
console.log("- 定期轮换密钥以增强安全性");
console.log();
console.log("=".repeat(60));
