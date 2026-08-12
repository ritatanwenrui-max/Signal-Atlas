import { loadDashboardData } from "../../../db/repository";
import { runNewsSync } from "../../../db/news-sync";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({})) as { force?: boolean };
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "请先登录后再启动品牌巡检" }, { status: 401 });
    const sync = await runNewsSync(Boolean(payload.force), user.userId);
    return Response.json({ sync, data: { ...await loadDashboardData(user.userId), viewer: { authenticated: true } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新闻自动搜索失败";
    return Response.json({ error: message }, { status: 502 });
  }
}
