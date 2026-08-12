import type { MonitoringCandidate } from "./providers";

type SourceRow = {
  id: number;
  brand_id: number;
  domain: string;
  name: string;
  country: string;
  language: string;
  homepage_url: string;
  feed_url: string;
  sitemap_url: string;
  robots_policy: string;
  robots_checked_at: string;
  etag: string;
  last_modified: string;
};

type ParsedItem = { title: string; url: string; publishedAt: string; description: string; author: string };

const CRAWLER_AGENT = "SignalAtlasBot/3.0 (+brand-monitoring; respects robots.txt)";
const MAX_BODY_SIZE = 2_500_000;

function xmlDecode(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function cleanText(value: string) {
  return xmlDecode(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}

function element(block: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(":", "\\:");
    const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

function absoluteUrl(value: string, base: string) {
  try { return new URL(xmlDecode(value.trim()), base).toString(); } catch { return ""; }
}

function safePublicUrl(value: string) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "::1") return false;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    return true;
  } catch { return false; }
}

function isoDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

async function fetchDocument(url: string, headers: Record<string, string> = {}) {
  if (!safePublicUrl(url)) throw new Error("非公开网络地址");
  const response = await fetch(url, {
    headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8", "User-Agent": CRAWLER_AGENT, ...headers },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (response.status === 304) return { response, text: "" };
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_SIZE) throw new Error("响应内容过大");
  const text = (await response.text()).slice(0, MAX_BODY_SIZE);
  return { response, text };
}

function parseRobots(policy: string) {
  const rules: Array<{ allow: boolean; path: string }> = [];
  const sitemaps: string[] = [];
  let applies = false;
  for (const raw of policy.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const [field, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (field?.toLowerCase() === "user-agent") applies = value === "*" || value.toLowerCase().includes("signalatlasbot");
    else if (applies && field?.toLowerCase() === "disallow" && value) rules.push({ allow: false, path: value });
    else if (applies && field?.toLowerCase() === "allow" && value) rules.push({ allow: true, path: value });
    else if (field?.toLowerCase() === "sitemap" && safePublicUrl(value)) sitemaps.push(value);
  }
  return { rules, sitemaps };
}

function robotsAllows(url: string, policy: string) {
  if (!policy) return true;
  const path = new URL(url).pathname;
  const matches = parseRobots(policy).rules.filter((rule) => path.startsWith(rule.path)).sort((a, b) => b.path.length - a.path.length);
  return matches[0]?.allow ?? true;
}

function parseFeed(xml: string, base: string): ParsedItem[] {
  const rssItems = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const atomItems = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  return [...rssItems, ...atomItems].slice(0, 80).flatMap((block) => {
    const title = element(block, ["title"]);
    const atomHref = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] ?? "";
    const url = absoluteUrl(element(block, ["link", "guid"]) || atomHref, base);
    if (!title || !url || !safePublicUrl(url)) return [];
    return [{
      title,
      url,
      publishedAt: isoDate(element(block, ["pubDate", "published", "updated", "dc:date"])),
      description: cleanText(element(block, ["description", "content:encoded", "summary", "content"])).slice(0, 1800),
      author: element(block, ["author", "dc:creator"]),
    }];
  });
}

function parseSitemap(xml: string, base: string): ParsedItem[] {
  const blocks = xml.match(/<url\b[\s\S]*?<\/url>/gi) ?? [];
  return blocks.slice(0, 500).flatMap((block) => {
    const url = absoluteUrl(element(block, ["loc"]), base);
    const title = element(block, ["news:title"]);
    if (!url || !title || !safePublicUrl(url)) return [];
    return [{
      title,
      url,
      publishedAt: isoDate(element(block, ["news:publication_date", "lastmod"])),
      description: "",
      author: "",
    }];
  });
}

function isFeed(content: string) {
  return /<(rss|feed|rdf:RDF)\b/i.test(content) && /<(item|entry)\b/i.test(content);
}

function isNewsSitemap(content: string) {
  return /<urlset\b/i.test(content) && /<news:title\b/i.test(content);
}

function matchesTerms(item: ParsedItem, terms: string[]) {
  const haystack = `${item.title} ${item.description}`.toLocaleLowerCase();
  return terms.some((term) => haystack.includes(term.toLocaleLowerCase()));
}

export async function registerMediaSources(db: D1Database, brandId: number, candidates: MonitoringCandidate[]) {
  const now = new Date().toISOString();
  const statements = candidates.flatMap((candidate) => {
    if (candidate.platform !== "网页新闻" || !safePublicUrl(candidate.url)) return [];
    const article = new URL(candidate.url);
    const domain = article.hostname.replace(/^www\./, "").toLowerCase();
    const homepage = `${article.protocol}//${article.host}/`;
    return [db.prepare(`INSERT INTO media_sources
      (brand_id, domain, name, country, language, homepage_url, last_discovered_at, next_crawl_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(brand_id, domain) DO UPDATE SET
        name = CASE WHEN excluded.name != '' THEN excluded.name ELSE media_sources.name END,
        country = CASE WHEN media_sources.country IN ('地区未披露', '地区待确认') THEN excluded.country ELSE media_sources.country END,
        language = CASE WHEN media_sources.language IN ('自动识别', '语言待确认') THEN excluded.language ELSE media_sources.language END,
        last_discovered_at = excluded.last_discovered_at,
        updated_at = excluded.last_discovered_at`)
      .bind(brandId, domain, candidate.source, candidate.sourceCountry, candidate.language, homepage, now, now)];
  });
  for (let index = 0; index < statements.length; index += 50) await db.batch(statements.slice(index, index + 50));
}

export async function backfillMediaSources(db: D1Database, brandId: number) {
  const rows = await db.prepare(`SELECT title, url, source, platform, source_country, language, published_at
    FROM mentions WHERE brand_id = ? AND platform = '网页新闻' ORDER BY published_at DESC LIMIT 1000`)
    .bind(brandId).all<{ title: string; url: string; source: string; platform: "网页新闻"; source_country: string; language: string; published_at: string }>();
  const candidates = rows.results.map((row) => ({
    title: row.title, url: row.url, source: row.source, platform: row.platform, sourceCountry: row.source_country,
    language: row.language, publishedAt: row.published_at, engagement: 0, discussionText: "", commentsAnalyzed: 0,
    parentUrl: "", relation: "", provider: "历史档案", discoveredVia: "global_discovery" as const,
  }));
  await registerMediaSources(db, brandId, candidates);
}

async function loadRobots(db: D1Database, source: SourceRow) {
  const fresh = source.robots_checked_at && Date.now() - new Date(source.robots_checked_at).getTime() < 7 * 86400_000;
  if (fresh) return source.robots_policy;
  const robotsUrl = new URL("/robots.txt", source.homepage_url).toString();
  let policy = "";
  try {
    const result = await fetchDocument(robotsUrl);
    policy = result.text.slice(0, 12_000);
  } catch {
    policy = "";
  }
  const checkedAt = new Date().toISOString();
  await db.prepare("UPDATE media_sources SET robots_policy = ?, robots_checked_at = ?, updated_at = ? WHERE id = ?")
    .bind(policy, checkedAt, checkedAt, source.id).run();
  return policy;
}

async function discoverEndpoint(source: SourceRow, policy: string) {
  const candidates: string[] = [];
  const robotsSitemaps = parseRobots(policy).sitemaps;
  if (source.feed_url) candidates.push(source.feed_url);
  if (source.sitemap_url) candidates.push(source.sitemap_url);
  if (!source.feed_url && !source.sitemap_url) {
    try {
      if (robotsAllows(source.homepage_url, policy)) {
        const home = await fetchDocument(source.homepage_url);
        const links = [...home.text.matchAll(/<link\b[^>]*rel=["'][^"']*alternate[^"']*["'][^>]*>/gi)];
        for (const match of links) {
          if (!/(rss|atom)\+xml/i.test(match[0])) continue;
          const href = match[0].match(/href=["']([^"']+)["']/i)?.[1];
          if (href) candidates.push(absoluteUrl(href, source.homepage_url));
        }
      }
    } catch { /* fallback endpoints below */ }
    candidates.push(...robotsSitemaps, new URL("/feed/", source.homepage_url).toString(), new URL("/rss.xml", source.homepage_url).toString(), new URL("/news-sitemap.xml", source.homepage_url).toString(), new URL("/sitemap.xml", source.homepage_url).toString());
  }
  for (const url of [...new Set(candidates.filter(Boolean))].slice(0, 5)) {
    if (!robotsAllows(url, policy)) continue;
    try {
      const result = await fetchDocument(url, {
        ...(source.etag ? { "If-None-Match": source.etag } : {}),
        ...(source.last_modified ? { "If-Modified-Since": source.last_modified } : {}),
      });
      if (result.response.status === 304) return { url, kind: source.feed_url ? "feed" as const : "sitemap" as const, text: "", response: result.response };
      if (isFeed(result.text)) return { url, kind: "feed" as const, text: result.text, response: result.response };
      if (isNewsSitemap(result.text)) return { url, kind: "sitemap" as const, text: result.text, response: result.response };
    } catch { /* try the next public endpoint */ }
  }
  return null;
}

async function crawlOneSource(db: D1Database, source: SourceRow, terms: string[]) {
  const startedAt = new Date().toISOString();
  try {
    const policy = await loadRobots(db, source);
    const endpoint = await discoverEndpoint(source, policy);
    if (!endpoint) {
      await db.prepare(`UPDATE media_sources SET status = 'watching', last_crawled_at = ?, next_crawl_at = ?,
        error_count = 0, last_error = '', updated_at = ? WHERE id = ?`)
        .bind(startedAt, new Date(Date.now() + 12 * 3600_000).toISOString(), startedAt, source.id).run();
      return [] as MonitoringCandidate[];
    }
    const parsed = endpoint.text ? (endpoint.kind === "feed" ? parseFeed(endpoint.text, endpoint.url) : parseSitemap(endpoint.text, endpoint.url)) : [];
    const candidates = parsed.filter((item) => matchesTerms(item, terms)).map((item) => ({
      title: item.title,
      url: item.url,
      source: source.name || source.domain,
      platform: "网页新闻" as const,
      sourceCountry: source.country,
      language: source.language,
      publishedAt: item.publishedAt,
      engagement: 0,
      discussionText: item.description,
      commentsAnalyzed: 0,
      parentUrl: "",
      relation: "",
      author: item.author,
      provider: endpoint.kind === "feed" ? "RSS / Atom" : "News Sitemap",
      discoveredVia: "free_crawler" as const,
    }));
    await db.prepare(`UPDATE media_sources SET status = 'active', feed_url = ?, sitemap_url = ?, last_crawled_at = ?, next_crawl_at = ?,
      error_count = 0, last_error = '', etag = ?, last_modified = ?, updated_at = ? WHERE id = ?`)
      .bind(endpoint.kind === "feed" ? endpoint.url : source.feed_url, endpoint.kind === "sitemap" ? endpoint.url : source.sitemap_url,
        startedAt, new Date(Date.now() + 3 * 3600_000).toISOString(), endpoint.response.headers.get("etag") ?? source.etag,
        endpoint.response.headers.get("last-modified") ?? source.last_modified, startedAt, source.id).run();
    return candidates;
  } catch (error) {
    const message = error instanceof Error ? error.message : "抓取失败";
    await db.prepare(`UPDATE media_sources SET status = 'error', error_count = error_count + 1, last_error = ?, last_crawled_at = ?,
      next_crawl_at = ?, updated_at = ? WHERE id = ?`)
      .bind(message.slice(0, 300), startedAt, new Date(Date.now() + 24 * 3600_000).toISOString(), startedAt, source.id).run();
    return [] as MonitoringCandidate[];
  }
}

export async function crawlMediaSources(db: D1Database, brandId: number, terms: string[]) {
  const now = new Date().toISOString();
  const rows = await db.prepare(`SELECT id, domain, name, country, language, homepage_url, feed_url, sitemap_url,
    brand_id, robots_policy, robots_checked_at, etag, last_modified FROM media_sources
    WHERE brand_id = ? AND status != 'blocked' AND next_crawl_at <= ? ORDER BY next_crawl_at ASC LIMIT 10`).bind(brandId, now).all<SourceRow>();
  const settled = await Promise.allSettled(rows.results.map((source) => crawlOneSource(db, source, terms)));
  return {
    candidates: settled.flatMap((result) => result.status === "fulfilled" ? result.value : []),
    crawled: rows.results.length,
  };
}
