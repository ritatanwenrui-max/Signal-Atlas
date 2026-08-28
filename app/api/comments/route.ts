import { env } from "cloudflare:workers";
import { getCommentCalibrationStats } from "../../../db/comment-calibration";
import { queueSocialCommentTarget } from "../../../db/monid";
import { officialAccountHandles } from "../../../db/official-accounts";
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

function officialAccountSql(handleCount: number, includeDisplayName: boolean) {
  const clauses = Array.from({ length: handleCount }, () => `(LOWER(REPLACE(TRIM(COALESCE(m.author, '')), '@', '')) != ?
    AND LOWER(REPLACE(TRIM(COALESCE(m.source, '')), '@', '')) != ?
    AND NOT EXISTS (SELECT 1 FROM social_post_metrics official_metrics
      WHERE official_metrics.mention_id = m.id
        AND LOWER(REPLACE(TRIM(COALESCE(official_metrics.author_username, '')), '@', '')) = ?))`);
  if (includeDisplayName) clauses.push(`NOT EXISTS (SELECT 1 FROM social_post_metrics official_name_metrics
    WHERE official_name_metrics.mention_id = m.id AND COALESCE(official_name_metrics.author_id, '') != ''
      AND LOWER(TRIM(COALESCE(official_name_metrics.author_name, ''))) = ?)`);
  clauses.push(`NOT (m.platform = 'TikTok' AND LOWER(COALESCE(m.provider, '')) LIKE '%tikhub%'
    AND LOWER(COALESCE(m.url, '')) LIKE '%tiktok.com/@user/video/%' AND COALESCE(m.author, '') = ''
    AND NOT EXISTS (SELECT 1 FROM social_post_metrics attributed_metrics WHERE attributed_metrics.mention_id = m.id
      AND (COALESCE(attributed_metrics.author_id, '') != '' OR COALESCE(attributed_metrics.author_username, '') != '')))`);
  return clauses;
}

function officialAccountBinds(handles: string[], displayName: string) {
  return [...handles.flatMap((handle) => [handle, handle, handle]), ...(displayName ? [displayName.toLocaleLowerCase()] : [])];
}

const audienceRegionSql = `CASE
  WHEN COALESCE(m.source_country, '') NOT IN ('', '地区待确认', '地区未披露', '全球') THEN m.source_country
  WHEN c.language = '泰语' THEN '泰语文化区'
  WHEN c.language = '日语' THEN '日语文化区'
  WHEN c.language = '韩语' THEN '韩语文化区'
  WHEN c.language = '中文' THEN '华语地区'
  WHEN c.language = '英文' THEN '英语地区'
  ELSE '地区未知' END`;
const regionConfidenceSql = `CASE
  WHEN COALESCE(m.source_country, '') NOT IN ('', '地区待确认', '地区未披露', '全球') THEN '中'
  WHEN c.language NOT IN ('', '语言待确认') THEN '低'
  ELSE '未知' END`;
const regionBasisSql = `CASE
  WHEN COALESCE(m.source_country, '') NOT IN ('', '地区待确认', '地区未披露', '全球') THEN '帖子或媒体发布地区'
  WHEN c.language NOT IN ('', '语言待确认') THEN '评论语言'
  ELSE '无公开地区信息' END`;

function percentile95(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * .95))];
}

function rounded(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
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
  if (host === "reddit.com" || host.endsWith(".reddit.com") || host === "redd.it") {
    const rawId = host === "redd.it" ? url.pathname.split("/").filter(Boolean)[0] : url.pathname.match(/\/comments\/([a-z0-9]+)/i)?.[1];
    if (!rawId) throw new Error("未能从 Reddit 链接中识别帖子 ID");
    return { platform: "Reddit", postId: rawId.startsWith("t3_") ? rawId : `t3_${rawId}` };
  }
  throw new Error("目前支持 Instagram、X、YouTube、TikTok、Facebook 和 Reddit 的公开帖子链接");
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
  const sentiment = ["正面", "中性", "负面", "混合", "无实意"].includes(url.searchParams.get("sentiment") ?? "") ? url.searchParams.get("sentiment")! : "";
  const platform = ["网页新闻", "Instagram", "Facebook", "TikTok", "X", "YouTube", "Reddit"].includes(url.searchParams.get("platform") ?? "") ? url.searchParams.get("platform")! : "";
  const region = (url.searchParams.get("region") ?? "").trim().slice(0, 80);
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
    AND annotation.manual_sentiment != '无实意'
    AND (annotation.model_sentiment != annotation.manual_sentiment OR annotation.model_emotion != annotation.manual_emotion))`);
  if (query) {
    clauses.push("(c.content LIKE ? OR c.author_username LIKE ? OR c.author_name LIKE ? OR m.title LIKE ?)");
    const needle = `%${query}%`;
    binds.push(needle, needle, needle, needle);
  }
  const exclusions = [...new Set([...profileTerms(brand?.exclude_terms), ...entityExclusions.results.flatMap((item) => profileTerms(item.value))])];
  const officialHandles = officialAccountHandles(brand?.official_accounts);
  const officialDisplayName = String(brand?.name ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
  const mentionText = "COALESCE(m.title, '') || ' ' || COALESCE(m.excerpt, '') || ' ' || COALESCE(m.summary, '') || ' ' || COALESCE(m.source, '') || ' ' || COALESCE(m.author, '') || ' ' || COALESCE(m.url, '')";
  for (const term of exclusions) {
    clauses.push(`(${mentionText} || ' ' || COALESCE(c.content, '')) NOT LIKE ? ESCAPE '\\'`);
    binds.push(`%${escapedLikeTerm(term)}%`);
  }
  const officialClauses = officialAccountSql(officialHandles.length, Boolean(officialDisplayName));
  clauses.push(...officialClauses);
  binds.push(...officialAccountBinds(officialHandles, officialDisplayName));
  const regionalWhere = clauses.join(" AND ");
  const regionalBinds = [...binds];
  if (region) { clauses.push(`${audienceRegionSql} = ?`); binds.push(region); }
  const where = clauses.join(" AND ");
  const analysisWhere = `${where} AND c.sentiment != '无实意'`;
  const mentionOnlyClauses = [...exclusions.map(() => `(${mentionText}) NOT LIKE ? ESCAPE '\\'`), ...officialClauses];
  const mentionOnlyWhere = mentionOnlyClauses.length ? ` AND ${mentionOnlyClauses.join(" AND ")}` : "";
  const mentionOnlyBinds = [...exclusions.map((term) => `%${escapedLikeTerm(term)}%`), ...officialAccountBinds(officialHandles, officialDisplayName)];
  const ordering = sort === "liked" ? "c.likes DESC, c.published_at DESC" : sort === "risk" ? "c.sentiment_score ASC, c.likes DESC, c.published_at DESC" : "c.published_at DESC, c.id DESC";

  const summarySql = `SELECT COUNT(*) AS total, COUNT(DISTINCT COALESCE(NULLIF(c.author_id, ''), NULLIF(c.author_username, ''))) AS authors,
      COALESCE(SUM(c.likes), 0) AS likes, COALESCE(SUM(c.replies), 0) AS replies,
      SUM(CASE WHEN c.sentiment = '正面' THEN 1 ELSE 0 END) AS positive,
      SUM(CASE WHEN c.sentiment = '中性' THEN 1 ELSE 0 END) AS neutral,
      SUM(CASE WHEN c.sentiment = '负面' THEN 1 ELSE 0 END) AS negative,
      SUM(CASE WHEN c.sentiment = '混合' THEN 1 ELSE 0 END) AS mixed,
      SUM(CASE WHEN c.sentiment = '无实意' THEN 1 ELSE 0 END) AS meaningless,
      SUM(CASE WHEN c.sentiment != '无实意' THEN 1 ELSE 0 END) AS meaningful_total,
      COALESCE(ROUND(AVG(CASE WHEN c.sentiment != '无实意' THEN c.sentiment_score END)), 0) AS average_score
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id WHERE ${where}`;
  const commentsSql = `SELECT c.*, m.title AS post_title, m.translation_en AS post_translation_en, m.language AS post_language, m.url AS post_url, m.source AS post_source,
      ${audienceRegionSql} AS audience_region, ${regionConfidenceSql} AS region_confidence, ${regionBasisSql} AS region_basis,
      metrics.author_username AS post_author, metrics.follower_count AS post_author_followers,
      annotation.model_sentiment, annotation.model_emotion, annotation.model_topic, annotation.model_score,
      annotation.manual_sentiment, annotation.manual_emotion, annotation.manual_topic,
      annotation.note AS annotation_note, annotation.updated_at AS annotation_updated_at
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
    LEFT JOIN social_post_metrics metrics ON metrics.mention_id = c.mention_id
    LEFT JOIN comment_annotations annotation ON annotation.comment_id = c.id
    WHERE ${where} ORDER BY ${ordering} LIMIT ? OFFSET ?`;
  const topPostsSql = `SELECT c.mention_id, m.title, m.translation_en, m.language, m.url, m.source, COUNT(*) AS comments,
      SUM(CASE WHEN c.sentiment = '负面' THEN 1 ELSE 0 END) AS negative, COALESCE(SUM(c.likes), 0) AS likes
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id WHERE ${where}
    GROUP BY c.mention_id, m.title, m.translation_en, m.language, m.url, m.source ORDER BY comments DESC, likes DESC LIMIT 8`;
  const keywordSql = `SELECT c.keywords FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
    WHERE ${analysisWhere} ORDER BY c.id DESC LIMIT 5000`;
  const analysisRowsSql = `SELECT c.id, c.platform, c.likes, c.replies, c.sentiment, c.emotion, c.topic, c.language, c.translation_en,
      c.content, c.published_at, m.title AS post_title, m.translation_en AS post_translation_en, m.language AS post_language, ${audienceRegionSql} AS audience_region,
      ${regionConfidenceSql} AS region_confidence, ${regionBasisSql} AS region_basis
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id WHERE ${analysisWhere}
    ORDER BY c.id DESC LIMIT 10000`;
  const regionalRowsSql = `SELECT c.id, c.platform, c.likes, c.replies, c.sentiment, c.topic,
      ${audienceRegionSql} AS audience_region, ${regionConfidenceSql} AS region_confidence, ${regionBasisSql} AS region_basis
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id WHERE ${regionalWhere} AND c.sentiment != '无实意'
    ORDER BY c.id DESC LIMIT 10000`;

  const [summary, comments, topPosts, keywordRows, analysisRows, regionalRows, targets, targetTotals, riskComments, calibration] = await Promise.all([
    db.prepare(summarySql).bind(...binds).first<Record<string, number>>(),
    db.prepare(commentsSql).bind(...binds, pageSize, (page - 1) * pageSize).all<Record<string, unknown>>(),
    db.prepare(topPostsSql).bind(...binds).all<Record<string, unknown>>(),
    db.prepare(keywordSql).bind(...binds).all<{ keywords: string }>(),
    db.prepare(analysisRowsSql).bind(...binds).all<Record<string, unknown>>(),
    db.prepare(regionalRowsSql).bind(...regionalBinds).all<Record<string, unknown>>(),
    db.prepare(`SELECT target.*, m.title AS post_title, m.translation_en AS post_translation_en, m.language AS post_language, m.source AS post_source, m.url AS mention_url,
        (target.v2_failures + target.v1_failures) AS failure_count,
        CASE WHEN target.status = 'retrying' THEN datetime(target.updated_at, '+30 minutes') ELSE '' END AS next_retry_at
      FROM social_comment_targets target JOIN mentions m ON m.id = target.mention_id
      WHERE target.brand_id = ?${mentionOnlyWhere} ORDER BY CASE target.status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 WHEN 'collecting' THEN 2
        WHEN 'retrying' THEN 3 WHEN 'review' THEN 4 WHEN 'blocked' THEN 5 WHEN 'unavailable' THEN 6 WHEN 'error' THEN 7 ELSE 8 END,
      target.updated_at DESC LIMIT 20`).bind(brandId, ...mentionOnlyBinds).all<Record<string, unknown>>(),
    db.prepare(`SELECT COALESCE(SUM(reported_count), 0) AS reported, COALESCE(SUM(collected_count), 0) AS collected
      FROM social_comment_targets target JOIN mentions m ON m.id = target.mention_id
      WHERE target.brand_id = ?${mentionOnlyWhere}`).bind(brandId, ...mentionOnlyBinds).first<{ reported: number; collected: number }>(),
    db.prepare(`SELECT c.*, m.title AS post_title, m.translation_en AS post_translation_en, m.language AS post_language, m.url AS post_url,
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

  function withWeights(rows: Array<Record<string, unknown>>): Array<Record<string, unknown> & { resonance_weight: number; discussion_weight: number }> {
    const byPlatform = new Map<string, { likes: number[]; replies: number[] }>();
    for (const row of rows) {
      const platformName = String(row.platform ?? "其他");
      const group = byPlatform.get(platformName) ?? { likes: [], replies: [] };
      group.likes.push(Math.log1p(Math.max(0, Number(row.likes ?? 0))));
      group.replies.push(Math.log1p(Math.max(0, Number(row.replies ?? 0))));
      byPlatform.set(platformName, group);
    }
    const thresholds = new Map([...byPlatform.entries()].map(([platformName, values]) => {
      const likeP95 = percentile95(values.likes) || Math.max(0, ...values.likes) || 1;
      const replyP95 = percentile95(values.replies) || Math.max(0, ...values.replies) || 1;
      return [platformName, { likeP95, replyP95 }];
    }));
    return rows.map((row) => {
      const threshold = thresholds.get(String(row.platform ?? "其他")) ?? { likeP95: 1, replyP95: 1 };
      const likeRatio = Math.min(1, Math.log1p(Math.max(0, Number(row.likes ?? 0))) / threshold.likeP95);
      const replyRatio = Math.min(1, Math.log1p(Math.max(0, Number(row.replies ?? 0))) / threshold.replyP95);
      return { ...row, resonance_weight: rounded(1 + 2 * likeRatio, 3), discussion_weight: rounded(1 + 2 * replyRatio, 3) } as Record<string, unknown> & { resonance_weight: number; discussion_weight: number };
    });
  }

  const weightedRows = withWeights(analysisRows.results);
  const weightsById = new Map(weightedRows.map((row) => [Number(row.id), { resonance_weight: Number(row.resonance_weight), discussion_weight: Number(row.discussion_weight) }]));
  const weightedComments = comments.results.map((row) => ({ ...row, ...(weightsById.get(Number(row.id)) ?? { resonance_weight: 1, discussion_weight: 1 }) }));
  const weightedRiskComments = riskComments.results.map((row) => ({ ...row, ...(weightsById.get(Number(row.id)) ?? { resonance_weight: 1, discussion_weight: 1 }) }));

  const sentimentWeights = new Map<string, { count: number; weight: number }>();
  const emotionWeights = new Map<string, { count: number; weight: number }>();
  const topicWeights = new Map<string, { topic: string; count: number; positive: number; neutral: number; negative: number; mixed: number; likes: number; replies: number; weight: number; negativeWeight: number }>();
  const timelineWeights = new Map<string, { date: string; total: number; positive: number; negative: number; weight: number; negativeWeight: number }>();
  for (const row of weightedRows) {
    const weight = Number(row.resonance_weight ?? 1);
    const tone = String(row.sentiment ?? "中性");
    const emotion = String(row.emotion ?? "中性陈述");
    const topic = String(row.topic ?? "其他讨论");
    const sentimentEntry = sentimentWeights.get(tone) ?? { count: 0, weight: 0 };
    sentimentEntry.count += 1; sentimentEntry.weight += weight; sentimentWeights.set(tone, sentimentEntry);
    const emotionEntry = emotionWeights.get(emotion) ?? { count: 0, weight: 0 };
    emotionEntry.count += 1; emotionEntry.weight += weight; emotionWeights.set(emotion, emotionEntry);
    const topicEntry = topicWeights.get(topic) ?? { topic, count: 0, positive: 0, neutral: 0, negative: 0, mixed: 0, likes: 0, replies: 0, weight: 0, negativeWeight: 0 };
    topicEntry.count += 1; topicEntry.weight += weight;
    topicEntry.likes += Math.max(0, Number(row.likes ?? 0));
    topicEntry.replies += Math.max(0, Number(row.replies ?? 0));
    if (tone === "正面") topicEntry.positive += 1;
    else if (tone === "负面") { topicEntry.negative += 1; topicEntry.negativeWeight += weight; }
    else if (tone === "混合") topicEntry.mixed += 1;
    else topicEntry.neutral += 1;
    topicWeights.set(topic, topicEntry);
    const date = String(row.published_at ?? "").slice(0, 10);
    if (date) {
      const day = timelineWeights.get(date) ?? { date, total: 0, positive: 0, negative: 0, weight: 0, negativeWeight: 0 };
      day.total += 1; day.weight += weight;
      if (tone === "正面") day.positive += 1;
      if (tone === "负面") { day.negative += 1; day.negativeWeight += weight; }
      timelineWeights.set(date, day);
    }
  }

  const weightedSentiment = Object.fromEntries(["正面", "中性", "负面", "混合"].map((tone) => [tone, rounded(sentimentWeights.get(tone)?.weight ?? 0)]));
  const weightedTotal = Object.values(weightedSentiment).reduce((sum, value) => sum + Number(value), 0);
  const weightedNet = weightedTotal ? Math.round((Number(weightedSentiment["正面"]) - Number(weightedSentiment["负面"])) / weightedTotal * 100) : 0;

  const weightedRegionalRows = withWeights(regionalRows.results);
  const regionMap = new Map<string, { region: string; confidence: string; basis: string; total: number; weight: number; positive: number; negative: number; weightedPositive: number; weightedNegative: number; topics: Map<string, number> }>();
  const confidenceRank: Record<string, number> = { 未知: 0, 低: 1, 中: 2, 高: 3 };
  for (const row of weightedRegionalRows) {
    const regionName = String(row.audience_region ?? "地区未知");
    const confidence = String(row.region_confidence ?? "未知");
    const basis = String(row.region_basis ?? "无公开地区信息");
    const weight = Number(row.resonance_weight ?? 1);
    const entry = regionMap.get(regionName) ?? { region: regionName, confidence, basis, total: 0, weight: 0, positive: 0, negative: 0, weightedPositive: 0, weightedNegative: 0, topics: new Map<string, number>() };
    if ((confidenceRank[confidence] ?? 0) > (confidenceRank[entry.confidence] ?? 0)) { entry.confidence = confidence; entry.basis = basis; }
    entry.total += 1; entry.weight += weight;
    if (row.sentiment === "正面") { entry.positive += 1; entry.weightedPositive += weight; }
    if (row.sentiment === "负面") { entry.negative += 1; entry.weightedNegative += weight; }
    const topic = String(row.topic ?? "其他讨论");
    entry.topics.set(topic, (entry.topics.get(topic) ?? 0) + weight);
    regionMap.set(regionName, entry);
  }
  const regions = [...regionMap.values()].map((entry) => {
    const net = entry.weight ? Math.round((entry.weightedPositive - entry.weightedNegative) / entry.weight * 100) : 0;
    const acceptance = entry.total < 3 ? "样本不足" : net >= 20 ? "接受度较高" : net >= 5 ? "偏正向" : net > -5 ? "观望" : net > -20 ? "存在顾虑" : "明显抵触";
    const topTopic = [...entry.topics.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "其他讨论";
    return { ...entry, topics: undefined, weight: rounded(entry.weight), weightedPositive: rounded(entry.weightedPositive), weightedNegative: rounded(entry.weightedNegative), net, acceptance, topTopic };
  }).sort((a, b) => b.weight - a.weight || b.total - a.total);

  const rankedTopics = [...topicWeights.values()].map((item) => ({ ...item, weight: rounded(item.weight), negativeWeight: rounded(item.negativeWeight) }))
    .sort((a, b) => b.weight - a.weight || b.count - a.count).slice(0, 10);
  const insights: Array<{ title: string; finding: string; evidence: string; action: string; tone: "positive" | "watch" | "risk" | "neutral" }> = [];
  const leadingTopic = rankedTopics[0];
  if (leadingTopic) {
    const representative = weightedRows.filter((row) => String(row.topic) === leadingTopic.topic)
      .sort((a, b) => (Number(b.likes ?? 0) + Number(b.replies ?? 0)) - (Number(a.likes ?? 0) + Number(a.replies ?? 0)))[0];
    const topicShare = Math.round(leadingTopic.count / Math.max(1, weightedRows.length) * 100);
    const negativeShare = Math.round(leadingTopic.negative / Math.max(1, leadingTopic.count) * 100);
    insights.push({ title: "受众最关心什么", finding: `“${leadingTopic.topic}”是当前最集中的讨论`, evidence: `${leadingTopic.count} 条评论，占已分析评论的 ${topicShare}%；其中 ${leadingTopic.negative} 条为负面，共获得 ${leadingTopic.likes} 个赞和 ${leadingTopic.replies} 条回复。${representative?.content ? `代表性表达：“${String(representative.content).slice(0, 92)}${String(representative.content).length > 92 ? "…" : ""}”` : ""}`, action: negativeShare >= 30 ? "先核对这些评论指向的具体产品疑问，再准备事实说明或常见问题回应。" : "把受众反复使用的具体表达整理为后续内容选题，避免只使用品牌内部语言。", tone: negativeShare >= 30 ? "risk" : "neutral" });
  }
  if (weightedRows.length) {
    const mostLiked = [...weightedRows].sort((a, b) => Number(b.likes ?? 0) - Number(a.likes ?? 0)).slice(0, Math.min(10, weightedRows.length));
    const topNegative = mostLiked.filter((row) => String(row.sentiment) === "负面");
    const topPositive = mostLiked.filter((row) => String(row.sentiment) === "正面");
    const negativeLikes = weightedRows.filter((row) => String(row.sentiment) === "负面").reduce((sum, row) => sum + Number(row.likes ?? 0), 0);
    const positiveLikes = weightedRows.filter((row) => String(row.sentiment) === "正面").reduce((sum, row) => sum + Number(row.likes ?? 0), 0);
    const direction = topNegative.length > topPositive.length ? "高互动评论更集中在质疑和担忧" : topPositive.length > topNegative.length ? "高互动评论更集中在认可和期待" : "高互动评论中的正负观点相对接近";
    insights.push({ title: "哪些观点获得响应", finding: direction, evidence: `获赞最多的 ${mostLiked.length} 条评论中，${topNegative.length} 条为负面、${topPositive.length} 条为正面。全部负面评论共获 ${negativeLikes} 赞，正面评论共获 ${positiveLikes} 赞。`, action: topNegative.length > topPositive.length ? "优先阅读获赞较多的负面原文，判断它们是否围绕同一事实形成共识。" : "提炼高赞正面评论认可的具体产品点，同时继续观察是否出现新的集中质疑。", tone: topNegative.length > topPositive.length ? "risk" : topPositive.length > topNegative.length ? "positive" : "neutral" });
  }
  const comparableRegions = regions.filter((item) => item.total >= 3);
  if (comparableRegions.length >= 2) {
    const best = [...comparableRegions].sort((a, b) => b.net - a.net)[0];
    const weakest = [...comparableRegions].sort((a, b) => a.net - b.net)[0];
    insights.push({ title: "不同地区的关注点", finding: `${best.region}与${weakest.region}呈现出不同的评论结构`, evidence: `${best.region}有 ${best.total} 条评论，其中 ${best.positive} 条正面、${best.negative} 条负面，主要讨论“${best.topTopic}”；${weakest.region}有 ${weakest.total} 条评论，其中 ${weakest.positive} 条正面、${weakest.negative} 条负面，主要讨论“${weakest.topTopic}”。`, action: "分别打开两地代表性原文，确认差异来自文化语境、传播素材还是产品信息，再决定是否本地化回应。", tone: best.net - weakest.net >= 20 ? "watch" : "neutral" });
  }
  const riskTopic = [...rankedTopics].filter((item) => item.negativeWeight > 0).sort((a, b) => b.negativeWeight - a.negativeWeight)[0];
  if (riskTopic) insights.push({ title: "最需要核对的质疑", finding: `负面反馈主要集中在“${riskTopic.topic}”`, evidence: `该议题包含 ${riskTopic.negative} 条负面评论，共获得 ${riskTopic.likes} 个赞和 ${riskTopic.replies} 条回复；占该议题全部 ${riskTopic.count} 条评论的 ${Math.round(riskTopic.negative / Math.max(1, riskTopic.count) * 100)}%。`, action: "先核对这些原文是否指向同一个可验证事实，再决定公开回应、补充说明或持续观察。", tone: riskTopic.negative >= 3 || riskTopic.likes >= 10 ? "risk" : "watch" });

  const evidenceComments = [...weightedRows]
    .filter((row) => String(row.content ?? "").trim())
    .sort((a, b) => (Number(b.likes ?? 0) + Number(b.replies ?? 0) * 2) - (Number(a.likes ?? 0) + Number(a.replies ?? 0) * 2))
    .slice(0, 8).map((row) => ({
      id: Number(row.id), content: String(row.content ?? ""), translation_en: String(row.translation_en ?? ""), language: String(row.language ?? ""), sentiment: String(row.sentiment ?? "中性"), emotion: String(row.emotion ?? "中性陈述"),
      topic: String(row.topic ?? "其他讨论"), likes: Number(row.likes ?? 0), replies: Number(row.replies ?? 0), platform: String(row.platform ?? ""),
      post_title: String(row.post_title ?? ""), post_translation_en: String(row.post_translation_en ?? ""), post_language: String(row.post_language ?? ""), audience_region: String(row.audience_region ?? "地区未知"), region_confidence: String(row.region_confidence ?? "未知"),
    }));

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
    meaningless: Number(summary?.meaningless ?? 0),
    meaningful_total: Number(summary?.meaningful_total ?? 0),
    average_score: Number(summary?.average_score ?? 0),
    weighted_positive: Number(weightedSentiment["正面"] ?? 0),
    weighted_neutral: Number(weightedSentiment["中性"] ?? 0),
    weighted_negative: Number(weightedSentiment["负面"] ?? 0),
    weighted_mixed: Number(weightedSentiment["混合"] ?? 0),
    weighted_total: rounded(weightedTotal),
    weighted_net: weightedNet,
  };

  return Response.json({
    summary: { ...safeSummary, reported, collected, coverage: reported ? Math.min(100, Math.round(collected / reported * 100)) : total ? 100 : 0 },
    sentiment: [...sentimentWeights.entries()].map(([label, value]) => ({ label, count: value.count, weight: rounded(value.weight) })).sort((a, b) => b.weight - a.weight),
    emotions: [...emotionWeights.entries()].map(([label, value]) => ({ label, count: value.count, weight: rounded(value.weight) })).sort((a, b) => b.weight - a.weight),
    timeline: [...timelineWeights.values()].map((item) => ({ ...item, weight: rounded(item.weight), negativeWeight: rounded(item.negativeWeight) })).sort((a, b) => a.date.localeCompare(b.date)),
    topics: rankedTopics,
    words,
    topPosts: topPosts.results,
    targets: targets.results,
    regions,
    insights,
    evidenceComments,
    riskComments: weightedRiskComments,
    comments: weightedComments,
    calibration,
    pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
    filters: { range, sentiment, platform, region, query, postId, sort, annotation },
  });
}
