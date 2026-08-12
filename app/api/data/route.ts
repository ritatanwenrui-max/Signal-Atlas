import { env } from "cloudflare:workers";
import { deleteConnectorCredential, saveConnectorCredential } from "../../../db/credentials";
import { ensureDatabase, getActiveBrandForUser, loadDashboardData } from "../../../db/repository";
import { getChatGPTUser } from "../../chatgpt-auth";

export const runtime = "edge";

export async function GET() {
  const user = await getChatGPTUser();
  return Response.json({ ...await loadDashboardData(user?.userId), viewer: { authenticated: Boolean(user) } });
}

export async function POST(request: Request) {
  await ensureDatabase();
  const db = env.DB;
  const payload = await request.json() as Record<string, unknown>;
  const action = String(payload.action ?? "");
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录后再管理品牌工作区" }, { status: 401 });
  const existingBrand = await getActiveBrandForUser(db, user.userId);

  if (action === "saveBrandProfile") {
    const brandName = String(payload.brandName ?? "").trim();
    if (!brandName) return Response.json({ error: "品牌名不能为空" }, { status: 400 });
    const aliases = String(payload.aliases ?? "").split(/[\n,，]/).map((item) => item.trim()).filter(Boolean);
    const website = String(payload.website ?? "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const now = new Date().toISOString();
    let brandId = Number(existingBrand?.id ?? 0);
    if (!brandId) {
      const inserted = await db.prepare("INSERT INTO brand_profiles (user_id, name, aliases, website, active, updated_at) VALUES (?, ?, ?, ?, 1, ?)")
        .bind(user.userId, brandName, aliases.join("\n"), website, now).run();
      brandId = Number(inserted.meta.last_row_id);
    } else {
      const brandChanged = String(existingBrand?.name ?? "") !== brandName;
      if (brandChanged) {
        await db.batch([
          db.prepare("DELETE FROM mentions WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM alerts WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM traffic_signals WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM sync_runs WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM propagation_edges WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM media_sources WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM provider_health WHERE provider LIKE ?").bind(`${brandId}:%`),
          db.prepare("DELETE FROM sync_locks WHERE name = ?").bind(`monitoring:${brandId}`),
        ]);
      }
      await db.prepare("UPDATE brand_profiles SET name = ?, aliases = ?, website = ?, active = 1, updated_at = ? WHERE id = ? AND user_id = ?")
        .bind(brandName, aliases.join("\n"), website, now, brandId, user.userId).run();
    }
    await db.prepare("DELETE FROM tracked_entities WHERE brand_id = ?").bind(brandId).run();
    await db.batch([
      db.prepare("INSERT INTO tracked_entities (brand_id, type, value, language) VALUES (?, ?, ?, ?)").bind(brandId, "品牌", brandName, "通用"),
      ...aliases.map((alias) => db.prepare("INSERT INTO tracked_entities (brand_id, type, value, language) VALUES (?, ?, ?, ?)").bind(brandId, "别名", alias, "通用")),
      ...(website ? [db.prepare("INSERT INTO tracked_entities (brand_id, type, value, language) VALUES (?, ?, ?, ?)").bind(brandId, "官网域名", website, "通用")] : []),
    ]);
  } else if (action === "saveConnectorCredential") {
    await saveConnectorCredential(db, user.userId, String(payload.provider ?? ""), String(payload.credential ?? ""), String(payload.lastFour ?? ""));
  } else if (action === "deleteConnectorCredential") {
    await deleteConnectorCredential(db, user.userId, String(payload.provider ?? ""));
  } else {
    const brandId = Number(existingBrand?.id ?? 0);
    if (!brandId) return Response.json({ error: "请先创建品牌监测档案" }, { status: 400 });
    if (action === "createMention") {
      const title = String(payload.title ?? "").trim();
      const source = String(payload.source ?? "").trim();
      if (!title || !source) return Response.json({ error: "标题和来源为必填项" }, { status: 400 });
      const risk = Number(payload.risk ?? 30);
      const impact = Number(payload.impact ?? 60);
      const country = String(payload.sourceCountry ?? "地区待确认");
      const result = await db.prepare(`INSERT INTO mentions
        (brand_id, title, url, source, platform, source_country, content_country, language, sentiment, risk, impact, summary, cluster_key, parent_url, relation, engagement, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(brandId, title, String(payload.url ?? "#"), source, String(payload.platform ?? "网页新闻"), country,
          String(payload.contentCountry ?? country), String(payload.language ?? "语言待确认"), String(payload.sentiment ?? "中性"), risk,
          impact, String(payload.summary ?? "人工补充内容，已进入统一分析流程。"), String(payload.clusterKey ?? `manual-${Date.now()}`),
          String(payload.parentUrl ?? ""), String(payload.relation ?? ""), Math.max(0, Number(payload.engagement ?? 0)),
          String(payload.publishedAt ?? new Date().toISOString())).run();
      if (risk >= 70 || impact >= 90) await db.prepare("INSERT INTO alerts (brand_id, mention_id, title, severity, country, reason) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(brandId, result.meta.last_row_id, title, risk >= 80 ? "Critical" : "High", country, risk >= 70 ? `风险分 ${risk}，需要人工复核` : `影响力 ${impact}，传播潜力较高`).run();
    } else if (action === "createTraffic") {
      const visitors = Math.max(0, Number(payload.visitors ?? 0));
      const baseline = Math.max(1, Number(payload.baseline ?? 1));
      const ratio = Math.round((visitors / baseline) * 100);
      const country = String(payload.country ?? "全球");
      await db.prepare("INSERT INTO traffic_signals (brand_id, country, visitors, views, baseline, landing_page, anomaly_ratio, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(brandId, country, visitors, Number(payload.views ?? visitors), baseline, String(payload.landingPage ?? "/"), ratio, new Date().toISOString()).run();
      if (ratio >= 300) await db.prepare("INSERT INTO alerts (brand_id, title, severity, country, reason) VALUES (?, ?, ?, ?, ?)")
        .bind(brandId, `${country}官网访问量高于基线 ${(ratio / 100).toFixed(1)} 倍`, "High", country, "已触发当地语言舆情反查任务").run();
    } else if (action === "addEntity") {
      const value = String(payload.value ?? "").trim();
      if (!value) return Response.json({ error: "监测词不能为空" }, { status: 400 });
      await db.prepare("INSERT INTO tracked_entities (brand_id, type, value, language) VALUES (?, ?, ?, ?)")
        .bind(brandId, String(payload.type ?? "关键词"), value, String(payload.language ?? "通用")).run();
    } else if (action === "acknowledgeAlert") {
      await db.prepare("UPDATE alerts SET acknowledged = 1 WHERE id = ? AND brand_id = ?").bind(Number(payload.id), brandId).run();
    } else return Response.json({ error: "未知操作" }, { status: 400 });
  }
  return Response.json({ ...await loadDashboardData(user.userId), viewer: { authenticated: true } });
}
