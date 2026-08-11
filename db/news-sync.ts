import { env } from "cloudflare:workers";
import { ensureDatabase } from "./repository";
import { fetchGdelt, fetchX, fetchYouTube, type MonitoringCandidate } from "./providers";

type TrackedEntity = { type: string; value: string; active: number };
type SyncRun = { id: number; status: string; started_at: string };
type ExistingMention = { title: string; cluster_key: string; url: string; source_country: string };

function termsFrom(entities: TrackedEntity[]) {
  return [...new Set(entities.filter((item) => item.active && item.type !== "排除词" && item.type !== "官网域名")
    .map((item) => item.value.trim()).filter(Boolean))].slice(0, 12);
}

function gdeltQuery(terms: string[]) {
  return terms.map((term) => /\s|[^\x00-\x7F]/.test(term) ? `"${term.replaceAll('"', "")}"` : term).join(" OR ");
}

function analyzeText(text: string) {
  const negative = ["危机", "投诉", "欺诈", "造假", "召回", "抵制", "泄露", "诉讼", "违规", "事故", "风险", "批评", "差评", "scam", "fraud", "breach", "lawsuit", "recall", "boycott", "crisis", "unsafe", "controversy"];
  const positive = ["增长", "获奖", "领先", "创新", "推荐", "突破", "合作", "发布", "好评", "growth", "award", "leading", "innovative", "recommended", "launch", "partnership"];
  const crisis = ["欺诈", "召回", "泄露", "诉讼", "事故", "scam", "fraud", "breach", "lawsuit", "recall", "crisis"];
  const lower = text.toLowerCase();
  const negativeHits = negative.filter((word) => lower.includes(word)).length;
  const positiveHits = positive.filter((word) => lower.includes(word)).length;
  const crisisHits = crisis.filter((word) => lower.includes(word)).length;
  const sentiment = negativeHits > positiveHits ? "负面" : positiveHits > negativeHits ? "正面" : "中性";
  const risk = Math.min(95, 22 + negativeHits * 12 + crisisHits * 20);
  const topic = crisisHits ? "危机风险" : negativeHits ? "争议反馈" : positiveHits ? "品牌进展" : "一般提及";
  return { sentiment, risk, topic };
}

function titleTokens(title: string, brandTerms: string[]) {
  let normalized = title.toLowerCase();
  for (const term of brandTerms) normalized = normalized.replaceAll(term.toLowerCase(), " ");
  normalized = normalized.replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ");
  const tokens = new Set<string>();
  for (const word of normalized.match(/[a-z0-9]{3,}/g) ?? []) {
    if (!new Set(["the", "and", "for", "with", "from", "news", "brand", "official"]).has(word)) tokens.add(word);
  }
  for (const sequence of normalized.match(/\p{Script=Han}{2,}/gu) ?? []) {
    if (sequence.length === 2) tokens.add(sequence);
    else for (let index = 0; index < sequence.length - 1; index += 1) tokens.add(sequence.slice(index, index + 2));
  }
  return tokens;
}

function similarity(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function hashKey(tokens: Set<string>, title: string) {
  const signature = [...tokens].sort().slice(0, 12).join("|") || title.toLowerCase();
  let hash = 0;
  for (const char of signature) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return `story-${Math.abs(hash).toString(36)}`;
}

function canonicalUrl(value: string) {
  const xPost = value.match(/x\.com\/[^/]+\/status\/(\d+)/);
  if (xPost) return `x:${xPost[1]}`;
  const youtube = value.match(/[?&]v=([^&]+)/);
  if (youtube) return `youtube:${youtube[1]}`;
  return value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

function findCluster(candidate: MonitoringCandidate, terms: string[], known: ExistingMention[]) {
  if (candidate.parentUrl) {
    const upstream = known.find((mention) => canonicalUrl(mention.url) === canonicalUrl(candidate.parentUrl));
    if (upstream) return upstream.cluster_key;
  }
  const incoming = titleTokens(candidate.title, terms);
  let best: ExistingMention | undefined;
  let bestScore = 0;
  for (const mention of known) {
    const score = similarity(incoming, titleTokens(mention.title, terms));
    if (score > bestScore) { best = mention; bestScore = score; }
  }
  return best && bestScore >= 0.38 ? best.cluster_key : hashKey(incoming, candidate.title);
}

function impactFor(candidate: MonitoringCandidate) {
  const base = candidate.platform === "网页新闻" ? 62 : candidate.platform === "YouTube" ? 58 : 48;
  return Math.min(98, base + Math.round(Math.log10(candidate.engagement + 1) * 12));
}

export async function runNewsSync(force = false) {
  await ensureDatabase();
  const db = env.DB;
  const now = new Date().toISOString();
  const lockedUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const lease = await db.prepare(`INSERT INTO sync_locks (name, locked_until) VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET locked_until = excluded.locked_until
    WHERE sync_locks.locked_until < ?`).bind("monitoring", lockedUntil, now).run();
  if ((lease.meta.changes ?? 0) === 0) return { skipped: true, reason: "sync_in_progress", inserted: 0, found: 0 };

  try {
    const lastRun = await db.prepare("SELECT id, status, started_at FROM sync_runs ORDER BY id DESC LIMIT 1").first<SyncRun>();
    const lastRunAge = lastRun ? Date.now() - new Date(lastRun.started_at).getTime() : Number.POSITIVE_INFINITY;
    if (lastRun?.status === "running" && lastRunAge < 2 * 60 * 1000) return { skipped: true, reason: "sync_in_progress", inserted: 0, found: 0 };
    if (lastRun && lastRunAge < 15 * 1000) return { skipped: true, reason: "provider_cooldown", inserted: 0, found: 0 };
    if (!force && lastRun && lastRunAge < 8 * 60 * 1000) return { skipped: true, reason: "recent_sync", inserted: 0, found: 0 };

    const entities = await db.prepare("SELECT type, value, active FROM tracked_entities WHERE active = 1 ORDER BY id ASC").all<TrackedEntity>();
    const terms = termsFrom(entities.results);
    if (!terms.length) return { skipped: true, reason: "brand_not_configured", inserted: 0, found: 0 };
    const query = gdeltQuery(terms);
    const startedAt = new Date().toISOString();
    const run = await db.prepare(`INSERT INTO sync_runs (provider, query, status, started_at) VALUES (?, ?, ?, ?)`)
      .bind("Global media + social", query, "running", startedAt).run();
    const runId = run.meta.last_row_id;

    try {
      const providers = [
        { name: "GDELT", load: () => fetchGdelt(query) },
        ...(env.X_BEARER_TOKEN ? [{ name: "X", load: () => fetchX(terms) }] : []),
        ...(env.YOUTUBE_API_KEY ? [{ name: "YouTube", load: () => fetchYouTube(terms) }] : []),
      ];
      const settled = await Promise.allSettled(providers.map((provider) => provider.load()));
      const candidates = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      const errors = settled.flatMap((result, index) => result.status === "rejected" ? [`${providers[index].name}: ${result.reason instanceof Error ? result.reason.message : "连接失败"}`] : []);
      if (!candidates.length && errors.length === providers.length) throw new Error(errors.join("；"));

      const existing = await db.prepare("SELECT title, cluster_key, url, source_country FROM mentions ORDER BY published_at DESC LIMIT 1000").all<ExistingMention>();
      const known = [...existing.results];
      const knownUrls = new Set(known.map((item) => item.url));
      const knownCountries = new Set(known.map((item) => item.source_country));
      const newCountries = new Set<string>();
      let inserted = 0;

      for (const candidate of candidates.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))) {
        if (knownUrls.has(candidate.url)) continue;
        const cluster = findCluster(candidate, terms, known);
        const analysis = analyzeText(`${candidate.title} ${candidate.discussionText}`);
        const impact = impactFor(candidate);
        const result = await db.prepare(`INSERT INTO mentions
          (title, url, source, platform, source_country, content_country, language, sentiment, risk, impact, summary, cluster_key, parent_url, relation, engagement, published_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(candidate.title, candidate.url, candidate.source, candidate.platform, candidate.sourceCountry, candidate.sourceCountry,
            candidate.language, analysis.sentiment, analysis.risk, impact,
            `自动分析 · ${analysis.topic} · ${candidate.platform} · ${candidate.engagement ? `${candidate.engagement.toLocaleString()} 次公开互动` : "互动数据未披露"}${candidate.commentsAnalyzed ? ` · 已分析 ${candidate.commentsAnalyzed} 条高相关评论` : ""}`,
            cluster, candidate.parentUrl, candidate.relation, candidate.engagement, candidate.publishedAt).run();
        known.push({ title: candidate.title, cluster_key: cluster, url: candidate.url, source_country: candidate.sourceCountry });
        knownUrls.add(candidate.url); inserted += 1;
        if (!knownCountries.has(candidate.sourceCountry) && candidate.sourceCountry !== "地区未披露") newCountries.add(candidate.sourceCountry);
        if (analysis.risk >= 70 || impact >= 90) {
          await db.prepare("INSERT INTO alerts (mention_id, title, severity, country, reason) VALUES (?, ?, ?, ?, ?)")
            .bind(result.meta.last_row_id, candidate.title, analysis.risk >= 85 ? "Critical" : "High", candidate.sourceCountry,
              analysis.risk >= 70 ? `负面或危机词触发，风险分 ${analysis.risk}` : `公开互动快速增长，影响力 ${impact}`).run();
        }
      }

      for (const country of newCountries) {
        await db.prepare("INSERT INTO alerts (title, severity, country, reason) VALUES (?, ?, ?, ?)")
          .bind(`品牌首次进入${country}的信息环境`, "High", country, "系统首次观察到该国家或地区的相关内容").run();
      }
      const status = errors.length ? "partial" : "completed";
      await db.prepare("UPDATE sync_runs SET status = ?, found_count = ?, inserted_count = ?, error = ?, completed_at = ? WHERE id = ?")
        .bind(status, candidates.length, inserted, errors.join("；"), new Date().toISOString(), runId).run();
      return { skipped: false, found: candidates.length, inserted, query, provider: providers.map((item) => item.name).join(" + "), warnings: errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知同步错误";
      await db.prepare("UPDATE sync_runs SET status = ?, error = ?, completed_at = ? WHERE id = ?")
        .bind("failed", message, new Date().toISOString(), runId).run();
      throw error;
    }
  } finally {
    await db.prepare("UPDATE sync_locks SET locked_until = ? WHERE name = ?").bind(new Date().toISOString(), "monitoring").run();
  }
}
