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
  discussionText: string;
  commentsAnalyzed: number;
  parentUrl: string;
  relation: string;
};

type GdeltArticle = { url?: string; title?: string; seendate?: string; domain?: string; language?: string; sourcecountry?: string };
type EventRegistryLabel = string | { eng?: string };
type EventRegistryLocation = { label?: EventRegistryLabel; country?: { label?: EventRegistryLabel } };
type EventRegistryArticle = {
  uri?: string;
  url?: string;
  title?: string;
  body?: string;
  dateTime?: string;
  date?: string;
  time?: string;
  lang?: string;
  sentiment?: number | null;
  shares?: Record<string, number | undefined>;
  source?: { uri?: string; title?: string; location?: EventRegistryLocation };
  originalArticle?: { url?: string };
};
type EventRegistryPayload = {
  articles?: { results?: EventRegistryArticle[] };
  error?: string | { message?: string };
};
type XUser = { id: string; username?: string; name?: string; location?: string };
type XPlace = { id: string; country?: string; country_code?: string; full_name?: string };
type XPost = {
  id: string; text: string; author_id?: string; created_at?: string; lang?: string; geo?: { place_id?: string };
  public_metrics?: { like_count?: number; reply_count?: number; retweet_count?: number; quote_count?: number };
  referenced_tweets?: Array<{ type: "retweeted" | "quoted" | "replied_to"; id: string }>;
};
type XPayload = { data?: XPost[]; includes?: { users?: XUser[]; places?: XPlace[]; tweets?: XPost[] } };
type YouTubeItem = { id?: { videoId?: string }; snippet?: { title?: string; description?: string; channelId?: string; channelTitle?: string; publishedAt?: string } };
type YouTubePayload = { items?: YouTubeItem[] };
type YouTubeStatsPayload = { items?: Array<{ id: string; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }> };
type YouTubeChannelsPayload = { items?: Array<{ id: string; snippet?: { country?: string } }> };
type YouTubeCommentsPayload = { items?: Array<{ snippet?: { topLevelComment?: { snippet?: { textDisplay?: string; likeCount?: number } } } }> };

export class ProviderRequestError extends Error {
  constructor(public provider: string, public status: number, public retryAfterMs: number | null, message: string) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

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

const countryCodes: Record<string, string> = {
  US: "美国", GB: "英国", TW: "台湾", HK: "香港", TH: "泰国", CN: "中国", JP: "日本", KR: "韩国",
  SG: "新加坡", MY: "马来西亚", AU: "澳大利亚", CA: "加拿大", DE: "德国", FR: "法国", IN: "印度",
};

const relationNames = { retweeted: "直接转发", quoted: "引用传播", replied_to: "回复讨论" } as const;

function isoDate(value?: string) {
  if (!value) return new Date().toISOString();
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function retryAfterMs(response: Response) {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const absolute = new Date(header).getTime();
  return Number.isNaN(absolute) ? null : Math.max(0, absolute - Date.now());
}

function englishLabel(value?: EventRegistryLabel) {
  return typeof value === "string" ? value : value?.eng;
}

export async function fetchEventRegistry(terms: string[]): Promise<MonitoringCandidate[]> {
  if (!env.NEWSAPI_AI_KEY) return [];
  const response = await fetch("https://eventregistry.org/api/v1/article/getArticles", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getArticles",
      keyword: terms.slice(0, 12),
      keywordOper: "or",
      keywordSearchMode: "phrase",
      keywordLoc: "title,body",
      articlesPage: 1,
      articlesCount: 100,
      articlesSortBy: "date",
      articlesSortByAsc: false,
      articleBodyLen: 2000,
      dataType: ["news", "pr", "blog"],
      forceMaxDataTimeWindow: 31,
      resultType: "articles",
      includeSourceLocation: true,
      includeArticleSocialScore: true,
      includeArticleOriginalArticle: true,
      apiKey: env.NEWSAPI_AI_KEY,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new ProviderRequestError("NewsAPI.ai", response.status, retryAfterMs(response), `NewsAPI.ai HTTP ${response.status}`);
  const payload = await response.json() as EventRegistryPayload;
  if (payload.error) {
    const message = typeof payload.error === "string" ? payload.error : payload.error.message ?? "接口返回错误";
    throw new Error(`NewsAPI.ai: ${message}`);
  }
  return (payload.articles?.results ?? []).filter((item) => item.url && item.title).map((item) => {
    const sourceLocation = englishLabel(item.source?.location?.country?.label) ?? englishLabel(item.source?.location?.label);
    const engagement = Object.values(item.shares ?? {}).reduce<number>((total, value) => total + (Number(value) || 0), 0);
    return {
      title: item.title!.trim(),
      url: item.url!,
      source: item.source?.title ?? item.source?.uri ?? new URL(item.url!).hostname.replace(/^www\./, ""),
      platform: "网页新闻" as const,
      sourceCountry: sourceLocation ? countryNames[sourceLocation] ?? sourceLocation : "地区未披露",
      language: item.lang ? languageNames[item.lang] ?? item.lang : "自动识别",
      publishedAt: isoDate(item.dateTime ?? [item.date, item.time].filter(Boolean).join("T")),
      engagement,
      discussionText: [item.body ?? "", item.sentiment == null ? "" : `provider-sentiment:${item.sentiment}`].join(" "),
      commentsAnalyzed: 0,
      parentUrl: item.originalArticle?.url ?? "",
      relation: item.originalArticle?.url ? "原始报道" : "",
    };
  });
}

export async function fetchGdelt(query: string): Promise<MonitoringCandidate[]> {
  const endpoint = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  endpoint.searchParams.set("query", `(${query})`);
  endpoint.searchParams.set("mode", "artlist");
  endpoint.searchParams.set("maxrecords", "250");
  endpoint.searchParams.set("timespan", "30d");
  endpoint.searchParams.set("sort", "datedesc");
  endpoint.searchParams.set("format", "json");
  const response = await fetch(endpoint, { headers: { Accept: "application/json", "User-Agent": "SignalAtlas/2.0 brand-monitoring" }, signal: AbortSignal.timeout(18_000) });
  if (!response.ok) throw new ProviderRequestError("GDELT", response.status, retryAfterMs(response), `GDELT HTTP ${response.status}`);
  const payload = await response.json() as { articles?: GdeltArticle[] };
  return (payload.articles ?? []).filter((item) => item.url && item.title).map((item) => ({
    title: item.title!.trim(), url: item.url!, source: item.domain?.replace(/^www\./, "") ?? new URL(item.url!).hostname.replace(/^www\./, ""),
    platform: "网页新闻", sourceCountry: countryNames[item.sourcecountry ?? ""] ?? item.sourcecountry ?? "地区未披露",
    language: languageNames[item.language ?? ""] ?? item.language ?? "自动识别", publishedAt: isoDate(item.seendate), engagement: 0,
    discussionText: "", commentsAnalyzed: 0, parentUrl: "", relation: "",
  }));
}

export async function fetchX(terms: string[]): Promise<MonitoringCandidate[]> {
  if (!env.X_BEARER_TOKEN) return [];
  const endpoint = new URL("https://api.x.com/2/tweets/search/recent");
  endpoint.searchParams.set("query", `(${terms.slice(0, 8).map((term) => `"${term.replaceAll('"', "")}"`).join(" OR ")})`);
  endpoint.searchParams.set("max_results", "100");
  endpoint.searchParams.set("sort_order", "recency");
  endpoint.searchParams.set("tweet.fields", "created_at,lang,public_metrics,geo,conversation_id,referenced_tweets");
  endpoint.searchParams.set("expansions", "author_id,geo.place_id,referenced_tweets.id,referenced_tweets.id.author_id");
  endpoint.searchParams.set("user.fields", "username,name,location");
  endpoint.searchParams.set("place.fields", "country,country_code,full_name");
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${env.X_BEARER_TOKEN}` }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`X API HTTP ${response.status}`);
  const payload = await response.json() as XPayload;
  const users = new Map<string, XUser>();
  for (const user of payload.includes?.users ?? []) users.set(user.id, user);
  const places = new Map<string, XPlace>();
  for (const place of payload.includes?.places ?? []) places.set(place.id, place);
  const posts = new Map<string, XPost>();
  for (const post of [...(payload.includes?.tweets ?? []), ...(payload.data ?? [])]) posts.set(post.id, post);
  return [...posts.values()].map((post) => {
    const user = post.author_id ? users.get(post.author_id) : undefined;
    const place = post.geo?.place_id ? places.get(post.geo.place_id) : undefined;
    const metrics = post.public_metrics ?? {};
    const placeCountry = place?.country;
    const postLanguage = post.lang;
    const reference = post.referenced_tweets?.[0];
    return {
      title: post.text, url: `https://x.com/${user?.username ?? "i"}/status/${post.id}`, source: user?.username ? `@${user.username}` : "X 用户",
      platform: "X", sourceCountry: placeCountry ? countryNames[placeCountry] ?? placeCountry : "地区未披露", language: postLanguage ? languageNames[postLanguage] ?? postLanguage : "自动识别",
      publishedAt: isoDate(post.created_at), engagement: Number(metrics.like_count ?? 0) + Number(metrics.reply_count ?? 0) + Number(metrics.retweet_count ?? 0) + Number(metrics.quote_count ?? 0),
      discussionText: "", commentsAnalyzed: 0, parentUrl: reference ? `https://x.com/i/status/${reference.id}` : "",
      relation: reference ? relationNames[reference.type] : "",
    } as MonitoringCandidate;
  });
}

export async function fetchYouTube(terms: string[]): Promise<MonitoringCandidate[]> {
  if (!env.YOUTUBE_API_KEY) return [];
  const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
  endpoint.searchParams.set("part", "snippet"); endpoint.searchParams.set("type", "video"); endpoint.searchParams.set("order", "date");
  endpoint.searchParams.set("maxResults", "50"); endpoint.searchParams.set("q", terms.slice(0, 8).join("|"));
  endpoint.searchParams.set("publishedAfter", new Date(Date.now() - 30 * 86400_000).toISOString()); endpoint.searchParams.set("key", env.YOUTUBE_API_KEY);
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`YouTube API HTTP ${response.status}`);
  const payload = await response.json() as YouTubePayload;
  const items = (payload.items ?? []).filter((item) => item.id?.videoId);
  const videoIds = items.flatMap((item) => item.id?.videoId ? [item.id.videoId] : []);
  const channelIds = [...new Set(items.flatMap((item) => item.snippet?.channelId ? [item.snippet.channelId] : []))];

  const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  statsUrl.searchParams.set("part", "statistics"); statsUrl.searchParams.set("id", videoIds.join(",")); statsUrl.searchParams.set("key", env.YOUTUBE_API_KEY);
  const channelsUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelsUrl.searchParams.set("part", "snippet"); channelsUrl.searchParams.set("id", channelIds.join(",")); channelsUrl.searchParams.set("key", env.YOUTUBE_API_KEY);
  const [statsResponse, channelsResponse, commentResults] = await Promise.all([
    videoIds.length ? fetch(statsUrl, { signal: AbortSignal.timeout(15_000) }) : null,
    channelIds.length ? fetch(channelsUrl, { signal: AbortSignal.timeout(15_000) }) : null,
    Promise.allSettled(videoIds.slice(0, 10).map(async (videoId) => {
      const commentsUrl = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
      commentsUrl.searchParams.set("part", "snippet"); commentsUrl.searchParams.set("videoId", videoId);
      commentsUrl.searchParams.set("maxResults", "20"); commentsUrl.searchParams.set("order", "relevance");
      commentsUrl.searchParams.set("textFormat", "plainText"); commentsUrl.searchParams.set("key", env.YOUTUBE_API_KEY!);
      const commentsResponse = await fetch(commentsUrl, { signal: AbortSignal.timeout(12_000) });
      if (!commentsResponse.ok) return { videoId, comments: [] as string[] };
      const commentsPayload = await commentsResponse.json() as YouTubeCommentsPayload;
      const comments = (commentsPayload.items ?? []).flatMap((comment) => comment.snippet?.topLevelComment?.snippet?.textDisplay ? [comment.snippet.topLevelComment.snippet.textDisplay] : []);
      return { videoId, comments };
    })),
  ]);
  const statsPayload = statsResponse?.ok ? await statsResponse.json() as YouTubeStatsPayload : { items: [] };
  const channelsPayload = channelsResponse?.ok ? await channelsResponse.json() as YouTubeChannelsPayload : { items: [] };
  const stats = new Map((statsPayload.items ?? []).map((item) => [item.id, item.statistics]));
  const channelCountries = new Map((channelsPayload.items ?? []).map((item) => [item.id, item.snippet?.country]));
  const comments = new Map(commentResults.flatMap((result) => result.status === "fulfilled" ? [[result.value.videoId, result.value.comments] as const] : []));

  return items.flatMap((item) => {
    const videoId = item.id?.videoId;
    if (!videoId) return [];
    const videoStats = stats.get(videoId);
    const videoComments = comments.get(videoId) ?? [];
    const channelCountry = item.snippet?.channelId ? channelCountries.get(item.snippet.channelId) : undefined;
    const engagement = Number(videoStats?.viewCount ?? 0) + Number(videoStats?.likeCount ?? 0) + Number(videoStats?.commentCount ?? 0);
    return [{
      title: item.snippet?.title ?? "YouTube 视频", url: `https://www.youtube.com/watch?v=${videoId}`,
      source: item.snippet?.channelTitle ?? "YouTube 频道", platform: "YouTube" as const,
      sourceCountry: channelCountry ? countryCodes[channelCountry] ?? channelCountry : "地区未披露",
      language: "自动识别", publishedAt: isoDate(item.snippet?.publishedAt), engagement,
      discussionText: [item.snippet?.description ?? "", ...videoComments].join(" "), commentsAnalyzed: videoComments.length,
      parentUrl: "", relation: "",
    }];
  });
}
