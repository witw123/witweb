import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type AuthSession = {
  token: string;
  profile: {
    username: string;
    nickname?: string;
    avatar_url?: string;
    role?: string;
  };
};

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const AUTH_COOKIE_NAME = "witweb_token";

function uniqueUser(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function registerUser(request: APIRequestContext, username: string): Promise<AuthSession> {
  const response = await request.post("/api/v1/auth/register", {
    data: {
      username,
      password: "Pass123!safe",
      nickname: username,
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.success).toBe(true);
  return body.data as AuthSession;
}

async function seedAuth(page: Page, session: AuthSession) {
  const { hostname, protocol } = new URL(BASE_URL);
  await page.context().addCookies([
    {
      name: AUTH_COOKIE_NAME,
      value: session.token,
      domain: hostname,
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
      secure: protocol === "https:",
    },
  ]);
}

test("user can register from UI and lands on home page", async ({ page }) => {
  const username = uniqueUser("e2e_ui");

  await page.goto("/register");
  await page.getByPlaceholder("设置账号").fill(username);
  await page.getByPlaceholder("设置密码（6-256 位）").fill("Pass123!safe");
  await page.getByRole("button", { name: "注册并登录" }).click();

  await page.waitForURL("**/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "发布" })).toBeVisible();
});

test("authenticated user can publish a post", async ({ page, request }) => {
  const session = await registerUser(request, uniqueUser("e2e_publish"));
  await seedAuth(page, session);

  await page.goto("/publish");
  await page.getByPlaceholder("文章标题").fill(`E2E Post ${Date.now()}`);
  await page.getByPlaceholder("例如：AI, 工程, 系统").fill("e2e,test");
  await page
    .getByPlaceholder("支持 Markdown；普通文本也会保留换行和段落格式。")
    .fill("This is an end-to-end publish test.");
  await page.getByRole("button", { name: "发布文章" }).click();

  await expect(page.getByText("已发布。")).toBeVisible();
});

test("authenticated user can open a new conversation and send a message", async ({ page, request }) => {
  const sender = await registerUser(request, uniqueUser("e2e_sender"));
  const receiver = await registerUser(request, uniqueUser("e2e_receiver"));
  await seedAuth(page, sender);

  await page.goto(`/messages?username=${receiver.profile.username}`);
  await page
    .getByPlaceholder("发个消息聊聊吧（Enter 发送）")
    .fill("hello from playwright");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByText("hello from playwright")).toBeVisible();
});

test("admin can sign in from the backend login page", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByPlaceholder("请输入管理员账号").fill("witw");
  await page.getByPlaceholder("请输入密码").fill("witw");
  await page.getByRole("button", { name: "登录" }).click();

  await page.waitForURL("**/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: /仪表盘/ })).toBeVisible();
});

test("authenticated user can open Studio and switch to radar and video modules", async ({
  page,
  request,
}) => {
  const session = await registerUser(request, uniqueUser("e2e_studio"));
  await seedAuth(page, session);

  await page.goto("/studio");
  await expect(page.getByText("创作工作台")).toBeVisible();

  await page.getByRole("button", { name: "选题雷达" }).click();
  await expect(page.getByRole("button", { name: "抓取全部来源" })).toBeVisible();

  await page.locator(".studio-nav-item").nth(1).click();
  await expect(page.getByRole("button", { name: "开始生成视频" })).toBeVisible();
});
test("authenticated user can create a radar source from Studio", async ({ page, request }) => {
  const session = await registerUser(request, uniqueUser("e2e_radar_source"));
  await seedAuth(page, session);

  await page.goto("/studio");
  await page.getByRole("button", { name: "选题雷达" }).click();
  await page.locator(".radar-tab-v2").nth(1).click();

  const sourceName = `E2E Source ${Date.now()}`;
  const sourceUrl = `https://example.com/${Date.now()}.xml`;
  const sourceInputs = page.locator(".radar-detail-panel input");

  await sourceInputs.nth(0).fill(sourceName);
  await sourceInputs.nth(1).fill(sourceUrl);
  await page.locator(".radar-detail-panel .studio-btn-primary").click();

  await expect(page.locator(".radar-list-item", { hasText: sourceName })).toBeVisible();
});

test("authenticated user can submit a video task from Studio", async ({ page, request }) => {
  const session = await registerUser(request, uniqueUser("e2e_video_task"));
  await seedAuth(page, session);

  await page.goto("/studio");
  await page.locator(".studio-nav-item").nth(1).click();
  await page.getByRole("button", { name: "视频生成" }).click();

  const form = page.locator("form.studio-subpage").first();
  const prompt = `E2E video prompt ${Date.now()}`;
  await form.locator("textarea").first().fill(prompt);
  await form.locator("button[type='submit']").click();

  await expect(page.getByText(prompt)).toBeVisible({ timeout: 15000 });
});
