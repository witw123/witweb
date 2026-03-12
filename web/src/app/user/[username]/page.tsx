/**
 * 用户个人资料页面路由
 *
 * 根据用户名显示用户个人资料页面
 * 包含用户信息、文章列表、粉丝/关注数量等
 * 实际资料页面渲染由 ProfilePage 组件完成
 */

"use client";

import { useParams } from "next/navigation";
import ProfilePage from "@/features/user/components/ProfilePage";

/**
 * UserProfilePage - 用户个人资料页面组件
 *
 * 用户资料页面路由组件，从路由参数获取目标用户名
 * 将用户名传递给 ProfilePage 组件进行渲染
 *
 * @param {string} username - 从 URL 路由参数获取的用户名
 */
export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;

  return (
    <div className="app-page-shell">
      <div className="app-page-container">
        <ProfilePage targetUsername={username} />
      </div>
    </div>
  );
}
