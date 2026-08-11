import { env } from "cloudflare:workers";
import { ensureDatabase } from "./repository";

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
};

type TrackedEntity = { type: string; value: string; active: number };
type SyncRun = { id: number; status: string; started_at: string };

const countryNames: Record<string, string> = {
  "Taiwan": "台湾", "Hong Kong": "香港", "Thailand": "泰国", "United States": "美国",
  "China": "中国", "Japan": "日本", "Singapore": "新加坡", "Malaysia": "马来西亚",
  "South Korea": "韩国", "United Kingdom": "英国", "Australia": "澳大利亚", "Canada": "加拿大",
  "Germany": "德国", "France": "法国", "Italy": "意大利", "Spain": "西班牙", "India": "印度",
  "Indonesia": "印度尼西亚", "Philippines": "菲律宾", "Vietnam": "越南", "Cambodia": "柬埔寨",
};

const languageNames: Record<string, string> = {
  English: "英文", Chinese: "中文", Thai: "泰语", Japanese: "日语", Korean: "韩语",
  Spanish: "西班牙语", French: "法语", German: "德语", Vietnamese: "越南语",
};

function compactQuery(entities: TrackedEntity[]) {
  const accepted = entities
    .filter((entity) => entity.active && entity.type !== "排除词")
    .map((entity) => entity.value.trim())
    .filter(Boolean)
    .slice(0, 12);
  const unique = [...new Set(accepted)];
  return unique.map((term) => /\s|[^\x00-\x7F]/.test(term) ? `"${term.replaceAll('"', "")}"` : term).join(" OR ");
}

function normalizePublishedAt(value?: string) {
  if (!value) return new Date().toISOString();
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function riskFor(title: string) {
  const negative = /隐私|泄露|诉讼|诈骗|禁令|抵制|召回|风险|安全|争议|批评|privacy|breach|lawsuit|fraud|ban|boycott|recall|risk|scandal/i;
  return negative.test(title) ? 74 : 28;
}

function sentimentFor(title: string) {
  return riskFor(title) >= 70 ? "负面" : "中性";
}

function clusterFor(title: string) {
  if (/somnia|硅姬|矽姬/i.test(title)) return "somnia-global-coverage";
  let hash = 0;
  for (const char of title.toLowerCase().replace(/\s+/g, " ").trim()) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return `auto-${Math.abs(hash).toString(36)}`;
}

function sourceName(article: GdeltArticle) {
  if (article.domain) return article.domain.replace(/^www\./, "");
  try { return new URL(article.url ?? "").hostname.replace(/^www\./, ""); } catch { return "未知媒体"; }
}

export async function runNewsSync(force = false) {
  await ensureDatabase();
  const db = env.DB;
  const lastRun = await db.prepare("SELECT id, status, started_at FROM sync_runs ORDER BY id DESC LIMIT 1").first<SyncRun>();
  const lastRunAge = lastRun ? Date.now() - new Date(lastRun.started_at).getTime() : Number.POSITIVE_INFINITY;
  if (lastRun?.status === "running" && lastRunAge < 2 * 60 * 1000) {
    return { skipped: true, reason: "sync_in_progress", inserted: 0, found: 0 };
  }
  if (lastRun && lastRunAge < 15 * 1000) {
    return { skipped: true, reason: "provider_cooldown", inserted: 0, found: 0 };
  }
  if (!force && lastRun && lastRunAge < 8 * 60 * 1000) {
    return { skipped: true, reason: "recent_sync", inserted: 0, found: 0 };
  }

  const entities = await db.prepare("SELECT type, value, active FROM tracked_entities WHERE active = 1 ORDER BY id ASC").all<TrackedEntity>();
  const query = compactQuery(entities.results);
  if (!query) throw new Error("请先在监测配置中添加公司名、产品名或关键词");

  const startedAt = new Date().toISOString();
  const run = await db.prepare(`INSERT INTO sync_runs (provider, query, status, started_at)
    VALUES (?, ?, ?, ?)`).bind("GDELT DOC 2.0", query, "running", startedAt).run();
  const runId = run.meta.last_row_id;

  try {
    const endpoint = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    endpoint.searchParams.set("query", `(${query})`);
    endpoint.searchParams.set("mode", "artlist");
    endpoint.searchParams.set("maxrecords", "75");
    endpoint.searchParams.set("timespan", "7d");
    endpoint.searchParams.set("sort", "datedesc");
    endpoint.searchParams.set("format", "json");

    const response = await fetch(endpoint, {
      headers: { "Accept": "application/json", "User-Agent": "SignalAtlas/1.0 media-monitoring" },
      signal: AbortSignal.timeout(18_000),
    });
    if (!response.ok) throw new Error(`新闻索引返回 HTTP ${response.status}`);
    const payload = await response.json() as { articles?: GdeltArticle[] };
    const articles = (payload.articles ?? []).filter((article) => article.url && article.title);

    const existing = await db.prepare("SELECT url FROM mentions").all<{ url: string }>();
    const knownUrls = new Set(existing.results.map((item) => item.url));
    const knownCountries = new Set((await db.prepare("SELECT DISTINCT source_country AS country FROM mentions").all<{ country: string }>()).results.map((item) => item.country));
    let inserted = 0;
    const newCountries = new Set<string>();

    for (const article of articles) {
      const url = article.url!;
      if (knownUrls.has(url)) continue;
      const title = article.title!.trim();
      const country = countryNames[article.sourcecountry ?? ""] ?? article.sourcecountry ?? "未知地区";
      const language = languageNames[article.language ?? ""] ?? article.language ?? "自动识别";
      const source = sourceName(article);
      const risk = riskFor(title);
      await db.prepare(`INSERT INTO mentions
        (title, url, source, platform, source_country, content_country, language, sentiment, risk, impact, summary, cluster_key, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(title, url, source, "网页新闻", country, country, language, sentimentFor(title), risk, 68,
          `GDELT 全球新闻索引自动发现 · ${source} · 来源国家 ${country}`, clusterFor(title), normalizePublishedAt(article.seendate))
        .run();
      knownUrls.add(url);
      inserted += 1;
      if (!knownCountries.has(country)) newCountries.add(country);
    }

    for (const country of newCountries) {
      await db.prepare("INSERT INTO alerts (title, severity, country, reason) VALUES (?, ?, ?, ?)")
        .bind(`监测对象首次进入${country}媒体`, "High", country, "GDELT 自动搜索发现新的来源国家或地区")
        .run();
    }

    await db.prepare(`UPDATE sync_runs SET status = ?, found_count = ?, inserted_count = ?, completed_at = ? WHERE id = ?`)
      .bind("completed", articles.length, inserted, new Date().toISOString(), runId).run();
    return { skipped: false, found: articles.length, inserted, query, provider: "GDELT DOC 2.0" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知同步错误";
    await db.prepare(`UPDATE sync_runs SET status = ?, error = ?, completed_at = ? WHERE id = ?`)
      .bind("failed", message, new Date().toISOString(), runId).run();
    throw error;
  }
}
