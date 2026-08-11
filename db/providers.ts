import { env } from "cloudflare:workers";

export type MonitoringCandidate = {
  title: string;
  url: string;
  source: string;
  platform: "网页新闻" | "X" | "YouTube";
  sourceCountry: string;
  language: string;
  publishedAt: string;
  engagement: number;
};

type GdeltArticle = { url?: string; title?: string; seendate?: string; domain?: string; language?: string; sourcecountry?: string };
type XUser = { id: string; username?: string; name?: string; location?: string };
type XPlace = { id: string; country?: string; country_code?: string; full_name?: string };
type XPost = {
  id: string; text: string; author_id?: string; created_at?: string; lang?: string; geo?: { place_id?: string };
  public_metrics?: { like_count?: number; reply_count?: number; retweet_count?: number; quote_count?: number };
};
type XPayload = { data?: XPost[]; includes?: { users?: XUser[]; places?: XPlace[] } };
type YouTubeItem = { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; publishedAt?: string } };
type YouTubePayload = { items?: YouTubeItem[] };

const countryNames: Record<string, string> = {
  Taiwan: "台湾", "Hong Kong": "香港", Thailand: "泰国", "United States": "美国", China: "中国",
  Japan: "日本", Singapore: "新加坡", Malaysia: "马来西亚", "South Korea": "韩国", "United Kingdom": "英国",
  Australia: "澳大利亚", Canada: "加拿大", Germany: "德国", France: "法国", Italy: "意大利", Spain: "西班牙",
  India: "印度", Indonesia: "印度尼西亚", Philippines: "菲律宾", Vietnam: "越南", Cambodia: "柬埔寨",
};

const languageNames: Record<string, string> = {
  English: "英文", Chinese: "中文", Thai: "泰语", Japanese: "日语", Korean: "韩语", Spanish: "西班牙语",
  French: "法语", German: "德语", Vietnamese: "越南语", en: "英文", zh: "中文", th: "泰语", ja: "日语", ko: "韩语",
};

function isoDate(value?: string) {
  if (!value) return new Date().toISOString();
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export async function fetchGdelt(query: string): Promise<MonitoringCandidate[]> {
  const endpoint = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  endpoint.searchParams.set("query", `(${query})`);
  endpoint.searchParams.set("mode", "artlist");
  endpoint.searchParams.set("maxrecords", "75");
  endpoint.searchParams.set("timespan", "7d");
  endpoint.searchParams.set("sort", "datedesc");
  endpoint.searchParams.set("format", "json");
  const response = await fetch(endpoint, { headers: { Accept: "application/json", "User-Agent": "SignalAtlas/2.0 brand-monitoring" }, signal: AbortSignal.timeout(18_000) });
  if (!response.ok) throw new Error(`GDELT HTTP ${response.status}`);
  const payload = await response.json() as { articles?: GdeltArticle[] };
  return (payload.articles ?? []).filter((item) => item.url && item.title).map((item) => ({
    title: item.title!.trim(), url: item.url!, source: item.domain?.replace(/^www\./, "") ?? new URL(item.url!).hostname.replace(/^www\./, ""),
    platform: "网页新闻", sourceCountry: countryNames[item.sourcecountry ?? ""] ?? item.sourcecountry ?? "地区未披露",
    language: languageNames[item.language ?? ""] ?? item.language ?? "自动识别", publishedAt: isoDate(item.seendate), engagement: 0,
  }));
}

export async function fetchX(terms: string[]): Promise<MonitoringCandidate[]> {
  if (!env.X_BEARER_TOKEN) return [];
  const endpoint = new URL("https://api.x.com/2/tweets/search/recent");
  endpoint.searchParams.set("query", `(${terms.slice(0, 8).map((term) => `"${term.replaceAll('"', "")}"`).join(" OR ")}) -is:retweet`);
  endpoint.searchParams.set("max_results", "100");
  endpoint.searchParams.set("sort_order", "recency");
  endpoint.searchParams.set("tweet.fields", "created_at,lang,public_metrics,geo,conversation_id,referenced_tweets");
  endpoint.searchParams.set("expansions", "author_id,geo.place_id");
  endpoint.searchParams.set("user.fields", "username,name,location");
  endpoint.searchParams.set("place.fields", "country,country_code,full_name");
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${env.X_BEARER_TOKEN}` }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`X API HTTP ${response.status}`);
  const payload = await response.json() as XPayload;
  const users = new Map<string, XUser>();
  for (const user of payload.includes?.users ?? []) users.set(user.id, user);
  const places = new Map<string, XPlace>();
  for (const place of payload.includes?.places ?? []) places.set(place.id, place);
  return (payload.data ?? []).map((post) => {
    const user = post.author_id ? users.get(post.author_id) : undefined;
    const place = post.geo?.place_id ? places.get(post.geo.place_id) : undefined;
    const metrics = post.public_metrics ?? {};
    const placeCountry = place?.country;
    const postLanguage = post.lang;
    return {
      title: post.text, url: `https://x.com/${user?.username ?? "i"}/status/${post.id}`, source: user?.username ? `@${user.username}` : "X 用户",
      platform: "X", sourceCountry: placeCountry ? countryNames[placeCountry] ?? placeCountry : "地区未披露", language: postLanguage ? languageNames[postLanguage] ?? postLanguage : "自动识别",
      publishedAt: isoDate(post.created_at), engagement: Number(metrics.like_count ?? 0) + Number(metrics.reply_count ?? 0) + Number(metrics.retweet_count ?? 0) + Number(metrics.quote_count ?? 0),
    } as MonitoringCandidate;
  });
}

export async function fetchYouTube(terms: string[]): Promise<MonitoringCandidate[]> {
  if (!env.YOUTUBE_API_KEY) return [];
  const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
  endpoint.searchParams.set("part", "snippet"); endpoint.searchParams.set("type", "video"); endpoint.searchParams.set("order", "date");
  endpoint.searchParams.set("maxResults", "50"); endpoint.searchParams.set("q", terms.slice(0, 8).join("|"));
  endpoint.searchParams.set("publishedAfter", new Date(Date.now() - 7 * 86400_000).toISOString()); endpoint.searchParams.set("key", env.YOUTUBE_API_KEY);
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`YouTube API HTTP ${response.status}`);
  const payload = await response.json() as YouTubePayload;
  return (payload.items ?? []).flatMap((item) => {
    const videoId = item.id?.videoId;
    if (!videoId) return [];
    return [{
      title: item.snippet?.title ?? "YouTube 视频", url: `https://www.youtube.com/watch?v=${videoId}`,
      source: item.snippet?.channelTitle ?? "YouTube 频道", platform: "YouTube" as const, sourceCountry: "地区未披露",
      language: "自动识别", publishedAt: isoDate(item.snippet?.publishedAt), engagement: 0,
    }];
  });
}
