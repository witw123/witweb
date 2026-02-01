import { postMessage } from "./channel";

const SYSTEM_BOT_NAME = "WitAI";

export async function processBotCommand(channelId: number, content: string, senderName: string) {
  if (!content.startsWith("/bot")) return;

  const args = content.split(" ");
  const command = args[1]?.toLowerCase();

  let reply = "";

  switch (command) {
    case "hello":
      reply = `你好，${senderName}！我是 WitAI，很高兴为您服务。`;
      break;
    case "welcome":
      reply = `欢迎来到 **WitWeb 社区**，${senderName}！🎉\n请阅读频道公告，文明交流。\n输入 \`/bot help\` 查看更多指令。`;
      break;
    case "image":
      // Demo image
      reply = `这是您要的示例图片：\n![Example](https://via.placeholder.com/300x200.png?text=WitAI+Demo+Image)`;
      break;
    case "help":
    default:
      reply = `**WitAI 指令列表**：\n- \`/bot hello\`: 打个招呼\n- \`/bot welcome\`: 模拟欢迎语\n- \`/bot image\`: 获取示例图片\n- \`/bot help\`: 显示此帮助`;
      break;
  }

  // Simulate a small delay for realism
  setTimeout(() => {
    try {
      postMessage(channelId, SYSTEM_BOT_NAME, reply);
    } catch (error) {
      console.error("Failed to send bot reply:", error);
    }
  }, 800);
}
