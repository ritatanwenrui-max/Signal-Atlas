import { env } from "cloudflare:workers";
import { getCommentCalibrationStats } from "../../../db/comment-calibration";
import { queueSocialCommentTarget } from "../../../db/monid";
import { ensureDatabase, getActiveBrandForUser, getWorkspaceAccessForUser } from "../../../db/repository";
import { meaningfulTokens } from "../../../db/text-analysis";
import { prepareWorkspaceForUser } from "../../../db/workspaces";
import { getChatGPTUser } from "../../chatgpt-auth";

export const runtime = "edge";

type Keyword = { word?: string; count?: number };

function integerParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function profileTerms(value: unknown) {
  return String(value ?? "").split(/[\n,，]/).map((item) => item.trim()).filter(Boolean);
}

function escapedLikeTerm(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function socialPostDescriptor(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("请输入完整的公开帖子链接"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("帖子链接必须以 http:// 或 https:// 开头");
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "instagram.com" || host.endsWith(".instagram.com")) {
    if (!url.pathname.match(/^\/(?:p|reel|tv)\/[^/]+/)) throw new Error("请输入 Instagram 帖子或 Reels 的公开链接");
    return { platform: "Instagram", postId: value };
  }
  if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) {
    const postId = url.pathname.match(/\/status\/(\d+)/)?.[1];
    if (!postId) throw new Error("未能从 X 链接中识别帖子 ID");
    return { platform: "X", postId };
  }
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") {
    const postId = host === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0] : url.searchParams.get("v") || url.pathname.match(/\/(?:shorts|live)\/([^/]+)/)?.[1];
    if (!postId) throw new Error("未能从 YouTube 链接中识别视频 ID");
    return { platform: "YouTube", postId };
  }
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    const postId = url.pathname.match(/\/video\/(\d+)/)?.[1];
    if (!postId) throw new Error("未能从 TikTok 链接中识别视频 ID");
    return { platform: "TikTok", postId };
  }
  if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch") return { platform: "Facebook", postId: value };
  throw new Error("目前支持 Instagram、X、YouTube、TikTok 和 Facebook 的公开帖子链接");
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录后添加采集目标" }, { status: 401 });
  await ensureDatabase();
  const db = env.DB;
  await prepareWorkspaceForUser(db, user);
  const [brand, workspace] = await Promise.all([getActiveBrandForUser(db, user.userId), getWorkspaceAccessForUser(db, user.userId)]);
  const brandId = Number(brand?.id ?? 0);
  if (!brandId) return Response.json({ error: "请先创建品牌监测档案" }, { status: 400 });
  if (String(workspace?.role ?? "viewer") === "viewer") return Response.json({ error: "当前账号只有查看权限" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { action?: string; postUrl?: string };
  if (body.action !== "collectPost") return Response.json({ error: "不支持的操作" }, { status: 400 });
  const postUrl = String(body.postUrl ?? "").trim().slice(0, 1000);
  let descriptor: { platform: string; postId: string };
  try { descriptor = socialPostDescriptor(postUrl); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "帖子链接无法识别" }, { status: 400 }); }
  let mention = await db.prepare("SELECT id FROM mentions WHERE brand_id = ? AND url = ? ORDER BY id DESC LIMIT 1")
    .bind(brandId, postUrl).first<{ id: number }>();
  if (!mention) {
    const now = new Date().toISOString();
    const inserted = await db.prepare(`INSERT INTO mentions
      (brand_id, title, url, source, platform, source_country, content_country, language, sentiment, emotion, risk, impact,
       summary, cluster_key, excerpt, author, provider, discovered_via, published_at)
      VALUES (?, ?, ?, ?, ?, '地区待确认', '地区待确认', '语言待确认', '中性', '中性陈述', 20, 45, '', ?, '', '', 'Monid · 指定帖子', 'manual_comment_target', ?)`)
      .bind(brandId, `指定帖子 · ${descriptor.platform}`, postUrl, descriptor.platform, descriptor.platform, `story-manual-${crypto.randomUUID()}`, now).run();
    mention = { id: Number(inserted.meta.last_row_id) };
  }
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO social_post_metrics (mention_id, brand_id, platform, post_id, matched_terms, metrics_updated_at)
    VALUES (?, ?, ?, ?, '[]', ?)
    ON CONFLICT(mention_id) DO UPDATE SET platform = excluded.platform, post_id = excluded.post_id, metrics_updated_at = excluded.metrics_updated_at`)
    .bind(mention.id, brandId, descriptor.platform, descriptor.postId, now).run();
  await queueSocialCommentTarget(db, brandId, mention.id, descriptor.platform, descriptor.postId, postUrl, 0);
  await db.prepare(`UPDATE social_comment_targets SET status = 'queued', top_level_complete = 0, cursor = '', pages_fetched = 0,
    last_error = '已加入指定帖子采集队列', updated_at = ? WHERE brand_id = ? AND mention_id = ?`)
    .bind(now, brandId, mention.id).run();
  return Response.json({ ok: true, mentionId: mention.id, platform: descriptor.platform });
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录后查看评论舆情" }, { status: 401 });
  await ensureDatabase();
  const db = env.DB;
  await prepareWorkspaceForUser(db, user);
  const brand = await getActiveBrandForUser(db, user.userId);
  const brandId = Number(brand?.id ?? 0);
  if (!brandId) return Response.json({ error: "请先创建品牌监测档案" }, { status: 400 });
  const entityExclusions = await db.prepare("SELECT value FROM tracked_entities WHERE brand_id = ? AND type = '排除词' AND active = 1")
    .bind(brandId).all<{ value: string }>();

  const url = new URL(request.url);
  const page = integerParam(url.searchParams.get("page"), 1, 1, 10_000);
  const pageSize = 40;
  const range = ["1", "7", "30", "0"].includes(url.searchParams.get("range") ?? "") ? url.searchParams.get("range")! : "30";
  const sentiment = ["正面", "中性", "负面", "混合"].includes(url.searchParams.get("sentiment") ?? "") ? url.searchParams.get("sentiment")! : "";
  const platform = ["网页新闻", "Instagram", "Facebook", "TikTok", "X", "YouTube"].includes(url.searchParams.get("platform") ?? "") ? url.searchParams.get("platform")! : "";
  const sort = ["newest", "liked", "risk"].includes(url.searchParams.get("sort") ?? "") ? url.searchParams.get("sort")! : "newest";
  const annotation = ["unlabeled", "labeled", "disagreed"].includes(url.searchParams.get("annotation") ?? "") ? url.searchParams.get("annotation")! : "";
  const query = (url.searchParams.get("query") ?? "").trim().slice(0, 120);
  const postId = integerParam(url.searchParams.get("post"), 0, 0, Number.MAX_SAFE_INTEGER);

  const clauses = ["c.brand_id = ?"];
  const binds: Array<string | number> = [brandId];
  if (range !== "0") clauses.push(`datetime(COALESCE(NULLIF(c.published_at, ''), c.collected_at)) >= datetime('now', '-${Number(range)} days')`);
  if (sentiment) { clauses.push("c.sentiment = ?"); binds.push(sentiment); }
  if (platform) { clauses.push("c.platform = ?"); binds.push(platform); }
  if (postId) { clauses.push("c.mention_id = ?"); binds.push(postId); }
  if (annotation === "unlabeled") clauses.push("NOT EXISTS (SELECT 1 FROM comment_annotations annotation WHERE annotation.comment_id = c.id)");
  if (annotation === "labeled") clauses.push("EXISTS (SELECT 1 FROM comment_annotations annotation WHERE annotation.comment_id = c.id)");
  if (annotation === "disagreed") clauses.push(`EXISTS (SELECT 1 FROM comment_annotations annotation WHERE annotation.comment_id = c.id
    AND (annotation.model_sentiment != annotation.manual_sentiment OR annotation.model_emotion != annotation.manual_emotion))`);
  if (query) {
    clauses.push("(c.content LIKE ? OR c.author_username LIKE ? OR c.author_name LIKE ? OR m.title LIKE ?)");
    const needle = `%${query}%`;
    binds.push(needle, needle, needle, needle);
  }
  const exclusions = [...new Set([...profileTerms(brand?.exclude_terms), ...entityExclusions.results.flatMap((item) => profileTerms(item.value))])];
  const mentionText = "COALESCE(m.title, '') || ' ' || COALESCE(m.excerpt, '') || ' ' || COALESCE(m.summary, '') || ' ' || COALESCE(m.source, '') || ' ' || COALESCE(m.author, '') || ' ' || COALESCE(m.url, '')";
  for (const term of exclusions) {
    clauses.push(`(${mentionText} || ' ' || COALESCE(c.content, '')) NOT LIKE ? ESCAPE '\\'`);
    binds.push(`%${escapedLikeTerm(term)}%`);
  }
  const where = clauses.join(" AND ");
  const mentionOnlyClauses = exclusions.map(() => `(${mentionText}) NOT LIKE ? ESCAPE '\\'`);
  const mentionOnlyWhere = mentionOnlyClauses.length ? ` AND ${mentionOnlyClauses.join(" AND ")}` : "";
  const mentionOnlyBinds = exclusions.map((term) => `%${escapedLikeTerm(term)}%`);
  const ordering = sort === "liked" ? "c.likes DESC, c.published_at DESC" : sort === "risk" ? "c.sentiment_score ASC, c.likes DESC, c.published_at DESC" : "c.published_at DESC, c.id DESC";

  const summarySql = `SELECT COUNT(*) AS total, COUNT(DISTINCT COALESCE(NULLIF(c.author_id, ''), NULLIF(c.author_username, ''))) AS authors,
      COALESCE(SUM(c.likes), 0) AS likes, COALESCE(SUM(c.replies), 0) AS replies,
      SUM(CASE WHEN c.sentiment = '正面' THEN 1 ELSE 0 END) AS positive,
      SUM(CASE WHEN c.sentiment = '中性' THEN 1 ELSE 0 END) AS neutral,
      SUM(CASE WHEN c.sentiment = '负面' THEN 1 ELSE 0 END) AS negative,
      SUM(CASE WHEN c.sentiment = '混合' THEN 1 ELSE 0 END) AS mixed,
      COALESCE(ROUND(AVG(c.sentiment_score)), 0) AS average_score
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id WHERE ${where}`;
  const commentsSql = `SELECT c.*, m.title AS post_title, m.url AS post_url, m.source AS post_source,
      metrics.author_username AS post_author, metrics.follower_count AS post_author_followers,
      annotation.model_sentiment, annotation.model_emotion, annotation.model_topic, annotation.model_score,
      annotation.manual_sentiment, annotation.manual_emotion, annotation.manual_topic,
      annotation.note AS annotation_note, annotation.updated_at AS annotation_updated_at
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
    LEFT JOIN social_post_metrics metrics ON metrics.mention_id = c.mention_id
    LEFT JOIN comment_annotations annotation ON annotation.comment_id = c.id
    WHERE ${where} ORDER BY ${ordering} LIMIT ? OFFSET ?`;
  const sentimentSql = `SELECT c.sentiment AS label, COUNT(*) AS count FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
    WHERE ${where} GROUP BY c.sentiment ORDER BY count DESC`;
  const emotionSql = `SELECT c.emotion AS label, COUNT(*) AS count FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
    WHERE ${where} GROUP BY c.emotion ORDER BY count DESC`;
  const timelineSql = `SELECT substr(COALESCE(NULLIF(c.published_at, ''), c.collected_at), 1, 10) AS date, COUNT(*) AS total,
      SUM(CASE WHEN c.sentiment = '负面' THEN 1 ELSE 0 END) AS negative,
      SUM(CASE WHEN c.sentiment = '正面' THEN 1 ELSE 0 END) AS positive
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id WHERE ${where}
    GROUP BY date ORDER BY date ASC`;
  const topicSql = `SELECT c.topic AS topic, COUNT(*) AS count,
      SUM(CASE WHEN c.sentiment = '负面' THEN 1 ELSE 0 END) AS negative
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id WHERE ${where}
    GROUP BY c.topic ORDER BY count DESC LIMIT 10`;
  const topPostsSql = `SELECT c.mention_id, m.title, m.url, m.source, COUNT(*) AS comments,
      SUM(CASE WHEN c.sentiment = '负面' THEN 1 ELSE 0 END) AS negative, COALESCE(SUM(c.likes), 0) AS likes
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id WHERE ${where}
    GROUP BY c.mention_id, m.title, m.url, m.source ORDER BY comments DESC, likes DESC LIMIT 8`;
  const keywordSql = `SELECT c.keywords FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
    WHERE ${where} ORDER BY c.id DESC LIMIT 5000`;

  const [summary, comments, sentimentRows, emotionRows, timeline, topics, topPosts, keywordRows, targets, targetTotals, riskComments, calibration] = await Promise.all([
    db.prepare(summarySql).bind(...binds).first<Record<string, number>>(),
    db.prepare(commentsSql).bind(...binds, pageSize, (page - 1) * pageSize).all<Record<string, unknown>>(),
    db.prepare(sentimentSql).bind(...binds).all<Record<string, unknown>>(),
    db.prepare(emotionSql).bind(...binds).all<Record<string, unknown>>(),
    db.prepare(timelineSql).bind(...binds).all<Record<string, unknown>>(),
    db.prepare(topicSql).bind(...binds).all<Record<string, unknown>>(),
    db.prepare(topPostsSql).bind(...binds).all<Record<string, unknown>>(),
    db.prepare(keywordSql).bind(...binds).all<{ keywords: string }>(),
    db.prepare(`SELECT target.*, m.title AS post_title, m.source AS post_source, m.url AS mention_url
      FROM social_comment_targets target JOIN mentions m ON m.id = target.mention_id
      WHERE target.brand_id = ?${mentionOnlyWhere} ORDER BY CASE target.status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 WHEN 'collecting' THEN 2
        WHEN 'retrying' THEN 3 WHEN 'blocked' THEN 4 WHEN 'unavailable' THEN 5 WHEN 'error' THEN 6 ELSE 7 END,
      target.updated_at DESC LIMIT 20`).bind(brandId, ...mentionOnlyBinds).all<Record<string, unknown>>(),
    db.prepare(`SELECT COALESCE(SUM(reported_count), 0) AS reported, COALESCE(SUM(collected_count), 0) AS collected
      FROM social_comment_targets target JOIN mentions m ON m.id = target.mention_id
      WHERE target.brand_id = ?${mentionOnlyWhere}`).bind(brandId, ...mentionOnlyBinds).first<{ reported: number; collected: number }>(),
    db.prepare(`SELECT c.*, m.title AS post_title, m.url AS post_url,
      annotation.model_sentiment, annotation.model_emotion, annotation.manual_sentiment, annotation.manual_emotion
      FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
      LEFT JOIN comment_annotations annotation ON annotation.comment_id = c.id
      WHERE ${where} AND c.sentiment IN ('负面','混合')
      ORDER BY c.sentiment_score ASC, c.likes DESC, c.published_at DESC LIMIT 8`).bind(...binds).all<Record<string, unknown>>(),
    getCommentCalibrationStats(db, brandId),
  ]);

  const wordCounts = new Map<string, number>();
  const brandTerms = [String(brand?.name ?? ""), ...String(brand?.aliases ?? "").split(/[\n,，]/)].filter(Boolean);
  for (const row of keywordRows.results) {
    try {
      for (const item of JSON.parse(row.keywords || "[]") as Keyword[]) {
        const word = String(item.word ?? "").trim();
        const count = Number(item.count ?? 0);
        if (!word || count <= 0) continue;
        for (const token of meaningfulTokens(word, brandTerms)) wordCounts.set(token, (wordCounts.get(token) ?? 0) + count);
      }
    } catch { /* Ignore legacy malformed keyword JSON. */ }
  }
  const words = [...wordCounts.entries()].map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)).slice(0, 45);
  const total = Number(summary?.total ?? 0);
  const reported = Number(targetTotals?.reported ?? 0);
  const collected = Number(targetTotals?.collected ?? 0);
  const safeSummary = {
    total,
    authors: Number(summary?.authors ?? 0),
    likes: Number(summary?.likes ?? 0),
    replies: Number(summary?.replies ?? 0),
    positive: Number(summary?.positive ?? 0),
    neutral: Number(summary?.neutral ?? 0),
    negative: Number(summary?.negative ?? 0),
    mixed: Number(summary?.mixed ?? 0),
    average_score: Number(summary?.average_score ?? 0),
  };

  return Response.json({
    summary: { ...safeSummary, reported, collected, coverage: reported ? Math.min(100, Math.round(collected / reported * 100)) : total ? 100 : 0 },
    sentiment: sentimentRows.results,
    emotions: emotionRows.results,
    timeline: timeline.results,
    topics: topics.results,
    words,
    topPosts: topPosts.results,
    targets: targets.results,
    riskComments: riskComments.results,
    comments: comments.results,
    calibration,
    pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
    filters: { range, sentiment, platform, query, postId, sort, annotation },
  });
}
