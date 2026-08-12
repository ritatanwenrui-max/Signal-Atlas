import { env } from "cloudflare:workers";
import { loadConnectorCredential } from "./credentials";
import { backfillMediaSources, crawlMediaSources, registerMediaSources } from "./free-crawler";
import { ensureDatabase, getActiveBrandForUser } from "./repository";
import { fetchEventRegistry, fetchGdelt, fetchX, fetchYouTube, inferLanguage, inferSourceCountry, ProviderRequestError, type MonitoringCandidate } from "./providers";

type TrackedEntity = { type: string; value: string; active: number };
type SyncRun = { id: number; status: string; started_at: string };
type ExistingMention = { id?: number; title: string; excerpt?: string; cluster_key: string; url: string; source: string; source_country: string; content_country?: string; language?: string; published_at?: string; parent_url?: string };
type ProviderHealth = { provider: string; status: string; consecutive_failures: number; retry_after: string; last_error: string; last_success_at: string };
type ProviderTask = { name: string; load: () => Promise<MonitoringCandidate[]> };

const SIX_HOURS = 6 * 3600_000;
const ONE_DAY = 24 * 3600_000;

function providerKey(brandId: number, provider: string) { return `${brandId}:${provider}`; }

function termsFrom(entities: TrackedEntity[]) {
  return [...new Set(entities.filter((item) => item.active && item.type !== "排除词" && item.type !== "官网域名")
    .map((item) => item.value.trim()).filter(Boolean))].slice(0, 12);
}

function gdeltQuery(terms: string[]) {
  return terms.map((term) => /\s|[^\x00-\x7F]/.test(term) ? `"${term.replaceAll('"', "")}"` : term).join(" OR ");
}

function compactText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function textTokens(text: string, brandTerms: string[] = []) {
  let normalized = text.toLowerCase();
  for (const term of brandTerms) normalized = normalized.replaceAll(term.toLowerCase(), " ");
  normalized = normalized.replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ");
  const stopwords = new Set(["the", "and", "for", "with", "from", "news", "brand", "official", "that", "this", "are", "was", "were", "have", "has", "will", "报道", "新闻", "媒体", "公司", "品牌", "发布", "以及", "相关", "一个", "表示"]);
  const tokens = new Set<string>();
  for (const word of normalized.match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []) if (!stopwords.has(word)) tokens.add(word);
  for (const sequence of normalized.match(/\p{Script=Han}{2,}/gu) ?? []) {
    if (sequence.length === 2 && !stopwords.has(sequence)) tokens.add(sequence);
    else for (let index = 0; index < sequence.length - 1; index += 1) {
      const token = sequence.slice(index, index + 2);
      if (!stopwords.has(token)) tokens.add(token);
    }
  }
  return tokens;
}

function similarity(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function simpleHash(value: string) {
  let hash = 2166136261;
  for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return Math.abs(hash >>> 0).toString(36);
}

function hashKey(tokens: Set<string>, title: string) {
  const signature = [...tokens].sort().slice(0, 16).join("|") || title.toLowerCase();
  return `story-${simpleHash(signature)}`;
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    const xPost = url.href.match(/x\.com\/[^/]+\/status\/(\d+)/);
    if (xPost) return `x:${xPost[1]}`;
    const youtube = url.searchParams.get("v");
    if (youtube) return `youtube:${youtube}`;
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    url.hash = "";
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}${url.search}`.toLowerCase();
  } catch { return value.trim().toLowerCase(); }
}

function findCluster(candidate: MonitoringCandidate, terms: string[], known: ExistingMention[]) {
  if (candidate.parentUrl) {
    const upstream = known.find((mention) => canonicalUrl(mention.url) === canonicalUrl(candidate.parentUrl));
    if (upstream) return upstream.cluster_key;
  }
  const incomingTitle = textTokens(candidate.title, terms);
  const incomingBody = textTokens(candidate.discussionText.slice(0, 1000), terms);
  let best: ExistingMention | undefined;
  let bestScore = 0;
  for (const mention of known) {
    const ageHours = Math.abs(new Date(candidate.publishedAt).getTime() - new Date(mention.published_at ?? candidate.publishedAt).getTime()) / 3600_000;
    if (ageHours > 24 * 7) continue;
    const titleScore = similarity(incomingTitle, textTokens(mention.title, terms));
    const bodyScore = incomingBody.size && mention.excerpt ? similarity(incomingBody, textTokens(mention.excerpt, terms)) : 0;
    const burstBoost = ageHours <= 24 ? 0.12 : ageHours <= 72 ? 0.06 : 0;
    const score = titleScore * 0.68 + bodyScore * 0.32 + burstBoost;
    if (score > bestScore) { best = mention; bestScore = score; }
  }
  return best && bestScore >= 0.42 ? best.cluster_key : hashKey(incomingTitle, candidate.title);
}

function analyzeText(text: string, terms: string[]) {
  const negative = ["危机", "投诉", "欺诈", "造假", "召回", "抵制", "泄露", "诉讼", "违规", "事故", "风险", "批评", "差评", "争议", "scam", "fraud", "breach", "lawsuit", "recall", "boycott", "crisis", "unsafe", "controversy", "backlash", "complaint"];
  const positive = ["增长", "获奖", "领先", "创新", "推荐", "突破", "合作", "发布", "好评", "成功", "growth", "award", "leading", "innovative", "recommended", "launch", "partnership", "success", "breakthrough"];
  const crisis = ["欺诈", "召回", "泄露", "诉讼", "事故", "scam", "fraud", "breach", "lawsuit", "recall", "crisis"];
  const lower = text.toLowerCase();
  const negativeHits = negative.filter((word) => lower.includes(word));
  const positiveHits = positive.filter((word) => lower.includes(word));
  const crisisHits = crisis.filter((word) => lower.includes(word));
  const score = Math.max(-100, Math.min(100, positiveHits.length * 18 - negativeHits.length * 22 - crisisHits.length * 18));
  const sentiment = score <= -15 ? "负面" : score >= 15 ? "正面" : positiveHits.length && negativeHits.length ? "混合" : "中性";
  const risk = Math.min(98, 18 + negativeHits.length * 13 + crisisHits.length * 22);
  const topic = crisisHits.length ? "危机风险" : negativeHits.length ? "争议反馈" : positiveHits.length ? "品牌进展" : "一般提及";
  const keywords = [...textTokens(text, terms)].slice(0, 12);
  return { sentiment, score, risk, topic, keywords };
}

function impactFor(candidate: MonitoringCandidate) {
  const base = candidate.platform === "网页新闻" ? 62 : candidate.platform === "YouTube" ? 58 : 48;
  return Math.min(98, base + Math.round(Math.log10(candidate.engagement + 1) * 12));
}

function retryDelay(error: unknown, failureCount: number) {
  const rateLimited = error instanceof ProviderRequestError && error.status === 429;
  const providerFloor = error instanceof ProviderRequestError && error.provider === "GDELT" ? SIX_HOURS : 10 * 60 * 1000;
  const base = rateLimited ? providerFloor : 5 * 60 * 1000;
  const exponential = base * 2 ** Math.min(3, Math.max(0, failureCount - 1));
  const serverHint = error instanceof ProviderRequestError ? error.retryAfterMs ?? 0 : 0;
  return Math.min(ONE_DAY, Math.max(base, exponential, serverHint));
}

async function markProviderHealthy(db: D1Database, brandId: number, provider: string, attemptedAt: string) {
  await db.prepare(`INSERT INTO provider_health
    (provider, status, consecutive_failures, retry_after, last_error, last_attempt_at, last_success_at, updated_at)
    VALUES (?, 'online', 0, '', '', ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET status = 'online', consecutive_failures = 0, retry_after = '', last_error = '',
      last_attempt_at = excluded.last_attempt_at, last_success_at = excluded.last_success_at, updated_at = excluded.updated_at`)
    .bind(providerKey(brandId, provider), attemptedAt, attemptedAt, attemptedAt).run();
}

async function markProviderFailed(db: D1Database, brandId: number, provider: string, error: unknown, previousFailures: number, attemptedAt: string) {
  const failures = previousFailures + 1;
  const limited = error instanceof ProviderRequestError && error.status === 429;
  const retryAt = new Date(Date.now() + retryDelay(error, failures)).toISOString();
  const message = error instanceof Error ? error.message : "连接失败";
  await db.prepare(`INSERT INTO provider_health
    (provider, status, consecutive_failures, retry_after, last_error, last_attempt_at, last_success_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, '', ?)
    ON CONFLICT(provider) DO UPDATE SET status = excluded.status, consecutive_failures = excluded.consecutive_failures,
      retry_after = excluded.retry_after, last_error = excluded.last_error, last_attempt_at = excluded.last_attempt_at, updated_at = excluded.updated_at`)
    .bind(providerKey(brandId, provider), limited ? "limited" : "degraded", failures, retryAt, message, attemptedAt, attemptedAt).run();
  return { retryAt, message, limited };
}

function isDue(lastSuccessAt: string | undefined, interval: number) {
  return !lastSuccessAt || Date.now() - new Date(lastSuccessAt).getTime() >= interval;
}

async function enrichHistoricalMentions(db: D1Database, brandId: number) {
  const rows = await db.prepare(`SELECT id, title, excerpt, url, source, source_country, language FROM mentions
    WHERE brand_id = ? AND (source_country IN ('地区未披露', '地区待确认', '') OR language IN ('自动识别', '语言待确认', ''))
    ORDER BY published_at DESC LIMIT 5000`).bind(brandId).all<Required<Pick<ExistingMention, "id" | "title" | "excerpt" | "url" | "source" | "source_country" | "language">>>();
  const updates: D1PreparedStatement[] = [];
  for (const row of rows.results) {
    const text = `${row.title} ${row.excerpt ?? ""}`;
    const language = inferLanguage(text, ["", "自动识别", "语言待确认"].includes(row.language ?? "") ? "" : row.language);
    const location = inferSourceCountry(row.url, row.source, text, ["", "地区未披露", "地区待确认"].includes(row.source_country) ? "" : row.source_country);
    updates.push(db.prepare(`UPDATE mentions SET source_country = ?, content_country = ?, language = ?,
      location_confidence = ?, location_method = ? WHERE id = ? AND brand_id = ?`)
      .bind(location.country, location.country, language.language, location.confidence, location.method, row.id, brandId));
  }
  for (let index = 0; index < updates.length; index += 75) await db.batch(updates.slice(index, index + 75));
}

async function rebuildStoryClusters(db: D1Database, brandId: number, terms: string[]) {
  const all = await db.prepare(`SELECT id, title, excerpt, cluster_key, url, source, source_country, content_country, language, published_at, parent_url
    FROM mentions WHERE brand_id = ? ORDER BY published_at ASC, id ASC LIMIT 5000`).bind(brandId).all<ExistingMention>();
  const known: ExistingMention[] = [];
  const updates: D1PreparedStatement[] = [];
  for (const item of all.results) {
    const candidate: MonitoringCandidate = {
      title: item.title, url: item.url, source: item.source, platform: "网页新闻", sourceCountry: item.source_country,
      language: item.language ?? "语言待确认", publishedAt: item.published_at ?? new Date().toISOString(), engagement: 0,
      discussionText: item.excerpt ?? "", commentsAnalyzed: 0, parentUrl: item.parent_url ?? "", relation: "",
    };
    const clusterKey = findCluster(candidate, terms, known);
    const normalized = { ...item, cluster_key: clusterKey };
    known.push(normalized);
    if (clusterKey !== item.cluster_key) updates.push(db.prepare("UPDATE mentions SET cluster_key = ? WHERE id = ? AND brand_id = ?").bind(clusterKey, item.id, brandId));
  }
  for (let index = 0; index < updates.length; index += 75) await db.batch(updates.slice(index, index + 75));
}

async function rebuildPropagationEdges(db: D1Database, brandId: number, terms: string[]) {
  const all = await db.prepare(`SELECT id, title, excerpt, cluster_key, url, source, source_country, content_country, language, published_at, parent_url
    FROM mentions WHERE brand_id = ? ORDER BY published_at ASC, id ASC LIMIT 5000`).bind(brandId).all<Required<ExistingMention>>();
  const byCluster = new Map<string, Required<ExistingMention>[]>();
  const byUrl = new Map(all.results.map((item) => [canonicalUrl(item.url), item]));
  for (const item of all.results) byCluster.set(item.cluster_key, [...(byCluster.get(item.cluster_key) ?? []), item]);
  const inserts: D1PreparedStatement[] = [];
  for (const [clusterKey, items] of byCluster) {
    for (let index = 1; index < items.length; index += 1) {
      const child = items[index];
      const explicit = child.parent_url ? byUrl.get(canonicalUrl(child.parent_url)) : undefined;
      let parent = explicit && explicit.published_at <= child.published_at ? explicit : undefined;
      let score = parent ? 1 : 0;
      if (!parent) {
        const childTitle = textTokens(child.title, terms);
        const childBody = textTokens(child.excerpt ?? "", terms);
        for (const prior of items.slice(0, index)) {
          const titleScore = similarity(childTitle, textTokens(prior.title, terms));
          const bodyScore = similarity(childBody, textTokens(prior.excerpt ?? "", terms));
          const combinedScore = similarity(textTokens(`${child.title} ${child.excerpt ?? ""}`, terms), textTokens(`${prior.title} ${prior.excerpt ?? ""}`, terms));
          const candidateScore = Math.max(titleScore, bodyScore, combinedScore);
          if (candidateScore > score) { parent = prior; score = candidateScore; }
        }
      }
      if (!parent) {
        parent = items[index - 1];
        score = similarity(textTokens(child.title, terms), textTokens(parent.title, terms));
      }
      const uncertain = new Set(["", "地区未披露", "地区待确认", "华语地区"]);
      const crossBorder = parent.source_country !== child.source_country && !uncertain.has(parent.source_country) && !uncertain.has(child.source_country);
      const similarityPercent = Math.round(score * 100);
      const confidence = explicit ? 98 : Math.min(94, Math.max(48, Math.round(50 + score * 42 + (crossBorder ? 2 : 0))));
      const method = explicit ? "显式引用" : score >= 0.62 ? "高度文本复用" : score >= 0.34 ? "标题与正文相似" : "发布时间与主题聚类";
      const gap = Math.max(0, Math.round((new Date(child.published_at).getTime() - new Date(parent.published_at).getTime()) / 60000));
      const evidence = explicit ? "来源元数据包含原文链接" : `${similarityPercent}% 文本特征相似，且晚发布 ${gap < 60 ? `${gap} 分钟` : `${Math.round(gap / 60)} 小时`}`;
      inserts.push(db.prepare(`INSERT INTO propagation_edges
        (brand_id, cluster_key, from_mention_id, to_mention_id, similarity, confidence, method, evidence, time_gap_minutes, cross_border)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(brandId, clusterKey, parent.id, child.id, similarityPercent, confidence, method, evidence, gap, crossBorder ? 1 : 0));
    }
  }
  await db.prepare("DELETE FROM propagation_edges WHERE brand_id = ?").bind(brandId).run();
  for (let index = 0; index < inserts.length; index += 75) await db.batch(inserts.slice(index, index + 75));
}

export async function runNewsSync(force = false, userId = "") {
  await ensureDatabase();
  const db = env.DB;
  const brand = await getActiveBrandForUser(db, userId);
  if (!brand) return { skipped: true, reason: "brand_not_configured", inserted: 0, found: 0 };
  const brandId = Number(brand.id);
  const entities = await db.prepare("SELECT type, value, active FROM tracked_entities WHERE brand_id = ? AND active = 1 ORDER BY id ASC")
    .bind(brandId).all<TrackedEntity>();
  const terms = termsFrom(entities.results);
  if (!terms.length) return { skipped: true, reason: "brand_not_configured", inserted: 0, found: 0 };
  const now = new Date().toISOString();
  const lockedUntil = new Date(Date.now() + 3 * 60 * 1000).toISOString();
  const lockName = `monitoring:${brandId}`;
  const lease = await db.prepare(`INSERT INTO sync_locks (name, locked_until) VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET locked_until = excluded.locked_until
    WHERE sync_locks.locked_until < ?`).bind(lockName, lockedUntil, now).run();
  if ((lease.meta.changes ?? 0) === 0) return { skipped: true, reason: "sync_in_progress", inserted: 0, found: 0 };

  try {
    // Analysis repair is independent from provider quotas, so old archives are enriched even during a provider cooldown.
    await enrichHistoricalMentions(db, brandId);
    await backfillMediaSources(db, brandId);
    await rebuildStoryClusters(db, brandId, terms);
    await rebuildPropagationEdges(db, brandId, terms);

    const lastRun = await db.prepare("SELECT id, status, started_at FROM sync_runs WHERE brand_id = ? ORDER BY id DESC LIMIT 1").bind(brandId).first<SyncRun>();
    const lastRunAge = lastRun ? Date.now() - new Date(lastRun.started_at).getTime() : Number.POSITIVE_INFINITY;
    if (lastRun?.status === "running" && lastRunAge < 3 * 60 * 1000) return { skipped: true, reason: "sync_in_progress", inserted: 0, found: 0 };
    if (lastRun && lastRunAge < 15 * 1000) return { skipped: true, reason: "provider_cooldown", inserted: 0, found: 0 };
    if (!force && lastRun && lastRunAge < 20 * 60 * 1000) return { skipped: true, reason: "recent_sync", inserted: 0, found: 0 };

    const query = gdeltQuery(terms);
    const startedAt = new Date().toISOString();
    const run = await db.prepare("INSERT INTO sync_runs (brand_id, provider, query, status, started_at) VALUES (?, ?, ?, ?, ?)")
      .bind(brandId, "Hybrid discovery + free crawler", query, "running", startedAt).run();
    const runId = run.meta.last_row_id;

    try {
      const healthRows = await db.prepare("SELECT provider, status, consecutive_failures, retry_after, last_error, last_success_at FROM provider_health WHERE provider LIKE ?")
        .bind(`${brandId}:%`).all<ProviderHealth>();
      const health = new Map(healthRows.results.map((item) => [item.provider.replace(/^\d+:/, ""), item]));
      const [newsApiKey, xBearerToken, youtubeApiKey] = await Promise.all([
        loadConnectorCredential(db, "NewsAPI.ai", userId), loadConnectorCredential(db, "X", userId), loadConnectorCredential(db, "YouTube", userId),
      ]);
      const discoveryDue = force || isDue(health.get("NewsAPI.ai")?.last_success_at, SIX_HOURS);
      const gdeltDue = !newsApiKey || isDue(health.get("GDELT")?.last_success_at, ONE_DAY);
      const providers: ProviderTask[] = [
        ...(discoveryDue && newsApiKey ? [{ name: "NewsAPI.ai", load: () => fetchEventRegistry(terms, newsApiKey) }] : []),
        ...(discoveryDue && gdeltDue ? [{ name: "GDELT", load: () => fetchGdelt(query) }] : []),
        ...(xBearerToken && (force || isDue(health.get("X")?.last_success_at, 2 * 3600_000)) ? [{ name: "X", load: () => fetchX(terms, xBearerToken) }] : []),
        ...(youtubeApiKey && (force || isDue(health.get("YouTube")?.last_success_at, SIX_HOURS)) ? [{ name: "YouTube", load: () => fetchYouTube(terms, youtubeApiKey) }] : []),
      ];
      const deferred = providers.filter((provider) => {
        const retryAt = health.get(provider.name)?.retry_after;
        return Boolean(retryAt && new Date(retryAt).getTime() > Date.now());
      });
      const ready = providers.filter((provider) => !deferred.some((item) => item.name === provider.name));
      const errors = deferred.map((provider) => `${provider.name}: ${health.get(provider.name)?.last_error || "等待自动重试"}`);
      const retryTimes = deferred.flatMap((provider) => health.get(provider.name)?.retry_after ? [health.get(provider.name)!.retry_after] : []);
      const settled = await Promise.allSettled(ready.map((provider) => provider.load()));
      const discoveryCandidates = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      let rateLimited = deferred.some((provider) => health.get(provider.name)?.status === "limited");
      const attemptedAt = new Date().toISOString();
      for (let index = 0; index < settled.length; index += 1) {
        const result = settled[index];
        const provider = ready[index];
        if (result.status === "fulfilled") await markProviderHealthy(db, brandId, provider.name, attemptedAt);
        else {
          const failure = await markProviderFailed(db, brandId, provider.name, result.reason, health.get(provider.name)?.consecutive_failures ?? 0, attemptedAt);
          errors.push(`${provider.name}: ${failure.message}`);
          retryTimes.push(failure.retryAt);
          rateLimited ||= failure.limited;
        }
      }

      await registerMediaSources(db, brandId, discoveryCandidates);
      const crawler = await crawlMediaSources(db, brandId, terms);
      await markProviderHealthy(db, brandId, "Free media crawler", attemptedAt);
      const candidates = [...discoveryCandidates, ...crawler.candidates];
      const existing = await db.prepare(`SELECT id, title, excerpt, cluster_key, url, source, source_country, content_country, language, published_at, parent_url
        FROM mentions WHERE brand_id = ? ORDER BY published_at DESC LIMIT 5000`).bind(brandId).all<ExistingMention>();
      const known = [...existing.results];
      const knownUrls = new Set(known.map((item) => canonicalUrl(item.url)));
      const knownCountries = new Set(known.map((item) => item.source_country));
      const newCountries = new Set<string>();
      let inserted = 0;

      for (const candidate of candidates.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))) {
        const canonical = canonicalUrl(candidate.url);
        if (!canonical || knownUrls.has(canonical)) continue;
        const excerpt = compactText(candidate.discussionText).slice(0, 2000);
        const inferredLanguage = inferLanguage(`${candidate.title} ${excerpt}`, candidate.language);
        const inferredLocation = inferSourceCountry(candidate.url, candidate.source, `${candidate.title} ${excerpt}`, candidate.sourceCountry);
        const normalizedCandidate = { ...candidate, language: inferredLanguage.language, sourceCountry: inferredLocation.country };
        const cluster = findCluster(normalizedCandidate, terms, known);
        const analysis = analyzeText(`${candidate.title} ${excerpt}`, terms);
        const impact = impactFor(candidate);
        const contentHash = simpleHash(`${candidate.title.toLowerCase()}|${excerpt.toLowerCase()}`);
        const firstSeen = new Date().toISOString();
        const result = await db.prepare(`INSERT INTO mentions
          (brand_id, title, url, source, platform, source_country, content_country, language, location_confidence, location_method, sentiment, risk, impact, summary, cluster_key,
           parent_url, relation, engagement, excerpt, author, provider, discovered_via, content_hash, word_count, sentiment_score,
           topics, keywords, first_seen_at, archived_at, published_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(brandId, candidate.title, candidate.url, candidate.source, candidate.platform, inferredLocation.country, inferredLocation.country,
            inferredLanguage.language, inferredLocation.confidence, inferredLocation.method, analysis.sentiment, analysis.risk, impact,
            `自动归档 · ${analysis.topic} · ${candidate.platform} · ${candidate.engagement ? `${candidate.engagement.toLocaleString()} 次公开互动` : "互动数据未披露"}${candidate.commentsAnalyzed ? ` · 已分析 ${candidate.commentsAnalyzed} 条高相关评论` : ""}`,
            cluster, candidate.parentUrl, candidate.relation, candidate.engagement, excerpt, candidate.author ?? "", candidate.provider ?? "公开网页",
            candidate.discoveredVia ?? "global_discovery", contentHash, textTokens(`${candidate.title} ${excerpt}`).size, analysis.score,
            analysis.topic, analysis.keywords.join(","), firstSeen, firstSeen, candidate.publishedAt).run();
        known.push({ id: Number(result.meta.last_row_id), title: candidate.title, excerpt, cluster_key: cluster, url: candidate.url, source: candidate.source, source_country: inferredLocation.country, content_country: inferredLocation.country, language: inferredLanguage.language, published_at: candidate.publishedAt, parent_url: candidate.parentUrl });
        knownUrls.add(canonical);
        inserted += 1;
        if (!knownCountries.has(inferredLocation.country) && !["地区未披露", "地区待确认", "华语地区"].includes(inferredLocation.country)) newCountries.add(inferredLocation.country);
        if (analysis.risk >= 70 || impact >= 90) {
          await db.prepare("INSERT INTO alerts (brand_id, mention_id, title, severity, country, reason) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(brandId, result.meta.last_row_id, candidate.title, analysis.risk >= 85 ? "Critical" : "High", inferredLocation.country,
              analysis.risk >= 70 ? `负面或危机词触发，风险分 ${analysis.risk}` : `公开互动快速增长，影响力 ${impact}`).run();
        }
      }

      for (const country of newCountries) {
        await db.prepare("INSERT INTO alerts (brand_id, title, severity, country, reason) VALUES (?, ?, ?, ?, ?)")
          .bind(brandId, `品牌首次进入${country}的信息环境`, "High", country, "系统首次观察到该国家或地区的相关内容").run();
      }
      await rebuildStoryClusters(db, brandId, terms);
      await rebuildPropagationEdges(db, brandId, terms);
      const status = errors.length ? (rateLimited && !candidates.length ? "deferred" : "partial") : "completed";
      await db.prepare("UPDATE sync_runs SET status = ?, found_count = ?, inserted_count = ?, error = ?, completed_at = ? WHERE id = ?")
        .bind(status, candidates.length, inserted, errors.join("；"), new Date().toISOString(), runId).run();
      return { skipped: false, found: candidates.length, inserted, query,
        provider: `${ready.map((item) => item.name).join(" + ") || "低频发现待机"} + 免费媒体追踪`, crawledSources: crawler.crawled,
        warnings: errors, rateLimited, retryAt: retryTimes.sort()[0] ?? "" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知同步错误";
      await db.prepare("UPDATE sync_runs SET status = ?, error = ?, completed_at = ? WHERE id = ?")
        .bind("failed", message, new Date().toISOString(), runId).run();
      throw error;
    }
  } finally {
    await db.prepare("UPDATE sync_locks SET locked_until = ? WHERE name = ?").bind(new Date().toISOString(), lockName).run();
  }
}

export async function runAllBrandSyncs() {
  await ensureDatabase();
  const rows = await env.DB.prepare("SELECT user_id FROM brand_profiles WHERE active = 1 AND user_id != '' ORDER BY id ASC LIMIT 100")
    .all<{ user_id: string }>();
  const results = [];
  for (const row of rows.results) results.push(await runNewsSync(false, row.user_id));
  return results;
}
