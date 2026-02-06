#!/usr/bin/env node

/**
 * API 密钥迁移脚本
 * 帮助用户从 data/api_config.json 迁移到环境变量
 * 
 * 使用方法:
 *   node scripts/migrate-api-keys.js
 */

const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "..", "data", "api_config.json");
const envExamplePath = path.join(__dirname, "..", ".env.example");
const envLocalPath = path.join(__dirname, "..", ".env.local");

console.log("=".repeat(60));
console.log("WitWeb API 密钥迁移工具");
console.log("=".repeat(60));
console.log();

// 检查旧的配置文件是否存在
if (!fs.existsSync(configPath)) {
  console.log("✅ data/api_config.json 不存在，可能已经迁移完成。");
  console.log();
  console.log("请确保以下环境变量已设置：");
  console.log("  - SORA2_API_KEY");
  console.log("  - GRSAI_TOKEN");
  console.log();
  process.exit(0);
}

// 读取旧的配置文件
let oldConfig;
try {
  const content = fs.readFileSync(configPath, "utf8");
  oldConfig = JSON.parse(content);
} catch (error) {
  console.error("❌ 无法读取 data/api_config.json:", error.message);
  process.exit(1);
}

const sora2Key = oldConfig.sora2_api_key;
const grsaiToken = oldConfig.grsai_token;

console.log("📋 从 data/api_config.json 读取的配置：");
console.log(`  - SORA2_API_KEY: ${sora2Key ? sora2Key.substring(0, 8) + "..." : "(未设置)"}`);
console.log(`  - GRSAI_TOKEN: ${grsaiToken ? grsaiToken.substring(0, 8) + "..." : "(未设置)"}`);
console.log();

// 检查 .env.local 是否已存在
let existingEnv = {};
if (fs.existsSync(envLocalPath)) {
  console.log("⚠️  .env.local 已存在，将保留现有配置。");
  const envContent = fs.readFileSync(envLocalPath, "utf8");
  
  // 解析现有环境变量
  envContent.split("\n").forEach(line => {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) {
      existingEnv[match[1]] = match[2];
    }
  });
}

// 构建新的环境变量内容
const newEnvVars = {
  ...existingEnv,
  ...(sora2Key && !existingEnv.SORA2_API_KEY && { SORA2_API_KEY: sora2Key }),
  ...(grsaiToken && !existingEnv.GRSAI_TOKEN && { GRSAI_TOKEN: grsaiToken }),
};

// 生成 .env.local 内容
let envContent = "";

// 读取 .env.example 作为模板
if (fs.existsSync(envExamplePath)) {
  const template = fs.readFileSync(envExamplePath, "utf8");
  const lines = template.split("\n");
  
  for (const line of lines) {
    const match = line.match(/^#?([A-Z_]+)=?(.*)$/);
    if (match && match[1] && newEnvVars[match[1]] !== undefined) {
      // 替换为实际值
      envContent += `${match[1]}=${newEnvVars[match[1]]}\n`;
    } else if (line.startsWith("SORA2_API_KEY=") && sora2Key) {
      envContent += `SORA2_API_KEY=${sora2Key}\n`;
    } else if (line.startsWith("GRSAI_TOKEN=") && grsaiToken) {
      envContent += `GRSAI_TOKEN=${grsaiToken}\n`;
    } else {
      envContent += line + "\n";
    }
  }
} else {
  // 没有模板，创建基本内容
  envContent = `# WitWeb 环境变量配置
# 由 migrate-api-keys.js 自动生成

NODE_ENV=development
AUTH_SECRET=${require("crypto").randomBytes(32).toString("hex")}
ENCRYPTION_KEY=${require("crypto").randomBytes(32).toString("hex")}
`;
  if (sora2Key) envContent += `\nSORA2_API_KEY=${sora2Key}\n`;
  if (grsaiToken) envContent += `GRSAI_TOKEN=${grsaiToken}\n`;
}

// 写入 .env.local
fs.writeFileSync(envLocalPath, envContent);
console.log(`✅ 已生成/更新 ${envLocalPath}`);
console.log();

// 显示结果
console.log("📄 生成的配置预览：");
console.log("-".repeat(60));
const previewLines = envContent.split("\n");
for (const line of previewLines) {
  if (line.match(/^(SORA2_API_KEY|GRSAI_TOKEN|AUTH_SECRET|ENCRYPTION_KEY)=/)) {
    const [key, ...valueParts] = line.split("=");
    const value = valueParts.join("=");
    console.log(`${key}=${value.substring(0, 8)}...`);
  } else if (line && !line.startsWith("#")) {
    console.log(line);
  }
}
console.log("-".repeat(60));
console.log();

console.log("✅ 迁移完成！");
console.log();
console.log("下一步操作：");
console.log("1. 检查 .env.local 文件内容是否正确");
console.log("2. 删除或备份 data/api_config.json");
console.log("   mv data/api_config.json data/api_config.json.backup");
console.log("3. 重启应用使配置生效");
console.log("4. 确保 .env.local 已添加到 .gitignore");
console.log();
console.log("警告：");
console.log("- 永远不要提交 .env.local 到版本控制！");
console.log("- 生产环境应该使用不同的密钥！");
console.log();
console.log("=".repeat(60));
