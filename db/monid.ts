import { ProviderRequestError, type MonitoringCandidate } from "./providers";

type JsonObject = Record<string, unknown>;
type MonidRun = {
  runId: string;
  status: string;
  output?: unknown;
  providerResponse?: { httpStatus?: number; error?: { message?: string } };
  cost?: { value?: number; currency?: string } | number | null;
};
type MonidJob = { id: number; run_id: string; stage: "search" | "profiles"; status: string; terms: string };

const API_BASE = "https://api.monid.ai";
const SEARCH_ENDPOINT = "/apify/instagram-hashtag-scraper";
const PROFILE_ENDPOINT = "/apify/instagram-profile-scraper";
const TERMINAL = new Set(["COMPLETED", "FAILED", "BLOCKED", "STOPPED", "TIME_OUT"]);
const PENDING_SQL = "'CREATED','QUEUED','PENDING','READY','RUNNING'";

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
    signal: AbortSignal.timeout(20_000),
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
    const postId = firstText(row, ["id", "postId", "pk", "mediaId", "shortCode", "shortcode"]);
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

function costValue(value: MonidRun["cost"]) {
  const dollars = typeof value === "number" ? value : Number(value?.value ?? 0) || 0;
  return Math.max(0, Math.round(dollars * 1_000_000));
}

async function saveJob(db: D1Database, brandId: number, run: MonidRun, stage: MonidJob["stage"], terms: string[]) {
  const inserted = await db.prepare(`INSERT OR IGNORE INTO monid_jobs
    (brand_id, run_id, stage, status, terms, cost, started_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)`)
    .bind(brandId, run.runId, stage, run.status || "RUNNING", JSON.stringify(terms), new Date().toISOString(), new Date().toISOString()).run();
  const row = await db.prepare("SELECT id, run_id, stage, status, terms FROM monid_jobs WHERE run_id = ?")
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
    throw new Error("Monid 工作区预算或单次任务上限已触发，请在 Monid 后台调整后重试");
  }
  if (run.status !== "COMPLETED") {
    await updateJob(db, job, run, `Monid 任务状态：${run.status}`);
    throw new Error(`Monid Instagram 任务未完成：${run.status}`);
  }
  const providerStatus = Number(run.providerResponse?.httpStatus ?? 200);
  if (providerStatus >= 400) {
    const message = run.providerResponse?.error?.message ?? `Instagram 数据端点 HTTP ${providerStatus}`;
    await updateJob(db, job, run, message);
    throw new ProviderRequestError("Monid / Instagram", providerStatus, null, message);
  }
  const terms = JSON.parse(job.terms || "[]") as string[];
  if (job.stage === "profiles") {
    await processProfiles(db, brandId, run.output);
    await updateJob(db, job, run);
    return [];
  }
  const candidates = parseInstagramPosts(run.output, terms);
  await updateJob(db, job, run);
  await startProfileEnrichment(db, brandId, apiKey, candidates.flatMap((item) => item.socialMetrics?.authorUsername ? [item.socialMetrics.authorUsername] : []));
  return candidates;
}

async function waitBriefly(apiKey: string, run: MonidRun) {
  let current = run;
  for (let attempt = 0; attempt < 3 && !TERMINAL.has(current.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    current = await getRun(apiKey, current.runId);
  }
  return current;
}

export async function hasPendingMonidJobs(db: D1Database, brandId: number) {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM monid_jobs WHERE brand_id = ? AND status IN (${PENDING_SQL})`)
    .bind(brandId).first<{ count: number }>();
  return Number(row?.count ?? 0) > 0;
}

export async function countPendingMonidJobs(db: D1Database, brandId: number) {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM monid_jobs WHERE brand_id = ? AND status IN (${PENDING_SQL})`)
    .bind(brandId).first<{ count: number }>();
  return Number(row?.count ?? 0);
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

export async function collectMonidInstagram(db: D1Database, brandId: number, terms: string[], apiKey: string, startNew: boolean) {
  const candidates: MonitoringCandidate[] = [];
  const pending = await db.prepare(`SELECT id, run_id, stage, status, terms FROM monid_jobs
    WHERE brand_id = ? AND status IN (${PENDING_SQL}) ORDER BY id ASC LIMIT 6`)
    .bind(brandId).all<MonidJob>();
  const hadPendingSearch = pending.results.some((job) => job.stage === "search");
  for (const job of pending.results) {
    const run = await getRun(apiKey, job.run_id);
    candidates.push(...await processJob(db, brandId, apiKey, job, run));
  }
  if (startNew && !hadPendingSearch) {
    const searchTerms = [...new Set(terms.map((item) => item.trim()).filter(Boolean))].slice(0, 5);
    if (searchTerms.length) {
      const started = await startRun(apiKey, SEARCH_ENDPOINT, {
        hashtags: searchTerms,
        keywordSearch: true,
        resultsType: "posts",
        resultsLimit: 10,
      });
      const job = await saveJob(db, brandId, started, "search", searchTerms);
      const run = await waitBriefly(apiKey, started);
      candidates.push(...await processJob(db, brandId, apiKey, job, run));
    }
  }
  return candidates;
}
