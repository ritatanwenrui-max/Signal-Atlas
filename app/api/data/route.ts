import { env } from "cloudflare:workers";
import { ensureDatabase, loadDashboardData } from "../../../db/repository";

export const runtime = "edge";

export async function GET() {
  return Response.json(await loadDashboardData());
}

export async function POST(request: Request) {
  await ensureDatabase();
  const db = env.DB;
  const payload = await request.json() as Record<string, unknown>;
  const action = String(payload.action ?? "");

  if (action === "createMention") {
    const title = String(payload.title ?? "").trim();
    const source = String(payload.source ?? "").trim();
    if (!title || !source) return Response.json({ error: "标题和来源为必填项" }, { status: 400 });

    const risk = Number(payload.risk ?? 30);
    const impact = Number(payload.impact ?? 60);
    const country = String(payload.sourceCountry ?? "全球");
    const result = await db.prepare(`INSERT INTO mentions
      (title, url, source, platform, source_country, content_country, language, sentiment, risk, impact, summary, cluster_key, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        title,
        String(payload.url ?? "#"),
        source,
        String(payload.platform ?? "网页新闻"),
        country,
        String(payload.contentCountry ?? country),
        String(payload.language ?? "中文"),
        String(payload.sentiment ?? "中性"),
        risk,
        impact,
        String(payload.summary ?? "由用户手动录入，等待进一步研判。"),
        String(payload.clusterKey ?? `manual-${Date.now()}`),
        String(payload.publishedAt ?? new Date().toISOString()),
      ).run();

    if (risk >= 70 || impact >= 90) {
      await db.prepare("INSERT INTO alerts (mention_id, title, severity, country, reason) VALUES (?, ?, ?, ?, ?)")
        .bind(result.meta.last_row_id, title, risk >= 80 ? "Critical" : "High", country, risk >= 70 ? `风险分 ${risk}，需要人工复核` : `影响力 ${impact}，传播潜力较高`)
        .run();
    }
  } else if (action === "createTraffic") {
    const visitors = Math.max(0, Number(payload.visitors ?? 0));
    const baseline = Math.max(1, Number(payload.baseline ?? 1));
    const ratio = Math.round((visitors / baseline) * 100);
    const country = String(payload.country ?? "全球");
    await db.prepare(`INSERT INTO traffic_signals
      (country, visitors, views, baseline, landing_page, anomaly_ratio, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(country, visitors, Number(payload.views ?? visitors), baseline, String(payload.landingPage ?? "/"), ratio, new Date().toISOString())
      .run();
    if (ratio >= 300) {
      await db.prepare("INSERT INTO alerts (title, severity, country, reason) VALUES (?, ?, ?, ?)")
        .bind(`${country}官网访问量高于基线 ${(ratio / 100).toFixed(1)} 倍`, "High", country, "已触发当地语言舆情反查任务")
        .run();
    }
  } else if (action === "addEntity") {
    const value = String(payload.value ?? "").trim();
    if (!value) return Response.json({ error: "监测词不能为空" }, { status: 400 });
    await db.prepare("INSERT INTO tracked_entities (type, value, language) VALUES (?, ?, ?)")
      .bind(String(payload.type ?? "关键词"), value, String(payload.language ?? "通用"))
      .run();
  } else if (action === "acknowledgeAlert") {
    await db.prepare("UPDATE alerts SET acknowledged = 1 WHERE id = ?").bind(Number(payload.id)).run();
  } else {
    return Response.json({ error: "未知操作" }, { status: 400 });
  }

  return Response.json(await loadDashboardData());
}
