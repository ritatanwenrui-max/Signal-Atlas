import { env } from "cloudflare:workers";
import { deleteConnectorCredential, saveConnectorCredential } from "../../../db/credentials";
import { ensureDatabase, getActiveBrandForUser, loadDashboardData } from "../../../db/repository";
import { verifyMonidApiKey } from "../../../db/monid";
import { analyzeCommentText } from "../../../db/text-analysis";
import { inviteWorkspaceMembers, prepareWorkspaceForUser, removeWorkspaceMember, requireWorkspaceAccess } from "../../../db/workspaces";
import { getChatGPTUser } from "../../chatgpt-auth";

export const runtime = "edge";

export async function GET() {
  const user = await getChatGPTUser();
  if (user) {
    await ensureDatabase();
    await prepareWorkspaceForUser(env.DB, user);
  }
  return Response.json({ ...await loadDashboardData(user?.userId), viewer: { authenticated: Boolean(user) } });
}

export async function POST(request: Request) {
  await ensureDatabase();
  const db = env.DB;
  const payload = await request.json() as Record<string, unknown>;
  const action = String(payload.action ?? "");
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录后再管理品牌工作区" }, { status: 401 });
  await prepareWorkspaceForUser(db, user);
  const workspace = await requireWorkspaceAccess(db, user.userId);
  const existingBrand = await getActiveBrandForUser(db, user.userId);

  if (action === "saveBrandProfile") {
    await requireWorkspaceAccess(db, user.userId, "manage");
    const brandName = String(payload.brandName ?? "").trim();
    if (!brandName) return Response.json({ error: "品牌名不能为空" }, { status: 400 });
    const aliases = String(payload.aliases ?? "").split(/[\n,，]/).map((item) => item.trim()).filter(Boolean);
    const website = String(payload.website ?? "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const matchMode = ["precise", "balanced", "broad"].includes(String(payload.matchMode)) ? String(payload.matchMode) : "precise";
    const scopeTerms = String(payload.scopeTerms ?? "").split(/[\n,，]/).map((item) => item.trim()).filter(Boolean).join("\n");
    const excludeTerms = String(payload.excludeTerms ?? "").split(/[\n,，]/).map((item) => item.trim()).filter(Boolean).join("\n");
    const officialAccounts = String(payload.officialAccounts ?? "").split(/[\n,，]/).map((item) => item.trim()).filter(Boolean).join("\n");
    const now = new Date().toISOString();
    let brandId = Number(existingBrand?.id ?? 0);
    if (!brandId) {
      const inserted = await db.prepare(`INSERT INTO brand_profiles
        (user_id, workspace_id, name, aliases, website, match_mode, scope_terms, exclude_terms, official_accounts, active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).bind(user.userId, Number(workspace.id), brandName, aliases.join("\n"), website,
          matchMode, scopeTerms, excludeTerms, officialAccounts, now).run();
      brandId = Number(inserted.meta.last_row_id);
      await db.prepare("UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?")
        .bind(`${brandName} 团队工作区`, now, Number(workspace.id)).run();
    } else {
      const brandChanged = String(existingBrand?.name ?? "") !== brandName;
      if (brandChanged) {
        await db.batch([
          db.prepare("DELETE FROM mention_comments WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM comment_analyses WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM social_comment_reply_queue WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM social_comment_targets WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM mentions WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM alerts WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM traffic_signals WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM sync_runs WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM propagation_edges WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM media_sources WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM monid_jobs WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM social_post_metrics WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM social_author_snapshots WHERE brand_id = ?").bind(brandId),
          db.prepare("DELETE FROM provider_health WHERE provider LIKE ?").bind(`${brandId}:%`),
          db.prepare("DELETE FROM sync_locks WHERE name = ?").bind(`monitoring:${brandId}`),
        ]);
      }
      await db.prepare(`UPDATE brand_profiles SET name = ?, aliases = ?, website = ?, match_mode = ?, scope_terms = ?,
        exclude_terms = ?, official_accounts = ?, active = 1, updated_at = ? WHERE id = ? AND workspace_id = ?`)
        .bind(brandName, aliases.join("\n"), website, matchMode, scopeTerms, excludeTerms, officialAccounts, now, brandId, Number(workspace.id)).run();
    }
    await db.prepare("DELETE FROM tracked_entities WHERE brand_id = ? AND type IN ('品牌','别名','官网域名')").bind(brandId).run();
    await db.batch([
      db.prepare("INSERT INTO tracked_entities (brand_id, type, value, language) VALUES (?, ?, ?, ?)").bind(brandId, "品牌", brandName, "通用"),
      ...aliases.map((alias) => db.prepare("INSERT INTO tracked_entities (brand_id, type, value, language) VALUES (?, ?, ?, ?)").bind(brandId, "别名", alias, "通用")),
      ...(website ? [db.prepare("INSERT INTO tracked_entities (brand_id, type, value, language) VALUES (?, ?, ?, ?)").bind(brandId, "官网域名", website, "通用")] : []),
    ]);
  } else if (action === "saveConnectorCredential") {
    await requireWorkspaceAccess(db, user.userId, "manage");
    const provider = String(payload.provider ?? "");
    const credential = String(payload.credential ?? "");
    if (provider === "Monid / Instagram") {
      try {
        await verifyMonidApiKey(credential.trim());
      } catch (error) {
        const message = error instanceof Error ? error.message : "Monid API Key 验证失败";
        return Response.json({ error: message }, { status: 400 });
      }
    }
    await saveConnectorCredential(db, String(workspace.credential_owner_user_id), provider, credential, String(payload.lastFour ?? ""));
  } else if (action === "deleteConnectorCredential") {
    await requireWorkspaceAccess(db, user.userId, "manage");
    await deleteConnectorCredential(db, String(workspace.credential_owner_user_id), String(payload.provider ?? ""));
  } else if (action === "inviteWorkspaceMembers") {
    await requireWorkspaceAccess(db, user.userId, "manage");
    await inviteWorkspaceMembers(db, Number(workspace.id), user.userId, String(payload.emails ?? ""), String(payload.role ?? "editor"));
  } else if (action === "revokeWorkspaceInvite") {
    await requireWorkspaceAccess(db, user.userId, "manage");
    await db.prepare("UPDATE workspace_invites SET status = 'revoked' WHERE id = ? AND workspace_id = ? AND status = 'pending'")
      .bind(Number(payload.id), Number(workspace.id)).run();
  } else if (action === "removeWorkspaceMember") {
    await requireWorkspaceAccess(db, user.userId, "manage");
    await removeWorkspaceMember(db, Number(workspace.id), user.userId, String(payload.userId ?? ""));
  } else {
    await requireWorkspaceAccess(db, user.userId, "edit");
    const brandId = Number(existingBrand?.id ?? 0);
    if (!brandId) return Response.json({ error: "请先创建品牌监测档案" }, { status: 400 });
    if (action === "createMention") {
      const title = String(payload.title ?? "").trim();
      const source = String(payload.source ?? "").trim();
      if (!title || !source) return Response.json({ error: "标题和来源为必填项" }, { status: 400 });
      const risk = Number(payload.risk ?? 30);
      const impact = Number(payload.impact ?? 60);
      const country = String(payload.sourceCountry ?? "地区待确认");
      const excerpt = String(payload.excerpt ?? payload.summary ?? "").trim();
      const analysis = analyzeCommentText(`${title} ${excerpt}`);
      const result = await db.prepare(`INSERT INTO mentions
        (brand_id, title, url, source, platform, source_country, content_country, language, sentiment, emotion, risk, impact,
         summary, excerpt, author, provider, discovered_via, cluster_key, parent_url, relation, engagement, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Manual', 'manual', ?, ?, ?, ?, ?)`)
        .bind(brandId, title, String(payload.url ?? "#"), source, String(payload.platform ?? "网页新闻"), country,
          String(payload.contentCountry ?? country), String(payload.language ?? analysis.language), analysis.sentiment, analysis.emotion, risk,
          impact, excerpt || "人工补充内容，已进入统一分析流程。", excerpt, String(payload.author ?? ""), String(payload.clusterKey ?? `manual-${Date.now()}`),
          String(payload.parentUrl ?? ""), String(payload.relation ?? ""), Math.max(0, Number(payload.engagement ?? 0)),
          String(payload.publishedAt ?? new Date().toISOString())).run();
      const platform = String(payload.platform ?? "网页新闻");
      if (platform !== "网页新闻") {
        const metric = (key: string) => payload[key] === "" || payload[key] == null ? -1 : Math.max(0, Number(payload[key]));
        await db.prepare(`INSERT INTO social_post_metrics
          (mention_id, brand_id, platform, post_id, author_id, author_username, author_name, follower_count, likes, comments, shares, views, plays, matched_terms, metrics_updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)`)
          .bind(result.meta.last_row_id, brandId, platform, String(payload.postId ?? ""), String(payload.authorId ?? ""),
            String(payload.authorUsername ?? ""), String(payload.author ?? ""), metric("followerCount"), metric("likes"), metric("comments"),
            metric("shares"), metric("views"), metric("plays"), new Date().toISOString()).run();
      }
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
    } else if (action === "deleteEntity") {
      const entityId = Number(payload.id ?? 0);
      if (!Number.isInteger(entityId) || entityId <= 0) return Response.json({ error: "词条编号无效" }, { status: 400 });
      const entity = await db.prepare("SELECT type FROM tracked_entities WHERE id = ? AND brand_id = ?")
        .bind(entityId, brandId).first<{ type: string }>();
      if (!entity) return Response.json({ error: "词条不存在或已被删除" }, { status: 404 });
      if (["品牌", "别名", "官网域名"].includes(entity.type)) {
        return Response.json({ error: "品牌、别名和官网域名请在品牌档案中修改" }, { status: 400 });
      }
      await db.prepare("DELETE FROM tracked_entities WHERE id = ? AND brand_id = ?").bind(entityId, brandId).run();
    } else if (action === "acknowledgeAlert") {
      await db.prepare("UPDATE alerts SET acknowledged = 1 WHERE id = ? AND brand_id = ?").bind(Number(payload.id), brandId).run();
    } else return Response.json({ error: "未知操作" }, { status: 400 });
  }
  return Response.json({ ...await loadDashboardData(user.userId), viewer: { authenticated: true } });
}
