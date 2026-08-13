import { ProviderRequestError, type MonitoringCandidate } from "./providers";
import { analyzeCommentText, keywordCounts } from "./text-analysis";

type JsonObject = Record<string, unknown>;
type MonidRun = {
  runId: string;
  status: string;
  output?: unknown;
  providerResponse?: { httpStatus?: number; error?: { message?: string } };
  cost?: { value?: number; currency?: string } | number | null;
};
type MonidJobStage = "search" | "search_x" | "search_youtube" | "search_tiktok" | "search_facebook" | "profiles" | "resolve_post" | "post_comments" | "comment_replies";
type MonidJob = { id: number; run_id: string; mention_id: number; stage: MonidJobStage; status: string; terms: string };
type CommentJobPayload = { mentionId: number; platform?: string; mediaId: string; postUrl: string; cursor?: string; commentId?: string; page?: number };
type SocialComment = {
  id: string; parentId: string; text: string; authorId: string; authorUsername: string; authorName: string;
  verified: boolean; likes: number; replies: number; publishedAt: string; commentUrl: string;
};
type CommentTarget = { mention_id: number; platform: string; media_id: string; post_url: string; cursor: string; pages_fetched: number };
type ReplyTarget = { mention_id: number; media_id: string; parent_comment_id: string; cursor: string; pages_fetched: number };

const API_BASE = "https://api.monid.ai";
const SEARCH_ENDPOINT = "/apify/instagram-hashtag-scraper";
const PROFILE_ENDPOINT = "/apify/instagram-profile-scraper";
const POST_BY_URL_ENDPOINT = "/api/v1/instagram/v1/fetch_post_by_url";
const COMMENTS_ENDPOINT = "/api/v1/instagram/v1/fetch_post_comments_v2";
const REPLIES_ENDPOINT = "/api/v1/instagram/v1/fetch_comment_replies";
const SOCIAL_SEARCHES = {
  X: { stage: "search_x" as const, provider: "tikhub", endpoint: "/api/v1/twitter/web/fetch_search_timeline" },
  YouTube: { stage: "search_youtube" as const, provider: "tikhub", endpoint: "/api/v1/youtube/web_v2/get_general_search_v2" },
  TikTok: { stage: "search_tiktok" as const, provider: "tikhub", endpoint: "/api/v1/tiktok/web/fetch_general_search" },
  Facebook: { stage: "search_facebook" as const, provider: "blockrun.ai", endpoint: "/api/v1/exa/search" },
};
const TERMINAL = new Set(["COMPLETED", "FAILED", "BLOCKED", "STOPPED", "TIME_OUT"]);
const PENDING_SQL = "'CREATED','QUEUED','PENDING','READY','RUNNING'";
const COMMENT_JOBS_PER_CYCLE = 2;

function pathValue(value: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, key) => current && typeof current === "object" ? (current as JsonObject)[key] : undefined, value);
}

function firstText(value: unknown, paths: string[]) {
  for (const path of paths) {
    const candidate = pathValue(value, path);
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
  }
  return "";
}

function firstNumber(value: unknown, paths: string[]) {
  for (const path of paths) {
    const candidate = Number(pathValue(value, path));
    if (Number.isFinite(candidate) && candidate >= 0) return candidate;
  }
  return 0;
}

function optionalNumber(value: unknown, paths: string[]) {
  for (const path of paths) {
    const raw = pathValue(value, path);
    if (raw === undefined || raw === null || raw === "") continue;
    const candidate = Number(raw);
    if (Number.isFinite(candidate) && candidate >= 0) return candidate;
  }
  return -1;
}

function firstBoolean(value: unknown, paths: string[]) {
  for (const path of paths) {
    const candidate = pathValue(value, path);
    if (typeof candidate === "boolean") return candidate;
    if (candidate === 1 || candidate === "1" || candidate === "true") return true;
  }
  return false;
}

function rowsFromOutput(output: unknown): JsonObject[] {
  if (Array.isArray(output)) return output.filter((item): item is JsonObject => Boolean(item) && typeof item === "object");
  if (!output || typeof output !== "object") return [];
  for (const key of ["items", "results", "data", "datasetItems"]) {
    const rows = (output as JsonObject)[key];
    if (Array.isArray(rows)) return rows.filter((item): item is JsonObject => Boolean(item) && typeof item === "object");
  }
  return [output as JsonObject];
}

function isoDate(value: unknown) {
  if (typeof value === "number") {
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function retryAfterMs(response: Response) {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const absolute = new Date(header).getTime();
  return Number.isNaN(absolute) ? null : Math.max(0, absolute - Date.now());
}

async function monidRequest(apiKey: string, path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await response.json().catch(() => ({})) as MonidRun & { message?: string; error?: { message?: string } };
  if (!response.ok && response.status !== 202) {
    const message = payload.error?.message ?? payload.message ?? `Monid HTTP ${response.status}`;
    throw new ProviderRequestError("Monid / Instagram", response.status, retryAfterMs(response), message);
  }
  return payload;
}

async function startRun(apiKey: string, endpoint: string, body: JsonObject) {
  return monidRequest(apiKey, "/v1/run", {
    method: "POST",
    body: JSON.stringify({ provider: "apify", endpoint, input: { body } }),
  });
}

async function startQueryRun(apiKey: string, endpoint: string, queryParams: JsonObject) {
  return monidRequest(apiKey, "/v1/run", {
    method: "POST",
    body: JSON.stringify({ provider: "tikhub", endpoint, input: { queryParams } }),
  });
}

async function startProviderRun(apiKey: string, provider: string, endpoint: string, input: JsonObject) {
  return monidRequest(apiKey, "/v1/run", {
    method: "POST",
    body: JSON.stringify({ provider, endpoint, input }),
  });
}

async function getRun(apiKey: string, runId: string) {
  return monidRequest(apiKey, `/v1/runs/${encodeURIComponent(runId)}`);
}

export async function verifyMonidApiKey(apiKey: string) {
  if (!apiKey.startsWith("monid_")) throw new Error("Monid API Key 格式不正确");
  await monidRequest(apiKey, "/v1/auth/whoami");
}

function normalized(value: string) { return value.normalize("NFKC").toLocaleLowerCase(); }

function postUrl(row: JsonObject, postId: string) {
  const direct = firstText(row, ["url", "postUrl", "inputUrl", "permalink"]);
  if (direct) return direct;
  const shortCode = firstText(row, ["shortCode", "shortcode", "code"]);
  return shortCode ? `https://www.instagram.com/p/${shortCode}/` : postId ? `https://www.instagram.com/p/${postId}/` : "";
}

function parseInstagramPosts(output: unknown, terms: string[]): MonitoringCandidate[] {
  const candidates: MonitoringCandidate[] = [];
  const seen = new Set<string>();
  for (const row of rowsFromOutput(output)) {
    const caption = firstText(row, ["caption", "text", "description", "edge_media_to_caption.edges.0.node.text"]);
    if (!caption) continue;
    const normalizedCaption = normalized(caption);
    const matchedTerms = terms.filter((term) => normalizedCaption.includes(normalized(term)));
    if (!matchedTerms.length) continue;
    const rawPostId = firstText(row, ["id", "postId", "pk", "mediaId"]);
    const postId = rawPostId.match(/^\d{10,}/)?.[0] ?? rawPostId;
    const url = postUrl(row, postId);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const authorUsername = firstText(row, ["ownerUsername", "username", "owner.username", "user.username", "ownerUsername"]);
    const authorName = firstText(row, ["ownerFullName", "fullName", "owner.fullName", "user.full_name", "user.fullName"]);
    const authorId = firstText(row, ["ownerId", "owner.id", "user.id", "user.pk", "ownerPk"]);
    const likes = optionalNumber(row, ["likesCount", "likeCount", "likes", "edge_liked_by.count", "edge_media_preview_like.count"]);
    const comments = optionalNumber(row, ["commentsCount", "commentCount", "comments", "edge_media_to_comment.count", "edge_media_to_parent_comment.count"]);
    const shares = optionalNumber(row, ["resharesCount", "sharesCount", "shareCount", "reshareCount"]);
    const views = optionalNumber(row, ["videoViewCount", "viewCount", "viewsCount", "views"]);
    const plays = optionalNumber(row, ["videoPlayCount", "playCount", "playsCount", "plays"]);
    const latestComments = pathValue(row, "latestComments");
    const titleText = caption.replace(/\s+/g, " ").trim();
    const title = `${titleText.slice(0, 150)}${titleText.length > 150 ? "…" : ""}`;
    const declaredCountry = firstText(row, ["location.country", "location.countryName", "country", "ownerCountry"]);
    candidates.push({
      title,
      url,
      source: authorUsername ? `@${authorUsername}` : "Instagram",
      platform: "Instagram",
      sourceCountry: declaredCountry || "地区待确认",
      language: "语言待确认",
      publishedAt: isoDate(pathValue(row, "timestamp") ?? pathValue(row, "takenAt") ?? pathValue(row, "taken_at") ?? pathValue(row, "createdAt")),
      engagement: Math.round(Math.max(0, likes) + Math.max(0, comments) + Math.max(0, shares)),
      discussionText: caption,
      commentsAnalyzed: Array.isArray(latestComments) ? latestComments.length : 0,
      parentUrl: "",
      relation: `普通文字关键词：${matchedTerms.join("、")}`,
      author: authorUsername ? `@${authorUsername}` : authorName,
      provider: "Monid · Apify",
      discoveredVia: "monid_public_search",
      socialMetrics: { postId, authorId, authorUsername, authorName, followerCount: 0, likes, comments, shares, views, plays, matchedTerms },
    });
  }
  return candidates;
}

function walkObjects(value: unknown, output: JsonObject[] = [], depth = 0) {
  if (depth > 9 || output.length > 1600 || !value || typeof value !== "object") return output;
  if (Array.isArray(value)) { for (const item of value) walkObjects(item, output, depth + 1); return output; }
  const object = value as JsonObject;
  output.push(object);
  for (const child of Object.values(object)) walkObjects(child, output, depth + 1);
  return output;
}

function platformPostUrl(platform: string, row: JsonObject, postId: string, username: string) {
  const direct = firstText(row, ["url", "web_url", "postUrl", "permalink", "link", "video_url", "navigation_url"]);
  if (direct && /^https?:\/\//.test(direct)) return direct;
  if (platform === "X" && postId) return `https://x.com/${username || "i"}/status/${postId}`;
  if (platform === "YouTube" && postId) return `https://www.youtube.com/watch?v=${postId}`;
  if (platform === "TikTok" && postId) return `https://www.tiktok.com/@${username || "user"}/video/${postId}`;
  return "";
}

function parseSocialPosts(output: unknown, terms: string[], platform: "X" | "YouTube" | "TikTok" | "Facebook") {
  const candidates: MonitoringCandidate[] = [];
  const seen = new Set<string>();
  for (const row of walkObjects(output)) {
    const text = firstText(row, platform === "YouTube"
      ? ["title", "headline", "description", "snippet.title"]
      : platform === "TikTok" ? ["aweme_info.desc", "desc", "caption", "text", "title"]
      : platform === "X" ? ["legacy.full_text", "full_text", "note_tweet.note_tweet_results.result.text", "text", "title"]
      : ["text", "title", "content", "description"]);
    if (!text) continue;
    const normalizedText = normalized(text);
    const matchedTerms = terms.filter((term) => normalizedText.includes(normalized(term)));
    if (!matchedTerms.length) continue;
    const postId = firstText(row, platform === "YouTube" ? ["video_id", "videoId", "id"]
      : platform === "TikTok" ? ["aweme_info.aweme_id", "aweme_id", "id"]
      : platform === "X" ? ["rest_id", "tweet_id", "id_str", "id"] : ["id", "postId"]);
    const authorUsername = firstText(row, platform === "YouTube" ? ["author.name", "channel.title", "channel_name", "ownerText"]
      : platform === "TikTok" ? ["aweme_info.author.unique_id", "author.unique_id", "author.username", "username"]
      : platform === "X" ? ["core.user_results.result.legacy.screen_name", "user.legacy.screen_name", "screen_name", "username"]
      : ["author", "authorName", "source"]);
    const authorName = firstText(row, ["author.name", "author.nickname", "core.user_results.result.legacy.name", "user.name", "channel_name", "source"]);
    const authorId = firstText(row, ["author.id", "author.uid", "channel_id", "core.user_results.result.rest_id", "user.id", "ownerId"]);
    const url = platformPostUrl(platform, row, postId, authorUsername);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const likes = optionalNumber(row, ["legacy.favorite_count", "statistics.digg_count", "aweme_info.statistics.digg_count", "like_count", "likes", "reactions"]);
    const comments = optionalNumber(row, ["legacy.reply_count", "statistics.comment_count", "aweme_info.statistics.comment_count", "comment_count", "comments"]);
    const shares = optionalNumber(row, ["legacy.retweet_count", "statistics.share_count", "aweme_info.statistics.share_count", "share_count", "shares"]);
    const views = optionalNumber(row, ["views", "view_count", "statistics.play_count", "aweme_info.statistics.play_count", "legacy.ext_views.count"]);
    const followers = optionalNumber(row, ["author.follower_count", "author.followerCount", "core.user_results.result.legacy.followers_count", "channel.subscriber_count"]);
    const published = pathValue(row, "aweme_info.create_time") ?? pathValue(row, "create_time") ?? pathValue(row, "published_time") ?? pathValue(row, "publishedAt") ?? pathValue(row, "legacy.created_at") ?? pathValue(row, "date");
    const title = `${text.replace(/\s+/g, " ").trim().slice(0, 150)}${text.length > 150 ? "…" : ""}`;
    candidates.push({
      title, url, source: authorUsername ? `@${authorUsername}` : authorName || platform, platform,
      sourceCountry: "地区待确认", language: "语言待确认", publishedAt: isoDate(published),
      engagement: Math.max(0, likes) + Math.max(0, comments) + Math.max(0, shares), discussionText: text,
      commentsAnalyzed: 0, parentUrl: "", relation: `普通文字关键词：${matchedTerms.join("、")}`,
      author: authorUsername ? `@${authorUsername}` : authorName, provider: platform === "Facebook" ? "Monid · Exa" : "Monid · TikHub",
      discoveredVia: "monid_public_search",
      socialMetrics: { postId: postId || (platform === "Facebook" ? url : ""), authorId, authorUsername, authorName, followerCount: followers, likes, comments, shares, views, plays: views, matchedTerms },
    });
  }
  return candidates.slice(0, 100);
}

function costValue(value: MonidRun["cost"]) {
  const dollars = typeof value === "number" ? value : Number(value?.value ?? 0) || 0;
  return Math.max(0, Math.round(dollars * 1_000_000));
}

async function saveJob(db: D1Database, brandId: number, run: MonidRun, stage: MonidJobStage, payload: unknown, mentionId = 0) {
  const inserted = await db.prepare(`INSERT OR IGNORE INTO monid_jobs
    (brand_id, mention_id, run_id, stage, status, terms, cost, started_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`)
    .bind(brandId, mentionId, run.runId, stage, run.status || "RUNNING", JSON.stringify(payload), new Date().toISOString(), new Date().toISOString()).run();
  const row = await db.prepare("SELECT id, run_id, mention_id, stage, status, terms FROM monid_jobs WHERE run_id = ?")
    .bind(run.runId).first<MonidJob>();
  if (!row) throw new Error("Monid 任务未能写入队列");
  void inserted;
  return row;
}

async function updateJob(db: D1Database, job: MonidJob, run: MonidRun, error = "") {
  const terminal = TERMINAL.has(run.status);
  await db.prepare(`UPDATE monid_jobs SET status = ?, cost = ?, error = ?, completed_at = ?, updated_at = ? WHERE id = ?`)
    .bind(run.status, costValue(run.cost), error, terminal ? new Date().toISOString() : "", new Date().toISOString(), job.id).run();
}

function nestedObjectWithArray(value: unknown, keys: string[], depth = 0): JsonObject | null {
  if (depth > 6 || !value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) { const found = nestedObjectWithArray(item, keys, depth + 1); if (found) return found; }
    return null;
  }
  const object = value as JsonObject;
  if (keys.some((key) => Array.isArray(object[key]))) return object;
  for (const child of Object.values(object)) { const found = nestedObjectWithArray(child, keys, depth + 1); if (found) return found; }
  return null;
}

function cursorText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") { try { return JSON.stringify(value); } catch { return ""; } }
  return value == null ? "" : String(value);
}

function commentFromRow(row: JsonObject, postUrl: string, parentId = ""): SocialComment | null {
  const text = firstText(row, ["text", "content", "comment_text", "full_text", "legacy.full_text", "snippet.textDisplay", "snippet.textOriginal"]);
  const id = firstText(row, ["pk", "id", "comment_id", "commentId", "rest_id", "id_str"]);
  if (!text || !id) return null;
  return {
    id,
    parentId: firstText(row, ["parent_comment_id"]) || parentId,
    text,
    authorId: firstText(row, ["user.pk", "user.id", "owner.id", "ownerId", "author.channel_id", "snippet.authorChannelId.value"]),
    authorUsername: firstText(row, ["user.username", "owner.username", "ownerUsername", "username", "author.display_name", "snippet.authorDisplayName"]),
    authorName: firstText(row, ["user.full_name", "user.fullName", "owner.full_name", "ownerFullName", "fullName", "author.display_name", "snippet.authorDisplayName"]),
    verified: firstBoolean(row, ["user.is_verified", "user.verified", "owner.is_verified", "isVerified"]),
    likes: firstNumber(row, ["comment_like_count", "likesCount", "likeCount", "likes", "like_count", "snippet.likeCount", "legacy.favorite_count"]),
    replies: firstNumber(row, ["child_comment_count", "replyCount", "replies", "reply_count", "legacy.reply_count"]),
    publishedAt: isoDate(pathValue(row, "created_at_utc") ?? pathValue(row, "created_at") ?? pathValue(row, "timestamp")),
    commentUrl: firstText(row, ["comment_url", "url", "permalink"]) || postUrl,
  };
}

function resolvedInstagramPost(output: unknown) {
  for (const row of walkObjects(output)) {
    const mediaId = firstText(row, ["media_id", "mediaId", "pk", "id"]).match(/^\d{10,}/)?.[0] ?? "";
    if (!mediaId) continue;
    const shortcode = firstText(row, ["code", "shortcode"]);
    const caption = firstText(row, ["caption.text", "caption", "text", "description"]);
    const comments = optionalNumber(row, ["comment_count", "comments_count", "comments", "edge_media_to_parent_comment.count"]);
    if (!shortcode && !caption && comments < 0 && !pathValue(row, "media_type")) continue;
    return {
      mediaId,
      caption,
      comments,
      likes: optionalNumber(row, ["like_count", "likes_count", "likes"]),
      username: firstText(row, ["user.username", "owner.username", "username"]),
      authorId: firstText(row, ["user.pk", "user.id", "owner.pk", "owner.id"]),
    };
  }
  return null;
}

async function brandTermsFor(db: D1Database, brandId: number) {
  const rows = await db.prepare("SELECT value FROM tracked_entities WHERE brand_id = ? AND active = 1 AND type NOT IN ('排除词','官网域名')")
    .bind(brandId).all<{ value: string }>();
  return rows.results.map((item) => item.value);
}

async function storeSocialComments(db: D1Database, brandId: number, mentionId: number, platform: string, rows: SocialComment[], brandTerms: string[]) {
  const capturedAt = new Date().toISOString();
  const unique = [...new Map(rows.map((item) => [item.id, item])).values()];
  for (let index = 0; index < unique.length; index += 35) {
    const statements = unique.slice(index, index + 35).map((item) => {
      const analysis = analyzeCommentText(item.text);
      return db.prepare(`INSERT INTO mention_comments
        (mention_id, brand_id, platform, source_comment_id, parent_comment_id, author_id, author_username, author_name, is_verified,
         content, sentiment, emotion, sentiment_score, language, topic, keywords, likes, replies, comment_url, fetched_via, published_at, collected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Monid', ?, ?)
        ON CONFLICT(mention_id, source_comment_id) DO UPDATE SET parent_comment_id = excluded.parent_comment_id,
          author_id = excluded.author_id, author_username = excluded.author_username, author_name = excluded.author_name,
          is_verified = excluded.is_verified, content = excluded.content, sentiment = excluded.sentiment, emotion = excluded.emotion,
          sentiment_score = excluded.sentiment_score, language = excluded.language, topic = excluded.topic,
          keywords = excluded.keywords, likes = excluded.likes, replies = excluded.replies, comment_url = excluded.comment_url,
          fetched_via = excluded.fetched_via, published_at = excluded.published_at, collected_at = excluded.collected_at`)
        .bind(mentionId, brandId, platform, item.id, item.parentId, item.authorId, item.authorUsername, item.authorName, item.verified ? 1 : 0,
          item.text, analysis.sentiment, analysis.emotion, analysis.score, analysis.language, analysis.topic,
          JSON.stringify(keywordCounts([item.text], brandTerms, 8)), item.likes, item.replies, item.commentUrl, item.publishedAt, capturedAt);
    });
    if (statements.length) await db.batch(statements);
  }
}

async function refreshSocialCommentAnalysis(db: D1Database, brandId: number, mentionId: number, brandTerms: string[]) {
  const [rows, target, pendingReplies] = await Promise.all([
    db.prepare("SELECT content, sentiment, sentiment_score FROM mention_comments WHERE brand_id = ? AND mention_id = ?")
      .bind(brandId, mentionId).all<{ content: string; sentiment: string; sentiment_score: number }>(),
    db.prepare("SELECT reported_count, top_level_complete, status, last_error FROM social_comment_targets WHERE brand_id = ? AND mention_id = ?")
      .bind(brandId, mentionId).first<{ reported_count: number; top_level_complete: number; status: string; last_error: string }>(),
    db.prepare("SELECT COUNT(*) AS count FROM social_comment_reply_queue WHERE brand_id = ? AND mention_id = ? AND status != 'complete'")
      .bind(brandId, mentionId).first<{ count: number }>(),
  ]);
  const counts = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  let score = 0;
  for (const row of rows.results) {
    if (row.sentiment === "正面") counts.positive += 1;
    else if (row.sentiment === "负面") counts.negative += 1;
    else if (row.sentiment === "混合") counts.mixed += 1;
    else counts.neutral += 1;
    score += Number(row.sentiment_score ?? 0);
  }
  const analyzedCount = rows.results.length;
  const complete = Boolean(target?.top_level_complete) && Number(pendingReplies?.count ?? 0) === 0;
  const preservedStatus = ["not_returned", "blocked"].includes(target?.status ?? "") ? target!.status : "";
  const targetStatus = preservedStatus || (complete ? "complete" : "collecting");
  const sentiment = !analyzedCount ? "样本不足" : counts.positive > counts.negative && counts.positive >= counts.neutral ? "正面"
    : counts.negative > counts.positive && counts.negative >= counts.neutral ? "负面" : counts.positive && counts.negative ? "混合" : "中性";
  const keywords = keywordCounts(rows.results.map((row) => row.content), brandTerms);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO comment_analyses
      (mention_id, brand_id, adapter, status, reported_count, analyzed_count, positive_count, neutral_count, negative_count, mixed_count,
       sentiment, sentiment_score, keywords, last_error, last_collected_at)
      VALUES (?, ?, 'Monid / TikHub', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(mention_id) DO UPDATE SET adapter = excluded.adapter, status = excluded.status,
        reported_count = excluded.reported_count, analyzed_count = excluded.analyzed_count,
        positive_count = excluded.positive_count, neutral_count = excluded.neutral_count,
        negative_count = excluded.negative_count, mixed_count = excluded.mixed_count,
        sentiment = excluded.sentiment, sentiment_score = excluded.sentiment_score, keywords = excluded.keywords,
        last_error = excluded.last_error, last_collected_at = excluded.last_collected_at`)
      .bind(mentionId, brandId, targetStatus === "complete" ? "collected" : targetStatus, Number(target?.reported_count ?? analyzedCount), analyzedCount,
        counts.positive, counts.neutral, counts.negative, counts.mixed, sentiment,
        analyzedCount ? Math.round(score / analyzedCount) : 0, JSON.stringify(keywords), target?.last_error ?? "", now),
    db.prepare("UPDATE social_comment_targets SET collected_count = ?, status = ?, updated_at = ? WHERE brand_id = ? AND mention_id = ?")
      .bind(analyzedCount, targetStatus, now, brandId, mentionId),
  ]);
}

async function processCommentPage(db: D1Database, brandId: number, job: MonidJob, output: unknown) {
  const descriptor = JSON.parse(job.terms || "{}") as CommentJobPayload;
  const platform = descriptor.platform || "Instagram";
  const payload = nestedObjectWithArray(output, job.stage === "post_comments" ? ["comments", "replies", "items", "data"] : ["child_comments", "replies", "comments"]);
  const rawRows = payload ? (["comments", "replies", "child_comments", "items", "data"].map((key) => payload[key]).find(Array.isArray) as unknown[] | undefined) : undefined;
  const sourceRows = rawRows ?? walkObjects(output);
  const brandTerms = await brandTermsFor(db, brandId);
  const comments: SocialComment[] = [];
  const replyQueue: Array<{ parentId: string; count: number }> = [];
  for (const raw of sourceRows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as JsonObject;
    const comment = commentFromRow(row, descriptor.postUrl, descriptor.commentId ?? "");
    if (comment) comments.push(comment);
    if (job.stage === "post_comments" && comment) {
      const previews = pathValue(row, "preview_child_comments");
      if (Array.isArray(previews)) for (const preview of previews) {
        if (!preview || typeof preview !== "object") continue;
        const child = commentFromRow(preview as JsonObject, descriptor.postUrl, comment.id);
        if (child) comments.push(child);
      }
      if (platform === "Instagram" && comment.replies > 0) replyQueue.push({ parentId: comment.id, count: comment.replies });
    }
  }
  if (!comments.length) {
    const now = new Date().toISOString();
    if (job.stage === "post_comments") {
      const target = await db.prepare("SELECT reported_count, pages_fetched FROM social_comment_targets WHERE brand_id = ? AND mention_id = ?")
        .bind(brandId, descriptor.mentionId).first<{ reported_count: number; pages_fetched: number }>();
      const reported = Math.max(Number(target?.reported_count ?? 0), firstNumber(output, ["comment_count", "comments_count", "total"]));
      const attempt = Number(target?.pages_fetched ?? 0) + 1;
      const shouldRetry = reported > 0 && attempt < 3;
      const status = shouldRetry ? "retrying" : "not_returned";
      const message = shouldRetry
        ? `${platform} 显示有评论，本次指定帖子接口未返回文本；系统将更换时间窗口自动重试（${attempt}/3）`
        : reported > 0 ? `${platform} 显示有评论，但连续 ${attempt} 次未取得文本；保留为待核验，不判定为平台未开放`
        : `指定帖子接口本次未返回评论文本；保留为待核验，不判定为没有评论`;
      await db.prepare(`UPDATE social_comment_targets SET reported_count = MAX(reported_count, ?), top_level_complete = 1,
        status = ?, pages_fetched = pages_fetched + 1, last_error = ?, updated_at = ? WHERE brand_id = ? AND mention_id = ?`)
        .bind(reported, status, message, now, brandId, descriptor.mentionId).run();
      if (shouldRetry) await db.prepare("UPDATE social_comment_targets SET top_level_complete = 0 WHERE brand_id = ? AND mention_id = ?")
        .bind(brandId, descriptor.mentionId).run();
    } else {
      await db.prepare(`UPDATE social_comment_reply_queue SET status = 'complete', pages_fetched = pages_fetched + 1,
        last_error = '', updated_at = ? WHERE brand_id = ? AND mention_id = ? AND parent_comment_id = ?`)
        .bind(now, brandId, descriptor.mentionId, descriptor.commentId ?? "").run();
    }
    await refreshSocialCommentAnalysis(db, brandId, descriptor.mentionId, brandTerms);
    return;
  }
  await storeSocialComments(db, brandId, descriptor.mentionId, platform, comments, brandTerms);
  const now = new Date().toISOString();
  if (job.stage === "post_comments") {
    for (let index = 0; index < replyQueue.length; index += 40) {
      const statements = replyQueue.slice(index, index + 40).map((reply) => db.prepare(`INSERT INTO social_comment_reply_queue
        (mention_id, brand_id, media_id, parent_comment_id, reported_count, status, updated_at)
        VALUES (?, ?, ?, ?, ?, 'queued', ?)
        ON CONFLICT(mention_id, parent_comment_id) DO UPDATE SET reported_count = MAX(social_comment_reply_queue.reported_count, excluded.reported_count), updated_at = excluded.updated_at`)
        .bind(descriptor.mentionId, brandId, descriptor.mediaId, reply.parentId, reply.count, now));
      if (statements.length) await db.batch(statements);
    }
    const nextCursor = cursorText(payload?.next_min_id ?? payload?.continuation_token ?? payload?.cursor ?? pathValue(output, "data.cursor"));
    const hasMore = platform === "Facebook" || platform === "X" ? false : firstBoolean(payload ?? output, ["has_more_headload_comments", "has_more", "more_available"])
      || Boolean(payload?.continuation_token) || Number(pathValue(output, "data.has_more") ?? 0) === 1;
    const reported = firstNumber(payload ?? output, ["comment_count", "comments_count", "total"]);
    await db.prepare(`UPDATE social_comment_targets SET reported_count = MAX(reported_count, ?), cursor = ?,
      top_level_complete = ?, status = ?, pages_fetched = pages_fetched + 1, last_error = '', updated_at = ?
      WHERE brand_id = ? AND mention_id = ?`)
      .bind(reported, hasMore && nextCursor ? nextCursor : "", hasMore && nextCursor ? 0 : 1,
        hasMore && nextCursor ? "queued" : "collecting", now, brandId, descriptor.mentionId).run();
  } else {
    const nextCursor = cursorText(payload?.next_min_child_cursor ?? pathValue(payload, "page_info.next_min_id"));
    const hasMore = firstBoolean(payload ?? output, ["has_more_tail_child_comments", "page_info.has_more", "has_more"]);
    const reported = firstNumber(payload ?? output, ["child_comment_count", "total"]);
    const collected = await db.prepare("SELECT COUNT(*) AS count FROM mention_comments WHERE mention_id = ? AND parent_comment_id = ?")
      .bind(descriptor.mentionId, descriptor.commentId ?? "").first<{ count: number }>();
    await db.prepare(`UPDATE social_comment_reply_queue SET reported_count = MAX(reported_count, ?), collected_count = ?, cursor = ?,
      status = ?, pages_fetched = pages_fetched + 1, last_error = '', updated_at = ?
      WHERE brand_id = ? AND mention_id = ? AND parent_comment_id = ?`)
      .bind(reported, Number(collected?.count ?? 0), hasMore && nextCursor ? nextCursor : "", hasMore && nextCursor ? "queued" : "complete",
        now, brandId, descriptor.mentionId, descriptor.commentId ?? "").run();
  }
  await refreshSocialCommentAnalysis(db, brandId, descriptor.mentionId, brandTerms);
}

async function processProfiles(db: D1Database, brandId: number, output: unknown) {
  const capturedAt = new Date().toISOString();
  for (const row of rowsFromOutput(output)) {
    const username = firstText(row, ["username", "user.username"]);
    if (!username) continue;
    const authorId = firstText(row, ["id", "pk", "user.id", "user.pk"]);
    const followerCount = firstNumber(row, ["followersCount", "followerCount", "followers", "edge_followed_by.count"]);
    const followingCount = firstNumber(row, ["followsCount", "followingCount", "following", "edge_follow.count"]);
    const verified = firstBoolean(row, ["verified", "isVerified", "is_verified"]);
    await db.prepare(`INSERT INTO social_author_snapshots
      (brand_id, platform, author_id, username, follower_count, following_count, verified, captured_at)
      VALUES (?, 'Instagram', ?, ?, ?, ?, ?, ?)`)
      .bind(brandId, authorId, username, followerCount, followingCount, verified ? 1 : 0, capturedAt).run();
    await db.prepare(`UPDATE social_post_metrics SET author_id = CASE WHEN author_id = '' THEN ? ELSE author_id END,
      follower_count = ?, metrics_updated_at = ? WHERE brand_id = ? AND platform = 'Instagram' AND lower(author_username) = lower(?)`)
      .bind(authorId, followerCount, capturedAt, brandId, username).run();
  }
}

async function processResolvedPost(db: D1Database, brandId: number, job: MonidJob, output: unknown) {
  const descriptor = JSON.parse(job.terms || "{}") as CommentJobPayload;
  const details = resolvedInstagramPost(output);
  const now = new Date().toISOString();
  if (!details) {
    await db.prepare(`UPDATE social_comment_targets SET status = 'retrying', top_level_complete = 0,
      last_error = '指定帖子 URL 已提交，但暂未解析出 Instagram Media ID；30 分钟后自动重试', updated_at = ?
      WHERE brand_id = ? AND mention_id = ?`).bind(now, brandId, descriptor.mentionId).run();
    return;
  }
  await db.batch([
    db.prepare(`UPDATE social_comment_targets SET media_id = ?, reported_count = MAX(reported_count, ?), status = 'queued',
      top_level_complete = 0, last_error = '', updated_at = ? WHERE brand_id = ? AND mention_id = ?`)
      .bind(details.mediaId, Math.max(0, details.comments), now, brandId, descriptor.mentionId),
    db.prepare(`UPDATE social_post_metrics SET post_id = ?, comments = MAX(comments, ?), likes = MAX(likes, ?),
      author_id = CASE WHEN ? != '' THEN ? ELSE author_id END,
      author_username = CASE WHEN ? != '' THEN ? ELSE author_username END, metrics_updated_at = ?
      WHERE brand_id = ? AND mention_id = ?`)
      .bind(details.mediaId, Math.max(0, details.comments), Math.max(0, details.likes), details.authorId, details.authorId,
        details.username, details.username, now, brandId, descriptor.mentionId),
    db.prepare(`UPDATE mentions SET title = CASE WHEN ? != '' AND title LIKE '指定帖子%' THEN ? ELSE title END,
      source = CASE WHEN ? != '' THEN '@' || ? ELSE source END,
      author = CASE WHEN ? != '' THEN '@' || ? ELSE author END,
      excerpt = CASE WHEN ? != '' AND excerpt = '' THEN ? ELSE excerpt END
      WHERE brand_id = ? AND id = ?`)
      .bind(details.caption, details.caption.slice(0, 180), details.username, details.username, details.username, details.username,
        details.caption, details.caption.slice(0, 600), brandId, descriptor.mentionId),
  ]);
}

async function startProfileEnrichment(db: D1Database, brandId: number, apiKey: string, usernames: string[]) {
  const unique = [...new Set(usernames.map((item) => item.trim()).filter(Boolean))].slice(0, 25);
  if (!unique.length) return;
  const freshSince = new Date(Date.now() - 24 * 3600_000).toISOString();
  const placeholders = unique.map(() => "?").join(",");
  const fresh = await db.prepare(`SELECT DISTINCT lower(username) AS username FROM social_author_snapshots
    WHERE brand_id = ? AND captured_at >= ? AND lower(username) IN (${placeholders})`)
    .bind(brandId, freshSince, ...unique.map((item) => item.toLowerCase())).all<{ username: string }>();
  const freshNames = new Set(fresh.results.map((item) => item.username));
  const pending = unique.filter((item) => !freshNames.has(item.toLowerCase()));
  if (!pending.length) return;
  const active = await db.prepare(`SELECT id FROM monid_jobs WHERE brand_id = ? AND stage = 'profiles' AND status IN (${PENDING_SQL}) LIMIT 1`)
    .bind(brandId).first<{ id: number }>();
  if (active) return;
  const run = await startRun(apiKey, PROFILE_ENDPOINT, { usernames: pending, includeAboutSection: false });
  const job = await saveJob(db, brandId, run, "profiles", pending);
  if (run.status === "COMPLETED") {
    await processProfiles(db, brandId, run.output);
    await updateJob(db, job, run);
  }
}

async function processJob(db: D1Database, brandId: number, apiKey: string, job: MonidJob, run: MonidRun) {
  if (!TERMINAL.has(run.status)) {
    await updateJob(db, job, run);
    return [] as MonitoringCandidate[];
  }
  if (run.status === "BLOCKED") {
    await updateJob(db, job, run, "Monid 工作区预算或单次任务上限阻止了执行");
    await markCommentJobError(db, brandId, job, "Monid 工作区预算或单次任务上限阻止了执行", "blocked");
    if (job.stage === "resolve_post" || job.stage === "post_comments" || job.stage === "comment_replies") return [];
    throw new Error("Monid 工作区预算或单次任务上限已触发，请在 Monid 后台调整后重试");
  }
  if (run.status !== "COMPLETED") {
    await updateJob(db, job, run, `Monid 任务状态：${run.status}`);
    await markCommentJobError(db, brandId, job, `Monid 任务状态：${run.status}，将在稍后重试`, "retrying");
    if (job.stage === "resolve_post" || job.stage === "post_comments" || job.stage === "comment_replies") return [];
    throw new Error(`Monid Instagram 任务未完成：${run.status}`);
  }
  const providerStatus = Number(run.providerResponse?.httpStatus ?? 200);
  if (providerStatus >= 400) {
    const message = run.providerResponse?.error?.message ?? `Instagram 数据端点 HTTP ${providerStatus}`;
    await updateJob(db, job, run, message);
    await markCommentJobError(db, brandId, job, message, providerStatus === 401 || providerStatus === 403 ? "blocked" : providerStatus >= 500 ? "retrying" : "unavailable");
    if (job.stage === "resolve_post" || job.stage === "post_comments" || job.stage === "comment_replies") return [];
    throw new ProviderRequestError("Monid / Instagram", providerStatus, null, message);
  }
  if (job.stage === "profiles") {
    await processProfiles(db, brandId, run.output);
    await updateJob(db, job, run);
    return [];
  }
  if (job.stage === "resolve_post") {
    await processResolvedPost(db, brandId, job, run.output);
    await updateJob(db, job, run);
    return [];
  }
  if (job.stage === "post_comments" || job.stage === "comment_replies") {
    try {
      await processCommentPage(db, brandId, job, run.output);
      await updateJob(db, job, run);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Monid 评论结果无法解析";
      await updateJob(db, job, run, message);
      await markCommentJobError(db, brandId, job, `${message}；将在稍后重试`, "retrying");
    }
    return [];
  }
  const stored = JSON.parse(job.terms || "[]") as string[] | { terms?: string[]; platform?: string };
  const terms = Array.isArray(stored) ? stored : stored.terms ?? [];
  const platform = job.stage === "search_x" ? "X" : job.stage === "search_youtube" ? "YouTube"
    : job.stage === "search_tiktok" ? "TikTok" : job.stage === "search_facebook" ? "Facebook" : "Instagram";
  const candidates = platform === "Instagram" ? parseInstagramPosts(run.output, terms)
    : parseSocialPosts(run.output, terms, platform);
  await updateJob(db, job, run);
  if (platform === "Instagram") await startProfileEnrichment(db, brandId, apiKey, candidates.flatMap((item) => item.socialMetrics?.authorUsername ? [item.socialMetrics.authorUsername] : []));
  return candidates;
}

async function markCommentJobError(db: D1Database, brandId: number, job: MonidJob, message: string, status: "retrying" | "blocked" | "unavailable" | "error" = "error") {
  if (job.stage !== "resolve_post" && job.stage !== "post_comments" && job.stage !== "comment_replies") return;
  const descriptor = JSON.parse(job.terms || "{}") as CommentJobPayload;
  const now = new Date().toISOString();
  if (job.stage === "resolve_post" || job.stage === "post_comments") {
    await db.prepare("UPDATE social_comment_targets SET status = ?, last_error = ?, updated_at = ? WHERE brand_id = ? AND mention_id = ?")
      .bind(status, message, now, brandId, descriptor.mentionId).run();
  } else {
    await db.prepare("UPDATE social_comment_reply_queue SET status = ?, last_error = ?, updated_at = ? WHERE brand_id = ? AND mention_id = ? AND parent_comment_id = ?")
      .bind(status, message, now, brandId, descriptor.mentionId, descriptor.commentId ?? "").run();
  }
}

export async function hasPendingMonidJobs(db: D1Database, brandId: number) {
  const row = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM monid_jobs WHERE brand_id = ? AND status IN (${PENDING_SQL})) +
      (SELECT COUNT(*) FROM social_comment_targets WHERE brand_id = ? AND status IN ('queued','running','collecting','retrying')) +
      (SELECT COUNT(*) FROM social_comment_reply_queue WHERE brand_id = ? AND status IN ('queued','running')) AS count`)
    .bind(brandId, brandId, brandId).first<{ count: number }>();
  return Number(row?.count ?? 0) > 0;
}

export async function countPendingMonidJobs(db: D1Database, brandId: number) {
  const row = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM monid_jobs WHERE brand_id = ? AND status IN (${PENDING_SQL})) +
      (SELECT COUNT(*) FROM social_comment_targets WHERE brand_id = ? AND status IN ('queued','running','collecting','retrying')) +
      (SELECT COUNT(*) FROM social_comment_reply_queue WHERE brand_id = ? AND status IN ('queued','running')) AS count`)
    .bind(brandId, brandId, brandId).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function queueSocialCommentTarget(db: D1Database, brandId: number, mentionId: number, platform: string, rawMediaId: string, postUrlValue: string, reportedCount: number) {
  const mediaId = platform === "Instagram" ? rawMediaId.match(/^\d{10,}/)?.[0] ?? postUrlValue : rawMediaId || postUrlValue;
  if (!mediaId) return;
  const count = Math.max(0, reportedCount);
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO social_comment_targets
    (mention_id, brand_id, platform, media_id, post_url, reported_count, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)
    ON CONFLICT(mention_id) DO UPDATE SET media_id = excluded.media_id, post_url = excluded.post_url,
      top_level_complete = CASE WHEN excluded.reported_count > social_comment_targets.reported_count THEN 0 ELSE social_comment_targets.top_level_complete END,
      status = CASE WHEN excluded.reported_count > social_comment_targets.reported_count THEN 'queued' ELSE social_comment_targets.status END,
      reported_count = MAX(social_comment_targets.reported_count, excluded.reported_count),
      updated_at = CASE WHEN excluded.reported_count > social_comment_targets.reported_count THEN excluded.updated_at ELSE social_comment_targets.updated_at END`)
    .bind(mentionId, brandId, platform, mediaId, postUrlValue, count, now).run();
}

export async function queueInstagramCommentTarget(db: D1Database, brandId: number, mentionId: number, rawMediaId: string, postUrlValue: string, reportedCount: number) {
  return queueSocialCommentTarget(db, brandId, mentionId, "Instagram", rawMediaId, postUrlValue, reportedCount);
}

async function registerHistoricalCommentTargets(db: D1Database, brandId: number) {
  await db.prepare(`UPDATE social_comment_targets SET status = 'retrying',
    last_error = CASE WHEN last_error = '' THEN '旧版采集失败，已进入新版退避重试队列' ELSE last_error END,
    updated_at = datetime('now', '-31 minutes') WHERE brand_id = ? AND status = 'error'`).bind(brandId).run();
  await db.prepare(`UPDATE social_comment_targets SET status = 'retrying', top_level_complete = 0,
    media_id = CASE WHEN platform = 'Instagram' THEN post_url ELSE media_id END,
    last_error = '旧状态结论已撤销；正在通过指定帖子 URL 重新识别并采集', updated_at = datetime('now', '-31 minutes')
    WHERE brand_id = ? AND status IN ('empty','unavailable')`).bind(brandId).run();
  const posts = await db.prepare(`SELECT metrics.mention_id, metrics.platform, metrics.post_id, metrics.comments, mentions.url
    FROM social_post_metrics metrics JOIN mentions ON mentions.id = metrics.mention_id
    WHERE metrics.brand_id = ? AND metrics.platform IN ('Instagram','X','YouTube','TikTok','Facebook') AND metrics.post_id != ''`)
    .bind(brandId).all<{ mention_id: number; platform: string; post_id: string; comments: number; url: string }>();
  for (const post of posts.results) {
    await queueSocialCommentTarget(db, brandId, post.mention_id, post.platform, post.post_id, post.url, Number(post.comments));
  }
}

async function startCommentJobs(db: D1Database, brandId: number, apiKey: string) {
  const active = await db.prepare(`SELECT COUNT(*) AS count FROM monid_jobs WHERE brand_id = ?
    AND stage IN ('resolve_post','post_comments','comment_replies') AND status IN (${PENDING_SQL})`).bind(brandId).first<{ count: number }>();
  let available = Math.max(0, COMMENT_JOBS_PER_CYCLE - Number(active?.count ?? 0));
  if (!available) return 0;
  let startedCount = 0;

  const targets = await db.prepare(`SELECT target.mention_id, target.platform, target.media_id, target.post_url, target.cursor, target.pages_fetched
    FROM social_comment_targets target
    WHERE target.brand_id = ? AND target.status IN ('queued','collecting','retrying') AND target.top_level_complete = 0
      AND (target.status != 'retrying' OR datetime(target.updated_at) <= datetime('now', '-30 minutes'))
      AND NOT EXISTS (SELECT 1 FROM monid_jobs job WHERE job.mention_id = target.mention_id AND job.stage IN ('resolve_post','post_comments') AND job.status IN (${PENDING_SQL}))
    ORDER BY target.updated_at ASC LIMIT ?`).bind(brandId, available).all<CommentTarget>();
  for (const target of targets.results) {
    const descriptor: CommentJobPayload = { mentionId: target.mention_id, platform: target.platform, mediaId: target.media_id, postUrl: target.post_url, cursor: target.cursor, page: target.pages_fetched + 1 };
    let run: MonidRun;
    let stage: "resolve_post" | "post_comments" = "post_comments";
    if (target.platform === "Instagram" && !/^\d{10,}$/.test(target.media_id)) {
      stage = "resolve_post";
      run = await startQueryRun(apiKey, POST_BY_URL_ENDPOINT, { post_url: target.post_url });
    } else if (target.platform === "YouTube") {
      const queryParams: JsonObject = { video_id: target.media_id, need_format: true, sort_by: "newest" };
      if (target.cursor) queryParams.continuation_token = target.cursor;
      run = await startQueryRun(apiKey, "/api/v1/youtube/web_v2/get_video_comments", queryParams);
    } else if (target.platform === "TikTok") {
      run = await startQueryRun(apiKey, "/api/v1/tiktok/web/fetch_post_comment", { aweme_id: target.media_id, cursor: Number(target.cursor || 0), count: 20 });
    } else if (target.platform === "X") {
      run = await startQueryRun(apiKey, "/api/v1/twitter/web/fetch_search_timeline", { keyword: `conversation_id:${target.media_id}`, search_type: "Latest", ...(target.cursor ? { cursor: target.cursor } : {}) });
    } else if (target.platform === "Facebook") {
      run = await startProviderRun(apiKey, "apify", "/apify/facebook-comments-scraper", { body: { startUrls: [{ url: target.post_url }], resultsLimit: 100, includeNestedComments: true, viewOption: "RECENT_ACTIVITY" } });
    } else {
      const queryParams: JsonObject = { media_id: target.media_id, sort_order: "recent" };
      if (target.cursor) queryParams.min_id = target.cursor;
      run = await startQueryRun(apiKey, COMMENTS_ENDPOINT, queryParams);
    }
    const job = await saveJob(db, brandId, run, stage, descriptor, target.mention_id);
    await db.prepare("UPDATE social_comment_targets SET status = 'running', updated_at = ? WHERE brand_id = ? AND mention_id = ?")
      .bind(new Date().toISOString(), brandId, target.mention_id).run();
    if (run.status === "COMPLETED") await processJob(db, brandId, apiKey, job, run);
    startedCount += 1;
    available -= 1;
    if (!available) return startedCount;
  }

  const replies = await db.prepare(`SELECT reply.mention_id, reply.media_id, reply.parent_comment_id, reply.cursor, reply.pages_fetched
    FROM social_comment_reply_queue reply
    WHERE reply.brand_id = ? AND reply.status = 'queued'
      AND NOT EXISTS (SELECT 1 FROM monid_jobs job WHERE job.mention_id = reply.mention_id AND job.stage = 'comment_replies'
        AND job.status IN (${PENDING_SQL}) AND json_extract(job.terms, '$.commentId') = reply.parent_comment_id)
    ORDER BY reply.updated_at ASC LIMIT ?`).bind(brandId, available).all<ReplyTarget>();
  for (const reply of replies.results) {
    const mention = await db.prepare("SELECT url FROM mentions WHERE brand_id = ? AND id = ?").bind(brandId, reply.mention_id).first<{ url: string }>();
    const descriptor: CommentJobPayload = { mentionId: reply.mention_id, mediaId: reply.media_id, postUrl: mention?.url ?? "", cursor: reply.cursor, commentId: reply.parent_comment_id, page: reply.pages_fetched + 1 };
    const queryParams: JsonObject = { media_id: reply.media_id, comment_id: reply.parent_comment_id };
    if (reply.cursor) queryParams.min_id = reply.cursor;
    const run = await startQueryRun(apiKey, REPLIES_ENDPOINT, queryParams);
    const job = await saveJob(db, brandId, run, "comment_replies", descriptor, reply.mention_id);
    await db.prepare("UPDATE social_comment_reply_queue SET status = 'running', updated_at = ? WHERE brand_id = ? AND mention_id = ? AND parent_comment_id = ?")
      .bind(new Date().toISOString(), brandId, reply.mention_id, reply.parent_comment_id).run();
    if (run.status === "COMPLETED") await processJob(db, brandId, apiKey, job, run);
    startedCount += 1;
    available -= 1;
    if (!available) return startedCount;
  }
  return startedCount;
}

export async function refreshSocialFollowerCounts(db: D1Database, brandId: number) {
  await db.prepare(`UPDATE social_post_metrics SET follower_count = COALESCE((
      SELECT snapshot.follower_count FROM social_author_snapshots snapshot
      WHERE snapshot.brand_id = social_post_metrics.brand_id AND snapshot.platform = social_post_metrics.platform
        AND lower(snapshot.username) = lower(social_post_metrics.author_username)
      ORDER BY snapshot.captured_at DESC LIMIT 1
    ), follower_count)
    WHERE brand_id = ? AND platform = 'Instagram'`).bind(brandId).run();
}

export async function collectMonidSocial(db: D1Database, brandId: number, terms: string[], apiKey: string, startNew: boolean) {
  const candidates: MonitoringCandidate[] = [];
  await registerHistoricalCommentTargets(db, brandId);
  const pending = await db.prepare(`SELECT id, run_id, mention_id, stage, status, terms FROM monid_jobs
    WHERE brand_id = ? AND status IN (${PENDING_SQL}) ORDER BY id ASC LIMIT 4`)
    .bind(brandId).all<MonidJob>();
  const pendingSearchStages = new Set(pending.results.filter((job) => job.stage.startsWith("search")).map((job) => job.stage));
  const polled = await Promise.all(pending.results.map(async (job) => ({ job, run: await getRun(apiKey, job.run_id) })));
  for (const { job, run } of polled) {
    candidates.push(...await processJob(db, brandId, apiKey, job, run));
  }
  if (startNew && !pendingSearchStages.has("search")) {
    const searchTerms = [...new Set(terms.map((item) => item.trim()).filter(Boolean))].slice(0, 5);
    if (searchTerms.length) {
      const started = await startRun(apiKey, SEARCH_ENDPOINT, {
        hashtags: searchTerms,
        keywordSearch: true,
        resultsType: "posts",
        resultsLimit: 50,
      });
      const job = await saveJob(db, brandId, started, "search", searchTerms);
      candidates.push(...await processJob(db, brandId, apiKey, job, started));
    }
  }
  if (startNew && terms.length) {
    const keyword = terms[0];
    const searches = (Object.entries(SOCIAL_SEARCHES) as Array<[keyof typeof SOCIAL_SEARCHES, (typeof SOCIAL_SEARCHES)[keyof typeof SOCIAL_SEARCHES]]>)
      .filter(([, config]) => !pendingSearchStages.has(config.stage)).map(async ([platform, config]) => {
      const input = platform === "Facebook"
        ? { body: { query: `${terms.join(" OR ")} Facebook public post`, includeDomains: ["facebook.com"], numResults: 25 } }
        : { queryParams: platform === "X" ? { keyword: terms.join(" OR "), search_type: "Latest" }
          : platform === "YouTube" ? { keyword, type: "video", upload_date: "this_month", sort_by: "upload_date" }
          : { keyword, offset: 0 } };
      const started = await startProviderRun(apiKey, config.provider, config.endpoint, input);
      return { platform, config, started };
    });
    const settled = await Promise.allSettled(searches);
    let successfulStarts = 0;
    for (const result of settled) {
      if (result.status !== "fulfilled") continue;
      successfulStarts += 1;
      const { platform, config, started } = result.value;
      const job = await saveJob(db, brandId, started, config.stage, { platform, terms });
      if (started.status === "COMPLETED") candidates.push(...await processJob(db, brandId, apiKey, job, started));
    }
    if (searches.length && !successfulStarts) {
      const failure = settled.find((item): item is PromiseRejectedResult => item.status === "rejected");
      throw failure?.reason ?? new Error("Monid 多平台搜索启动失败");
    }
  }
  // Keyword discovery keeps its own cadence even when the comment backlog is non-empty.
  // Newly discovered post URLs are archived by the caller, queued as comment targets,
  // resolved to platform post IDs, then analyzed after comment text is stored.
  await startCommentJobs(db, brandId, apiKey);
  return candidates;
}

export const collectMonidInstagram = collectMonidSocial;
