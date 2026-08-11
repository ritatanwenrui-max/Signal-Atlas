import { loadDashboardData } from "../../../db/repository";
import { runNewsSync } from "../../../db/news-sync";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({})) as { force?: boolean };
    const sync = await runNewsSync(Boolean(payload.force));
    return Response.json({ sync, data: await loadDashboardData() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新闻自动搜索失败";
    return Response.json({ error: message }, { status: 502 });
  }
}
