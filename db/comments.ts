type MentionRow = { id: number; url: string; source: string };
type CommentSample = { id: string; text: string; likes: number; replies: number; publishedAt: string };
type Collection = { adapter: string; status: "collected" | "empty" | "unsupported" | "blocked" | "error"; reportedCount: number; samples: CommentSample[]; error?: string };

const NETEASE_PRODUCT = "a2869674571f77b5a0867c3d71db5856";
const SIX_HOURS = 6 * 3600_000;
const MAX_ARTICLES_PER_RUN = 6;
const MAX_COMMENTS_PER_ARTICLE = 100;

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0" || host === "::1" || /^127\./.test(host) || /^10\./.test(host)
      || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    return url;
  } catch { return null; }
}

function plainText(value: unknown) {
  return String(value ?? "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ").trim().slice(0, 2000);
}

function commentIdFrom(row: Record<string, unknown>, fallback: string) {
  for (const key of ["commentId", "id", "comment_id"]) {
    const value = row[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return fallback;
}

function commentTextFrom(row: Record<string, unknown>) {
  for (const key of ["content", "text", "commentText", "body", "description"]) {
    const value = plainText(row[key]);
    if (value) return value;
  }
  return "";
}

function numberFrom(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value) && value >= 0) return Math.round(value);
  }
  return 0;
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "SignalAtlas/2.1 public-comment-monitor" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`公开评论端点 HTTP ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

async function collectNetEase(url: URL): Promise<Collection> {
  const documentId = url.pathname.match(/\/article\/([A-Za-z0-9]+)\.html/i)?.[1];
  if (!documentId) return { adapter: "网易公开评论", status: "unsupported", reportedCount: 0, samples: [], error: "无法识别网易文章编号" };
  const samples = new Map<string, CommentSample>();
  let reportedCount = 0;
  for (let offset = 0; offset < MAX_COMMENTS_PER_ARTICLE; offset += 30) {
    const endpoint = `https://comment.tie.163.com/api/v1/products/${NETEASE_PRODUCT}/threads/${encodeURIComponent(documentId)}/comments/newList?offset=${offset}&limit=30&showLevelThreshold=72&headLimit=1&tailLimit=2`;
    const payload = await fetchJson(endpoint);
    reportedCount = Math.max(reportedCount, Number(payload.newListSize ?? payload.total ?? 0) || 0);
    const rows = payload.comments && typeof payload.comments === "object" ? payload.comments as Record<string, unknown> : {};
    for (const [fallbackId, raw] of Object.entries(rows)) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const text = commentTextFrom(row);
      if (!text) continue;
      const id = commentIdFrom(row, fallbackId);
      samples.set(id, {
        id, text,
        likes: numberFrom(row, ["vote", "likeCount", "likes"]),
        replies: numberFrom(row, ["replyCount", "replies", "childCount"]),
        publishedAt: String(row.createTime ?? row.create_time ?? row.time ?? ""),
      });
      if (samples.size >= MAX_COMMENTS_PER_ARTICLE) break;
    }
    if (samples.size >= MAX_COMMENTS_PER_ARTICLE || (reportedCount && offset + 30 >= reportedCount) || !Object.keys(rows).length) break;
  }
  const list = [...samples.values()];
  return { adapter: "网易公开评论", status: list.length ? "collected" : "empty", reportedCount: Math.max(reportedCount, list.length), samples: list };
}

function commentObjects(value: unknown, output: Record<string, unknown>[]) {
  if (Array.isArray(value)) { value.forEach((item) => commentObjects(item, output)); return; }
  if (!value || typeof value !== "object") return;
  const row = value as Record<string, unknown>;
  const type = row["@type"];
  if (type === "Comment" || (Array.isArray(type) && type.includes("Comment"))) output.push(row);
  for (const child of Object.values(row)) commentObjects(child, output);
}

async function collectEmbedded(url: URL): Promise<Collection> {
  const response = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "SignalAtlas/2.1 public-comment-monitor" },
    redirect: "follow", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return { adapter: "网页结构化评论", status: response.status === 401 || response.status === 403 ? "blocked" : "error", reportedCount: 0, samples: [], error: `文章页面 HTTP ${response.status}` };
  const html = (await response.text()).slice(0, 2_000_000);
  const objects: Record<string, unknown>[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { commentObjects(JSON.parse(match[1]), objects); } catch { /* Ignore malformed publisher JSON-LD. */ }
  }
  const samples = objects.slice(0, MAX_COMMENTS_PER_ARTICLE).map((row, index) => ({
    id: commentIdFrom(row, `jsonld-${index}`), text: commentTextFrom(row),
    likes: numberFrom(row, ["upvoteCount", "likeCount", "likes"]), replies: numberFrom(row, ["replyCount", "replies"]),
    publishedAt: String(row.dateCreated ?? row.datePublished ?? ""),
  })).filter((item) => item.text);
  const visibleCount = [...html.matchAll(/(?:评论|留言|comments?)\s*[（(]?\s*([0-9]{1,7})/gi)]
    .map((item) => Number(item[1])).filter(Number.isFinite).sort((a, b) => b - a)[0] ?? 0;
  return { adapter: "网页结构化评论", status: samples.length ? "collected" : visibleCount ? "blocked" : "unsupported", reportedCount: Math.max(visibleCount, samples.length), samples,
    error: samples.length ? "" : visibleCount ? "页面显示评论数，但评论文本由登录或动态接口保护" : "未发现公开可读取的结构化评论" };
}

async function collectForMention(mention: MentionRow): Promise<Collection> {
  const url = safeHttpUrl(mention.url);
  if (!url) return { adapter: "", status: "blocked", reportedCount: 0, samples: [], error: "链接未通过安全校验" };
  try {
    if (/(^|\.)163\.com$/i.test(url.hostname) || /网易|網易/i.test(mention.source)) return await collectNetEase(url);
    return await collectEmbedded(url);
  } catch (error) {
    return { adapter: /163\.com$/i.test(url.hostname) ? "网易公开评论" : "网页结构化评论", status: "error", reportedCount: 0, samples: [], error: error instanceof Error ? error.message : "评论采集失败" };
  }
}

async function storeCollection(db: D1Database, brandId: number, mentionId: number, collection: Collection, brandTerms: string[]) {
  const capturedAt = new Date().toISOString();
  const calibrationRules = await loadCalibrationRules(db, brandId);
  const analyzed = collection.samples.map((sample) => ({ ...sample, ...applyCalibrationRules(sample.text, analyzeCommentText(sample.text), calibrationRules) }));
  const counts = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  let score = 0;
  for (const item of analyzed) {
    if (item.sentiment === "正面") counts.positive += 1;
    else if (item.sentiment === "负面") counts.negative += 1;
    else if (item.sentiment === "混合") counts.mixed += 1;
    else counts.neutral += 1;
    score += item.score;
  }
  const sentiment = !analyzed.length ? "样本不足" : counts.positive > counts.negative && counts.positive >= counts.neutral ? "正面"
    : counts.negative > counts.positive && counts.negative >= counts.neutral ? "负面" : counts.positive && counts.negative ? "混合" : "中性";
  const keywords = keywordCounts(collection.samples.map((sample) => sample.text), brandTerms);
  await db.prepare(`INSERT INTO comment_analyses
    (mention_id, brand_id, adapter, status, reported_count, analyzed_count, positive_count, neutral_count, negative_count, mixed_count, sentiment, sentiment_score, keywords, last_error, last_collected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(mention_id) DO UPDATE SET adapter = excluded.adapter, status = excluded.status, reported_count = excluded.reported_count,
      analyzed_count = excluded.analyzed_count, positive_count = excluded.positive_count, neutral_count = excluded.neutral_count,
      negative_count = excluded.negative_count, mixed_count = excluded.mixed_count, sentiment = excluded.sentiment,
      sentiment_score = excluded.sentiment_score, keywords = excluded.keywords, last_error = excluded.last_error, last_collected_at = excluded.last_collected_at`)
    .bind(mentionId, brandId, collection.adapter, collection.status, collection.reportedCount, analyzed.length, counts.positive, counts.neutral,
      counts.negative, counts.mixed, sentiment, analyzed.length ? Math.round(score / analyzed.length) : 0, JSON.stringify(keywords), collection.error ?? "", capturedAt).run();
  for (let index = 0; index < analyzed.length; index += 40) {
    const statements = analyzed.slice(index, index + 40).map((item) => db.prepare(`INSERT INTO mention_comments
      (mention_id, brand_id, platform, source_comment_id, content, sentiment, emotion, sentiment_score, language, topic, keywords, likes, replies, published_at, collected_at, fetched_via)
      VALUES (?, ?, '网页新闻', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '公开网页适配器')
      ON CONFLICT(mention_id, source_comment_id) DO UPDATE SET
        translation_en = CASE WHEN mention_comments.content != excluded.content THEN '' ELSE mention_comments.translation_en END,
        translation_status = CASE WHEN mention_comments.content != excluded.content THEN 'pending' ELSE mention_comments.translation_status END,
        translation_source_hash = CASE WHEN mention_comments.content != excluded.content THEN '' ELSE mention_comments.translation_source_hash END,
        translation_provider = CASE WHEN mention_comments.content != excluded.content THEN '' ELSE mention_comments.translation_provider END,
        translated_at = CASE WHEN mention_comments.content != excluded.content THEN '' ELSE mention_comments.translated_at END,
        content = excluded.content,
        sentiment = CASE WHEN EXISTS (SELECT 1 FROM comment_annotations annotation WHERE annotation.comment_id = mention_comments.id) THEN mention_comments.sentiment ELSE excluded.sentiment END,
        emotion = CASE WHEN EXISTS (SELECT 1 FROM comment_annotations annotation WHERE annotation.comment_id = mention_comments.id) THEN mention_comments.emotion ELSE excluded.emotion END,
        sentiment_score = CASE WHEN EXISTS (SELECT 1 FROM comment_annotations annotation WHERE annotation.comment_id = mention_comments.id) THEN mention_comments.sentiment_score ELSE excluded.sentiment_score END,
        language = excluded.language,
        topic = CASE WHEN EXISTS (SELECT 1 FROM comment_annotations annotation WHERE annotation.comment_id = mention_comments.id) THEN mention_comments.topic ELSE excluded.topic END,
        keywords = excluded.keywords,
        likes = excluded.likes, replies = excluded.replies, published_at = excluded.published_at, collected_at = excluded.collected_at`)
      .bind(mentionId, brandId, item.id, item.text, item.sentiment, item.emotion, item.score, item.language, item.topic,
        JSON.stringify(keywordCounts([item.text], brandTerms, 8)), item.likes, item.replies, item.publishedAt, capturedAt));
    if (statements.length) await db.batch(statements);
  }
}

export async function refreshPublicCommentAnalyses(db: D1Database, brandId: number, brandTerms: string[]) {
  const staleBefore = new Date(Date.now() - SIX_HOURS).toISOString();
  const rows = await db.prepare(`SELECT mentions.id, mentions.url, mentions.source FROM mentions
    LEFT JOIN comment_analyses ON comment_analyses.mention_id = mentions.id
    WHERE mentions.brand_id = ? AND mentions.platform = '网页新闻' AND mentions.published_at >= datetime('now', '-31 days')
      AND (comment_analyses.mention_id IS NULL OR comment_analyses.last_collected_at < ?)
    ORDER BY CASE WHEN mentions.url LIKE '%163.com/%' OR mentions.source LIKE '%网易%' THEN 0 ELSE 1 END, mentions.published_at DESC
    LIMIT ?`).bind(brandId, staleBefore, MAX_ARTICLES_PER_RUN).all<MentionRow>();
  let analyzedArticles = 0;
  let analyzedComments = 0;
  const warnings: string[] = [];
  const collected = await Promise.all(rows.results.map(async (mention) => ({ mention, collection: await collectForMention(mention) })));
  for (const { mention, collection } of collected) {
    await storeCollection(db, brandId, mention.id, collection, brandTerms);
    if (collection.samples.length) { analyzedArticles += 1; analyzedComments += collection.samples.length; }
    if (collection.status === "error") warnings.push(`${mention.source}: ${collection.error ?? "评论采集失败"}`);
  }
  return { checkedArticles: rows.results.length, analyzedArticles, analyzedComments, warnings };
}
import { applyCalibrationRules, loadCalibrationRules } from "./comment-calibration";
import { analyzeCommentText, keywordCounts } from "./text-analysis";
