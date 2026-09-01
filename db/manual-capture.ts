import { inferLanguage } from "./providers";

type InteractionMetrics = { likes: number; comments: number; shares: number; views: number; plays: number };

function safePublicUrl(value: string) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) throw new Error("只支持公开的 HTTP 或 HTTPS 链接");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "::1"
    || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^169\.254\./.test(host)) throw new Error("链接不是可公开访问的地址");
  return url;
}

async function fetchPublicHtml(initial: URL) {
  let url = initial;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const response = await fetch(url, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (compatible; GlobalMediaIntelligence/1.0; +https://chatgpt.site)" }, signal: AbortSignal.timeout(8_000) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`页面重定向缺少目标地址（HTTP ${response.status}）`);
      url = safePublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`公开页面返回 HTTP ${response.status}`);
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("json")) throw new Error("链接未返回可分析的网页内容");
    return (await response.text()).slice(0, 1_500_000);
  }
  throw new Error("页面重定向次数过多");
}

function decodeHtml(value: string) {
  return value.replace(/&quot;|&#34;/gi, '"').replace(/&apos;|&#39;/gi, "'").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))).trim();
}

function tagAttributes(tag: string) {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) result[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  return result;
}

function metaValue(html: string, ...keys: string[]) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = tagAttributes(tag);
    if (wanted.has(String(attributes.property ?? attributes.name ?? attributes.itemprop ?? "").toLowerCase()) && attributes.content) return attributes.content;
  }
  return "";
}

function compactNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const text = String(value ?? "").replaceAll(",", "").trim();
  const match = text.match(/^([0-9]+(?:\.[0-9]+)?)\s*([kmb万亿])?$/i);
  if (!match) return -1;
  const unit = match[2]?.toLowerCase();
  const multiplier = unit === "k" ? 1_000 : unit === "m" ? 1_000_000 : unit === "b" ? 1_000_000_000 : unit === "万" ? 10_000 : unit === "亿" ? 100_000_000 : 1;
  return Math.max(0, Math.round(Number(match[1]) * multiplier));
}

function structuredMetrics(html: string): InteractionMetrics {
  const metrics: InteractionMetrics = { likes: -1, comments: -1, shares: -1, views: -1, plays: -1 };
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => decodeHtml(match[1]));
  const visit = (value: unknown, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 10) return;
    if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return; }
    const row = value as Record<string, unknown>;
    const action = String((row.interactionType as Record<string, unknown> | undefined)?.["@type"] ?? row.interactionType ?? row["@type"] ?? "").toLowerCase();
    const count = compactNumber(row.userInteractionCount ?? row.interactionCount ?? row.count);
    if (count >= 0) {
      if (action.includes("like")) metrics.likes = Math.max(metrics.likes, count);
      else if (action.includes("comment")) metrics.comments = Math.max(metrics.comments, count);
      else if (action.includes("share")) metrics.shares = Math.max(metrics.shares, count);
      else if (action.includes("watch") || action.includes("view")) metrics.views = Math.max(metrics.views, count);
    }
    const commentCount = compactNumber(row.commentCount);
    if (commentCount >= 0) metrics.comments = Math.max(metrics.comments, commentCount);
    Object.values(row).forEach((item) => visit(item, depth + 1));
  };
  for (const script of scripts) { try { visit(JSON.parse(script)); } catch { /* Ignore malformed publisher JSON-LD. */ } }
  return metrics;
}

export async function captureManualPublicLink(db: D1Database, brandId: number, mentionId: number, link: string, platform: string, postId = "") {
  const now = new Date().toISOString();
  try {
    const url = safePublicUrl(link);
    const html = await fetchPublicHtml(url);
    const title = metaValue(html, "og:title", "twitter:title") || decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const description = metaValue(html, "og:description", "twitter:description", "description");
    const siteName = metaValue(html, "og:site_name", "application-name");
    const htmlLanguage = tagAttributes(html.match(/<html\b[^>]*>/i)?.[0] ?? "").lang ?? "";
    const language = inferLanguage(`${title} ${description}`, htmlLanguage).language;
    const metrics = structuredMetrics(html);
    const metricValues = Object.values(metrics).filter((value) => value >= 0);
    const engagement = metricValues.reduce((sum, value) => sum + value, 0);
    const status = metricValues.length ? "completed" : "metadata_only";
    await db.batch([
      db.prepare(`UPDATE mentions SET
        title = CASE WHEN title LIKE '指定帖子%' AND ? != '' THEN ? ELSE title END,
        source = CASE WHEN (source = '' OR source IN ('网页新闻','博客')) AND ? != '' THEN ? ELSE source END,
        excerpt = CASE WHEN excerpt = '' AND ? != '' THEN ? ELSE excerpt END,
        language = CASE WHEN language IN ('', '语言待确认', '自动识别') AND ? != '' THEN ? ELSE language END,
        engagement = MAX(engagement, ?), capture_status = ?, capture_error = '', capture_updated_at = ?
        WHERE brand_id = ? AND id = ?`)
        .bind(title, title.slice(0, 300), siteName, siteName.slice(0, 160), description, description.slice(0, 2000), language, language,
          engagement, status, now, brandId, mentionId),
      db.prepare(`INSERT INTO social_post_metrics
        (mention_id, brand_id, platform, post_id, likes, comments, shares, views, plays, matched_terms, metrics_updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)
        ON CONFLICT(mention_id) DO UPDATE SET
          platform = excluded.platform, post_id = CASE WHEN excluded.post_id != '' THEN excluded.post_id ELSE social_post_metrics.post_id END,
          likes = CASE WHEN excluded.likes >= 0 THEN excluded.likes ELSE social_post_metrics.likes END,
          comments = CASE WHEN excluded.comments >= 0 THEN excluded.comments ELSE social_post_metrics.comments END,
          shares = CASE WHEN excluded.shares >= 0 THEN excluded.shares ELSE social_post_metrics.shares END,
          views = CASE WHEN excluded.views >= 0 THEN excluded.views ELSE social_post_metrics.views END,
          plays = CASE WHEN excluded.plays >= 0 THEN excluded.plays ELSE social_post_metrics.plays END,
          metrics_updated_at = excluded.metrics_updated_at`)
        .bind(mentionId, brandId, platform, postId, metrics.likes, metrics.comments, metrics.shares, metrics.views, metrics.plays, now),
    ]);
    return { status, metrics };
  } catch (error) {
    const message = error instanceof Error ? error.message : "公开页面数据读取失败";
    await db.prepare("UPDATE mentions SET capture_status = 'failed', capture_error = ?, capture_updated_at = ? WHERE brand_id = ? AND id = ?")
      .bind(message.slice(0, 500), now, brandId, mentionId).run();
    return { status: "failed", error: message };
  }
}
