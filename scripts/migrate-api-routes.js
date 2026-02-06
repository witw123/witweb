#!/usr/bin/env node
/**
 * API 路由迁移助手
 * 自动将旧路由转换为新标准
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

// 需要迁移的路由列表
const routesToMigrate = [
  'web/src/app/api/blog/[slug]/comments/route.ts',
  'web/src/app/api/blog/[slug]/like/route.ts',
  'web/src/app/api/blog/[slug]/dislike/route.ts',
  'web/src/app/api/blog/[slug]/favorite/route.ts',
  'web/src/app/api/blog/[slug]/view/route.ts',
  'web/src/app/api/comment/[id]/route.ts',
  'web/src/app/api/comment/[id]/like/route.ts',
  'web/src/app/api/comment/[id]/dislike/route.ts',
  'web/src/app/api/profile/route.ts',
  'web/src/app/api/users/[username]/profile/route.ts',
  'web/src/app/api/users/[username]/activity/route.ts',
  'web/src/app/api/messages/conversations/route.ts',
  'web/src/app/api/messages/[conversationId]/route.ts',
  'web/src/app/api/messages/send/route.ts',
  'web/src/app/api/messages/notifications/route.ts',
  'web/src/app/api/follow/route.ts',
  'web/src/app/api/favorites/route.ts',
];

function checkRoute(routePath) {
  const fullPath = path.join(process.cwd(), '..', routePath);
  
  if (!fs.existsSync(fullPath)) {
    return { status: 'missing', path: routePath };
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  
  // 检查是否已经使用新标准
  if (content.includes('withErrorHandler') && content.includes('successResponse')) {
    return { status: 'migrated', path: routePath };
  }
  
  // 检查是否是旧格式
  if (content.includes('Response.json(') && !content.includes('successResponse')) {
    return { status: 'needs-migration', path: routePath };
  }
  
  return { status: 'unknown', path: routePath };
}

function generateMigrationTemplate(routePath) {
  const routeName = path.basename(path.dirname(routePath));
  
  return `/**
 * ${routeName} API - 使用新的标准化响应系统
 */

import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";

// GET 处理
export const GET = withErrorHandler(async (req) => {
  initDb();
  const user = await getAuthUser();
  
  // TODO: 实现业务逻辑
  
  return successResponse({ message: "Success" });
});

// POST 处理（如果需要）
export const POST = withErrorHandler(async (req) => {
  initDb();
  const user = await getAuthUser();
  
  if (!user) {
    return errorResponses.unauthorized();
  }
  
  // TODO: 实现业务逻辑
  
  return successResponse({ message: "Created" }, 201);
});
`;
}

function main() {
  console.log(colors.cyan('=== API 路由迁移检查 ===\n'));
  
  const results = routesToMigrate.map(checkRoute);
  
  const migrated = results.filter(r => r.status === 'migrated');
  const needsMigration = results.filter(r => r.status === 'needs-migration');
  const missing = results.filter(r => r.status === 'missing');
  
  console.log(colors.green(`✅ 已迁移: ${migrated.length}`));
  console.log(colors.yellow(`⏳ 待迁移: ${needsMigration.length}`));
  console.log(colors.red(`❌ 缺失: ${missing.length}\n`));
  
  if (needsMigration.length > 0) {
    console.log(colors.yellow('待迁移的路由:'));
    needsMigration.forEach(r => console.log(`  - ${r.path}`));
    console.log('');
  }
  
  // 生成迁移模板
  if (process.argv.includes('--generate') && needsMigration.length > 0) {
    const templateDir = path.join(process.cwd(), '..', 'migration-templates');
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }
    
    needsMigration.forEach(r => {
      const template = generateMigrationTemplate(r.path);
      const outputPath = path.join(templateDir, r.path.replace(/\//g, '_'));
      fs.writeFileSync(outputPath, template);
      console.log(colors.green(`生成模板: ${outputPath}`));
    });
  }
  
  console.log(colors.cyan('\n使用说明:'));
  console.log('1. 查看 MIGRATION_CHECKLIST.md 了解详细步骤');
  console.log('2. 逐个迁移路由文件');
  console.log('3. 运行 npm run type-check 验证');
  console.log('4. 运行 npm run test 测试');
}

main();
