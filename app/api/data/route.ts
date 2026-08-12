import { env } from "cloudflare:workers";
import { deleteConnectorCredential, saveConnectorCredential } from "../../../db/credentials";
import { ensureDatabase, loadDashboardData } from "../../../db/repository";
import { getChatGPTUser } from "../../chatgpt-auth";

export const runtime = "edge";

export async function GET() {
  const user = await getChatGPTUser();
  return Response.json(await loadDashboardData(user?.userId));
}

export async function POST(request: Request) {
  await ensureDatabase();
  const db = env.DB;
  const payload = await request.json() as Record<string, unknown>;
  const action = String(payload.action ?? "");
  const user = await getChatGPTUser();

  if (action === "saveBrandProfile") {
    const brandName = String(payload.brandName ?? "").trim();
    if (!brandName) return Response.json({ error: "品牌名不能为空" }, { status: 400 });
    const aliases = String(payload.aliases ?? "")
      .split(/[\n,，]/).map((item) => item.trim()).filter(Boolean);
    const website = String(payload.website ?? "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const existing = await db.prepare("SELECT name FROM brand_profiles WHERE active = 1 ORDER BY id DESC LIMIT 1").first<{ name: string }>();

    if (existing && existing.name !== brandName) {
      await db.batch([
        db.prepare("DELETE FROM mentions"), db.prepare("DELETE FROM alerts"), db.prepare("DELETE FROM traffic_signals"),
        db.prepare("DELETE FROM sync_runs"), db.prepare("DELETE FROM sync_locks"), db.prepare("DELETE FROM propagation_edges"),
        db.prepare("DELETE FROM media_sources"), db.prepare("DELETE FROM provider_health"),
      ]);
    }
    await db.batch([
      db.prepare("UPDATE brand_profiles SET active = 0"),
      db.prepare("DELETE FROM tracked_entities"),
      db.prepare("INSERT INTO brand_profiles (name, aliases, website, active, updated_at) VALUES (?, ?, ?, 1, ?)")
        .bind(brandName, aliases.join("\n"), website, new Date().toISOString()),
      db.prepare("INSERT INTO tracked_entities (type, value, language) VALUES (?, ?, ?)").bind("品牌", brandName, "通用"),
      ...aliases.map((alias) => db.prepare("INSERT INTO tracked_entities (type, value, language) VALUES (?, ?, ?)").bind("别名", alias, "通用")),
      ...(website ? [db.prepare("INSERT INTO tracked_entities (type, value, language) VALUES (?, ?, ?)").bind("官网域名", website, "通用")] : []),
    ]);
  } else if (action === "createMention") {
    const title = String(payload.title ?? "").trim();
    const source = String(payload.source ?? "").trim();
    if (!title || !source) return Response.json({ error: "标题和来源为必填项" }, { status: 400 });

    const risk = Number(payload.risk ?? 30);
    const impact = Number(payload.impact ?? 60);
    const country = String(payload.sourceCountry ?? "全球");
    const result = await db.prepare(`INSERT INTO mentions
      (title, url, source, platform, source_country, content_country, language, sentiment, risk, impact, summary, cluster_key, parent_url, relation, engagement, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
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
        String(payload.summary ?? "人工补充内容，已进入统一分析流程。"),
        String(payload.clusterKey ?? `manual-${Date.now()}`),
        String(payload.parentUrl ?? ""),
        String(payload.relation ?? ""),
        Math.max(0, Number(payload.engagement ?? 0)),
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
  } else if (action === "saveConnectorCredential") {
    if (!user) return Response.json({ error: "请先登录后再保存个人 API 密钥" }, { status: 401 });
    await saveConnectorCredential(db, user.userId, String(payload.provider ?? ""), String(payload.credential ?? ""));
  } else if (action === "deleteConnectorCredential") {
    if (!user) return Response.json({ error: "请先登录后再删除个人 API 密钥" }, { status: 401 });
    await deleteConnectorCredential(db, user.userId, String(payload.provider ?? ""));
  } else {
    return Response.json({ error: "未知操作" }, { status: 400 });
  }

  return Response.json(await loadDashboardData(user?.userId));
}
