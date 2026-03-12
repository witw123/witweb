/**
 * 注册页面路由
 *
 * 保持 `app` 层路由文件足够轻量，把具体注册交互下沉到 `features/auth`。
 */

"use client";

import RegisterPage from "@/features/auth/components/RegisterPage";

export default function RegisterRoute() {
  return <RegisterPage />;
}
