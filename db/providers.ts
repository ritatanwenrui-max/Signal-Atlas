import { env } from "cloudflare:workers";

export type MonitoringCandidate = {
  title: string;
  url: string;
  source: string;
  platform: "网页新闻" | "Instagram" | "Facebook" | "TikTok" | "X" | "YouTube" | "Reddit";
  sourceCountry: string;
  language: string;
  publishedAt: string;
  engagement: number;
  discussionText: string;
  commentsAnalyzed: number;
  parentUrl: string;
  relation: string;
  author?: string;
  provider?: string;
  discoveredVia?: "global_discovery" | "free_crawler" | "official_api" | "monid_public_search" | "manual";
  socialMetrics?: {
    postId: string;
    authorId: string;
    authorUsername: string;
    authorName: string;
    followerCount: number;
    likes: number;
    comments: number;
    shares: number;
    views: number;
    plays: number;
    matchedTerms: string[];
  };
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
type MediaCloudStory = {
  id?: string; indexed_date?: string; publish_date?: string; language?: string; media_name?: string;
  media_url?: string; title?: string; url?: string;
};
type MediaCloudPayload = { stories?: MediaCloudStory[]; pagination_token?: string | null; detail?: string };
type NewsDataArticle = {
  article_id?: string; title?: string; link?: string; description?: string | null; content?: string | null;
  pubDate?: string; source_id?: string; source_name?: string; source_url?: string; language?: string;
  country?: string[]; creator?: string[] | null; sentiment?: string | null;
};
type NewsDataPayload = { status?: string; totalResults?: number; results?: NewsDataArticle[]; nextPage?: string | null; message?: string };
type WorldNewsArticle = {
  id?: number; title?: string; url?: string; text?: string; summary?: string; publish_date?: string;
  authors?: string[]; language?: string; source_country?: string; sentiment?: number; news_site?: string;
};
type WorldNewsPayload = { offset?: number; number?: number; available?: number; news?: WorldNewsArticle[]; message?: string };
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
  Taiwan: "台湾", "Hong Kong": "香港", Thailand: "泰国", "United States": "美国", China: "中国大陆",
  Japan: "日本", Singapore: "新加坡", Malaysia: "马来西亚", "South Korea": "韩国", "United Kingdom": "英国",
  Australia: "澳大利亚", Canada: "加拿大", Germany: "德国", France: "法国", Italy: "意大利", Spain: "西班牙",
  Russia: "俄罗斯", "Russian Federation": "俄罗斯",
  India: "印度", Indonesia: "印度尼西亚", Philippines: "菲律宾", Vietnam: "越南", Cambodia: "柬埔寨",
};

const languageNames: Record<string, string> = {
  English: "英文", Chinese: "中文", Thai: "泰语", Japanese: "日语", Korean: "韩语", Spanish: "西班牙语",
  French: "法语", German: "德语", Russian: "俄语", Italian: "意大利语", Portuguese: "葡萄牙语", Dutch: "荷兰语",
  Polish: "波兰语", Turkish: "土耳其语", Indonesian: "印度尼西亚语", Vietnamese: "越南语",
  en: "英文", zh: "中文", th: "泰语", ja: "日语", ko: "韩语", fr: "法语", de: "德语", ru: "俄语",
  it: "意大利语", es: "西班牙语", pt: "葡萄牙语", nl: "荷兰语", pl: "波兰语", tr: "土耳其语", id: "印度尼西亚语", vi: "越南语",
};

const countryCodes: Record<string, string> = {
  US: "美国", GB: "英国", TW: "台湾", HK: "香港", TH: "泰国", CN: "中国大陆", JP: "日本", KR: "韩国",
  SG: "新加坡", MY: "马来西亚", AU: "澳大利亚", CA: "加拿大", DE: "德国", FR: "法国", IN: "印度", RU: "俄罗斯",
};

const relationNames = { retweeted: "直接转发", quoted: "引用传播", replied_to: "回复讨论" } as const;

const domainCountryRules: Array<[RegExp, string]> = [
  [/(^|\.)163\.com$|(^|\.)126\.com$/i, "中国大陆"],
  [/\.tw$/i, "台湾"], [/\.hk$/i, "香港"], [/\.th$/i, "泰国"], [/\.jp$/i, "日本"], [/\.kr$/i, "韩国"],
  [/\.sg$/i, "新加坡"], [/\.my$/i, "马来西亚"], [/\.vn$/i, "越南"], [/\.ph$/i, "菲律宾"], [/\.id$/i, "印度尼西亚"],
  [/\.cn$/i, "中国大陆"], [/\.uk$/i, "英国"], [/\.au$/i, "澳大利亚"], [/\.ca$/i, "加拿大"], [/\.de$/i, "德国"],
  [/\.fr$/i, "法国"], [/\.it$/i, "意大利"], [/\.es$/i, "西班牙"], [/\.in$/i, "印度"], [/\.ru$/i, "俄罗斯"],
  [/^(tw\.|tw-)|\.com\.tw$|ettoday\.net$|ebc\.net\.tw$|taiwanhot\.net$/i, "台湾"],
  [/^(hk\.)|scmp\.com$|thestandard\.com\.hk$/i, "香港"], [/bangkokpost\.com$|nationthailand\.com$/i, "泰国"],
  [/straitstimes\.com$|channelnewsasia\.com$/i, "新加坡"], [/malaymail\.com$|thestar\.com\.my$/i, "马来西亚"],
  [/reuters\.com$|apnews\.com$|cnn\.com$|nytimes\.com$|washingtonpost\.com$/i, "美国"],
  [/bbc\.(com|co\.uk)$|theguardian\.com$|ft\.com$/i, "英国"],
];

const sourceCountryCues: Array<[RegExp, string]> = [
  [/(台灣|台湾|臺灣|taiwan|台北|臺北)/i, "台湾"], [/(香港|hong kong|港媒)/i, "香港"], [/(泰國|泰国|thailand|bangkok|ประเทศไทย)/i, "泰国"],
  [/(日本|japan|東京|tokyo)/i, "日本"], [/(韓國|韩国|south korea|seoul|서울)/i, "韩国"], [/(新加坡|singapore)/i, "新加坡"],
  [/(馬來西亞|马来西亚|malaysia)/i, "马来西亚"], [/(美國|美国|united states|\busa\b)/i, "美国"], [/(英國|英国|united kingdom|\buk\b)/i, "英国"],
  [/(中國|中国|mainland china|beijing|网易|網易|netease)/i, "中国大陆"], [/(澳大利亞|澳大利亚|australia)/i, "澳大利亚"], [/(加拿大|canada)/i, "加拿大"],
  [/(俄罗斯|俄羅斯|russia|russian federation|moscow|москва|россия)/i, "俄罗斯"],
];

const languageCountryFallback: Record<string, { country: string; confidence: number }> = {
  泰语: { country: "泰国", confidence: 76 }, 日语: { country: "日本", confidence: 76 }, 韩语: { country: "韩国", confidence: 76 },
  德语: { country: "德国", confidence: 72 }, 法语: { country: "法国", confidence: 62 }, 俄语: { country: "俄罗斯", confidence: 72 },
  意大利语: { country: "意大利", confidence: 70 }, 西班牙语: { country: "西班牙", confidence: 58 }, 葡萄牙语: { country: "葡萄牙", confidence: 58 },
  荷兰语: { country: "荷兰", confidence: 68 }, 波兰语: { country: "波兰", confidence: 70 }, 土耳其语: { country: "土耳其", confidence: 70 },
  越南语: { country: "越南", confidence: 70 }, 印度尼西亚语: { country: "印度尼西亚", confidence: 68 },
};

const latinLanguageCues: Array<[string, string[]]> = [
  ["德语", ["der", "die", "das", "und", "für", "mit", "nicht", "eine", "einer", "auf", "ist", "von", "zu"]],
  ["法语", ["le", "la", "les", "des", "une", "pour", "avec", "dans", "sur", "est", "pas", "qui", "que", "du"]],
  ["西班牙语", ["el", "la", "los", "las", "una", "para", "con", "del", "por", "que", "como", "más", "es"]],
  ["意大利语", ["il", "lo", "gli", "una", "per", "con", "della", "che", "come", "non", "sono"]],
  ["葡萄牙语", ["uma", "para", "com", "dos", "das", "que", "como", "não", "mais", "pelo"]],
  ["荷兰语", ["het", "een", "van", "voor", "met", "niet", "dat", "zijn", "als", "ook"]],
  ["波兰语", ["jest", "nie", "dla", "oraz", "przez", "który", "jak", "się", "jego", "tego"]],
  ["土耳其语", ["bir", "için", "ile", "olan", "olarak", "daha", "bu", "ve", "değil", "sonra"]],
  ["越南语", ["của", "và", "cho", "với", "trong", "không", "một", "được", "những", "này"]],
  ["印度尼西亚语", ["yang", "dan", "untuk", "dengan", "dari", "tidak", "ini", "pada", "adalah", "lebih"]],
];

function declaredLanguageName(value: string) {
  const trimmed = value.trim();
  const base = trimmed.toLowerCase().replaceAll("_", "-").split("-")[0];
  return languageNames[trimmed] ?? languageNames[base] ?? trimmed;
}

export function inferLanguage(text: string, declared = "") {
  const normalized = declaredLanguageName(declared);
  if (normalized && !["自动识别", "语言待确认", "未知", "und", "unknown"].includes(normalized.toLowerCase())) return { language: normalized, confidence: 98, method: "来源元数据" };
  if (/\p{Script=Thai}/u.test(text)) return { language: "泰语", confidence: 99, method: "文字脚本识别" };
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(text)) return { language: "日语", confidence: 99, method: "文字脚本识别" };
  if (/\p{Script=Hangul}/u.test(text)) return { language: "韩语", confidence: 99, method: "文字脚本识别" };
  if (/[іїєґ]/iu.test(text)) return { language: "乌克兰语", confidence: 94, method: "文字脚本与特征字识别" };
  if (/\p{Script=Cyrillic}/u.test(text)) return { language: "俄语", confidence: 82, method: "文字脚本识别" };
  if (/\p{Script=Han}/u.test(text)) {
    const traditional = (text.match(/[臺灣體機器這個為與會來開發聞報導產業國際]/g) ?? []).length;
    const simplified = (text.match(/[台湾体机器这个为与会来开发闻报道产业国际]/g) ?? []).length;
    return { language: traditional > simplified ? "繁体中文" : "简体中文", confidence: 84, method: "汉字字形识别" };
  }
  const words = text.toLocaleLowerCase().match(/[a-zà-öø-ÿąćęłńóśźżğışçđ]+/gu) ?? [];
  if (words.length >= 4) {
    const bag = new Set(words);
    const scored = latinLanguageCues.map(([language, cues]) => ({ language, score: cues.filter((cue) => bag.has(cue)).length }))
      .sort((a, b) => b.score - a.score);
    if (scored[0]?.score >= 2 && scored[0].score > (scored[1]?.score ?? 0)) {
      return { language: scored[0].language, confidence: Math.min(92, 62 + scored[0].score * 6), method: "常用词组合识别" };
    }
  }
  if (/[A-Za-z]{12,}/.test(text)) return { language: "英文", confidence: 78, method: "文字脚本识别" };
  return { language: "语言待确认", confidence: 25, method: "信息不足" };
}

export function inferSourceCountry(url: string, source: string, text: string, declared = "", declaredLanguage = "") {
  const normalized = countryNames[declared] ?? countryCodes[declared] ?? declared;
  if (normalized && !["地区未披露", "地区待确认", "未知", "unknown", "全球"].includes(normalized.toLowerCase())) return { country: normalized, confidence: 98, method: "来源元数据" };
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { /* keep empty */ }
  for (const [pattern, country] of domainCountryRules) if (pattern.test(host)) return { country, confidence: 95, method: "媒体域名 / 国家顶级域" };
  const context = `${source} ${text}`;
  for (const [pattern, country] of sourceCountryCues) if (pattern.test(context)) return { country, confidence: 82, method: "媒体名称与地域线索" };
  const language = inferLanguage(context, declaredLanguage).language;
  const fallback = languageCountryFallback[language];
  if (fallback) return { country: fallback.country, confidence: fallback.confidence, method: "语言主要使用国推断（可人工校正）" };
  if (language === "繁体中文") return { country: "华语地区", confidence: 45, method: "语言区域推断（待复核）" };
  return { country: "地区待确认", confidence: 20, method: "缺少可验证地域信号" };
}

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

function compactBooleanQuery(terms: string[], maxLength = 96) {
  const values: string[] = [];
  for (const raw of terms) {
    const term = raw.replaceAll('"', "").trim();
    if (!term) continue;
    const value = /\s|[^\x00-\x7F]/.test(term) ? `"${term}"` : term;
    if ([...values, value].join(" OR ").length > maxLength) break;
    values.push(value);
  }
  return values.join(" OR ");
}

function sourceNameFromUrl(url: string, fallback = "公开媒体") {
  if (fallback.trim()) return fallback.trim();
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "公开媒体"; }
}

export async function fetchEventRegistry(terms: string[], credential?: string): Promise<MonitoringCandidate[]> {
  const apiKey = credential ?? env.NEWSAPI_AI_KEY;
  if (!apiKey) return [];
  const fetchPage = async (articlesPage: number) => {
    const response = await fetch("https://eventregistry.org/api/v1/article/getArticles", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getArticles",
        keyword: terms.slice(0, 12),
        keywordOper: "or",
        keywordSearchMode: "phrase",
        keywordLoc: "title,body",
        articlesPage,
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
        apiKey,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new ProviderRequestError("NewsAPI.ai", response.status, retryAfterMs(response), `NewsAPI.ai HTTP ${response.status}`);
    const payload = await response.json() as EventRegistryPayload;
    if (payload.error) {
      const message = typeof payload.error === "string" ? payload.error : payload.error.message ?? "接口返回错误";
      throw new Error(`NewsAPI.ai: ${message}`);
    }
    return payload.articles?.results ?? [];
  };
  const firstPage = await fetchPage(1);
  const pageResults: EventRegistryArticle[][] = [firstPage];
  if (firstPage.length === 100) {
    const more = await Promise.allSettled([fetchPage(2), fetchPage(3)]);
    pageResults.push(...more.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
  }
  const uniqueArticles = new Map<string, EventRegistryArticle>();
  for (const item of pageResults.flat()) if (item.url && item.title) uniqueArticles.set(item.url, item);
  return [...uniqueArticles.values()].map((item) => {
    const sourceLocation = englishLabel(item.source?.location?.country?.label) ?? englishLabel(item.source?.location?.label);
    const engagement = Object.values(item.shares ?? {}).reduce<number>((total, value) => total + (Number(value) || 0), 0);
    return {
      title: item.title!.trim(),
      url: item.url!,
      source: item.source?.title ?? item.source?.uri ?? new URL(item.url!).hostname.replace(/^www\./, ""),
      platform: "网页新闻" as const,
      sourceCountry: sourceLocation ? countryNames[sourceLocation] ?? sourceLocation : "地区待确认",
      language: item.lang ? languageNames[item.lang] ?? item.lang : "语言待确认",
      publishedAt: isoDate(item.dateTime ?? [item.date, item.time].filter(Boolean).join("T")),
      engagement,
      discussionText: [item.body ?? "", item.sentiment == null ? "" : `provider-sentiment:${item.sentiment}`].join(" "),
      commentsAnalyzed: 0,
      parentUrl: item.originalArticle?.url ?? "",
      relation: item.originalArticle?.url ? "原始报道" : "",
      author: "",
      provider: "NewsAPI.ai",
      discoveredVia: "global_discovery",
    };
  });
}

export async function fetchMediaCloud(terms: string[], credential?: string): Promise<MonitoringCandidate[]> {
  const apiKey = credential ?? env.MEDIACLOUD_API_KEY;
  if (!apiKey) return [];
  const endpoint = new URL("https://search.mediacloud.org/api/search/story-list");
  endpoint.searchParams.set("q", compactBooleanQuery(terms, 180));
  endpoint.searchParams.set("start", new Date(Date.now() - 31 * 86400_000).toISOString().slice(0, 10));
  endpoint.searchParams.set("end", new Date().toISOString().slice(0, 10));
  endpoint.searchParams.set("platform", "onlinenews-mediacloud");
  endpoint.searchParams.set("sort_order", "desc");
  endpoint.searchParams.set("page_size", "100");
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json", Authorization: `Token ${apiKey}`, "User-Agent": "SignalAtlas/2.0 brand-monitoring" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new ProviderRequestError("Media Cloud", response.status, retryAfterMs(response), `Media Cloud HTTP ${response.status}`);
  const payload = await response.json() as MediaCloudPayload;
  return (payload.stories ?? []).filter((item) => item.url && item.title).map((item) => ({
    title: item.title!.trim(), url: item.url!, source: sourceNameFromUrl(item.url!, item.media_name ?? item.media_url ?? ""),
    platform: "网页新闻", sourceCountry: "地区待确认",
    language: item.language ? languageNames[item.language] ?? item.language : "语言待确认",
    publishedAt: isoDate(item.publish_date ?? item.indexed_date), engagement: 0, discussionText: "", commentsAnalyzed: 0,
    parentUrl: "", relation: "", author: "", provider: "Media Cloud", discoveredVia: "global_discovery",
  }));
}

export async function fetchNewsData(terms: string[], credential?: string): Promise<MonitoringCandidate[]> {
  const apiKey = credential ?? env.NEWSDATA_API_KEY;
  if (!apiKey) return [];
  const endpoint = new URL("https://newsdata.io/api/1/latest");
  endpoint.searchParams.set("apikey", apiKey);
  endpoint.searchParams.set("q", compactBooleanQuery(terms));
  endpoint.searchParams.set("timeframe", "48");
  endpoint.searchParams.set("size", "10");
  endpoint.searchParams.set("removeduplicate", "1");
  const response = await fetch(endpoint, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new ProviderRequestError("NewsData.io", response.status, retryAfterMs(response), `NewsData.io HTTP ${response.status}`);
  const payload = await response.json() as NewsDataPayload;
  if (payload.status === "error") throw new Error(`NewsData.io: ${payload.message || "接口返回错误"}`);
  return (payload.results ?? []).filter((item) => item.link && item.title).map((item) => {
    const declaredCountry = item.country?.[0] ?? "";
    return {
      title: item.title!.trim(), url: item.link!, source: sourceNameFromUrl(item.link!, item.source_name ?? item.source_id ?? ""),
      platform: "网页新闻" as const,
      sourceCountry: (countryCodes[declaredCountry.toUpperCase()] ?? countryNames[declaredCountry] ?? declaredCountry) || "地区待确认",
      language: item.language ? languageNames[item.language] ?? item.language : "语言待确认",
      publishedAt: isoDate(item.pubDate), engagement: 0,
      discussionText: [item.description ?? "", item.content ?? "", item.sentiment ? `provider-sentiment:${item.sentiment}` : ""].join(" "),
      commentsAnalyzed: 0, parentUrl: "", relation: "", author: item.creator?.join(", ") ?? "",
      provider: "NewsData.io", discoveredVia: "global_discovery" as const,
    };
  });
}

export async function fetchWorldNews(terms: string[], credential?: string): Promise<MonitoringCandidate[]> {
  const apiKey = credential ?? env.WORLD_NEWS_API_KEY;
  if (!apiKey) return [];
  const endpoint = new URL("https://api.worldnewsapi.com/search-news");
  endpoint.searchParams.set("text", compactBooleanQuery(terms));
  endpoint.searchParams.set("text-match-indexes", "title,content");
  endpoint.searchParams.set("earliest-publish-date", new Date(Date.now() - 31 * 86400_000).toISOString().replace("T", " ").slice(0, 19));
  endpoint.searchParams.set("sort", "publish-time");
  endpoint.searchParams.set("sort-direction", "DESC");
  endpoint.searchParams.set("number", "20");
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json", "x-api-key": apiKey }, signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new ProviderRequestError("World News API", response.status, retryAfterMs(response), `World News API HTTP ${response.status}`);
  const payload = await response.json() as WorldNewsPayload;
  return (payload.news ?? []).filter((item) => item.url && item.title).map((item) => ({
    title: item.title!.trim(), url: item.url!, source: sourceNameFromUrl(item.url!, item.news_site ?? ""), platform: "网页新闻",
    sourceCountry: item.source_country ? countryCodes[item.source_country.toUpperCase()] ?? countryNames[item.source_country] ?? item.source_country : "地区待确认",
    language: item.language ? languageNames[item.language] ?? item.language : "语言待确认", publishedAt: isoDate(item.publish_date), engagement: 0,
    discussionText: [item.summary ?? "", item.text ?? "", item.sentiment == null ? "" : `provider-sentiment:${item.sentiment}`].join(" "),
    commentsAnalyzed: 0, parentUrl: "", relation: "", author: item.authors?.join(", ") ?? "", provider: "World News API",
    discoveredVia: "global_discovery",
  }));
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
    platform: "网页新闻", sourceCountry: countryNames[item.sourcecountry ?? ""] ?? item.sourcecountry ?? "地区待确认",
    language: languageNames[item.language ?? ""] ?? item.language ?? "语言待确认", publishedAt: isoDate(item.seendate), engagement: 0,
    discussionText: "", commentsAnalyzed: 0, parentUrl: "", relation: "",
    author: "", provider: "GDELT", discoveredVia: "global_discovery",
  }));
}

export async function fetchX(terms: string[], credential?: string): Promise<MonitoringCandidate[]> {
  const bearerToken = credential ?? env.X_BEARER_TOKEN;
  if (!bearerToken) return [];
  const endpoint = new URL("https://api.x.com/2/tweets/search/recent");
  endpoint.searchParams.set("query", `(${terms.slice(0, 8).map((term) => `"${term.replaceAll('"', "")}"`).join(" OR ")})`);
  endpoint.searchParams.set("max_results", "100");
  endpoint.searchParams.set("sort_order", "recency");
  endpoint.searchParams.set("tweet.fields", "created_at,lang,public_metrics,geo,conversation_id,referenced_tweets");
  endpoint.searchParams.set("expansions", "author_id,geo.place_id,referenced_tweets.id,referenced_tweets.id.author_id");
  endpoint.searchParams.set("user.fields", "username,name,location");
  endpoint.searchParams.set("place.fields", "country,country_code,full_name");
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${bearerToken}` }, signal: AbortSignal.timeout(15_000) });
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
      platform: "X", sourceCountry: placeCountry ? countryNames[placeCountry] ?? placeCountry : "地区待确认", language: postLanguage ? languageNames[postLanguage] ?? postLanguage : "语言待确认",
      publishedAt: isoDate(post.created_at), engagement: Number(metrics.like_count ?? 0) + Number(metrics.reply_count ?? 0) + Number(metrics.retweet_count ?? 0) + Number(metrics.quote_count ?? 0),
      discussionText: "", commentsAnalyzed: 0, parentUrl: reference ? `https://x.com/i/status/${reference.id}` : "",
      relation: reference ? relationNames[reference.type] : "",
      author: user?.name ?? user?.username ?? "",
      provider: "X API",
      discoveredVia: "official_api",
    } as MonitoringCandidate;
  });
}

export async function fetchYouTube(terms: string[], credential?: string): Promise<MonitoringCandidate[]> {
  const apiKey = credential ?? env.YOUTUBE_API_KEY;
  if (!apiKey) return [];
  const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
  endpoint.searchParams.set("part", "snippet"); endpoint.searchParams.set("type", "video"); endpoint.searchParams.set("order", "date");
  endpoint.searchParams.set("maxResults", "50"); endpoint.searchParams.set("q", terms.slice(0, 8).join("|"));
  endpoint.searchParams.set("publishedAfter", new Date(Date.now() - 30 * 86400_000).toISOString()); endpoint.searchParams.set("key", apiKey);
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`YouTube API HTTP ${response.status}`);
  const payload = await response.json() as YouTubePayload;
  const items = (payload.items ?? []).filter((item) => item.id?.videoId);
  const videoIds = items.flatMap((item) => item.id?.videoId ? [item.id.videoId] : []);
  const channelIds = [...new Set(items.flatMap((item) => item.snippet?.channelId ? [item.snippet.channelId] : []))];

  const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  statsUrl.searchParams.set("part", "statistics"); statsUrl.searchParams.set("id", videoIds.join(",")); statsUrl.searchParams.set("key", apiKey);
  const channelsUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelsUrl.searchParams.set("part", "snippet"); channelsUrl.searchParams.set("id", channelIds.join(",")); channelsUrl.searchParams.set("key", apiKey);
  const [statsResponse, channelsResponse, commentResults] = await Promise.all([
    videoIds.length ? fetch(statsUrl, { signal: AbortSignal.timeout(15_000) }) : null,
    channelIds.length ? fetch(channelsUrl, { signal: AbortSignal.timeout(15_000) }) : null,
    Promise.allSettled(videoIds.slice(0, 10).map(async (videoId) => {
      const commentsUrl = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
      commentsUrl.searchParams.set("part", "snippet"); commentsUrl.searchParams.set("videoId", videoId);
      commentsUrl.searchParams.set("maxResults", "20"); commentsUrl.searchParams.set("order", "relevance");
      commentsUrl.searchParams.set("textFormat", "plainText"); commentsUrl.searchParams.set("key", apiKey);
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
      sourceCountry: channelCountry ? countryCodes[channelCountry] ?? channelCountry : "地区待确认",
      language: "自动识别", publishedAt: isoDate(item.snippet?.publishedAt), engagement,
      discussionText: [item.snippet?.description ?? "", ...videoComments].join(" "), commentsAnalyzed: videoComments.length,
      parentUrl: "", relation: "",
      author: item.snippet?.channelTitle ?? "",
      provider: "YouTube API",
      discoveredVia: "official_api",
    }];
  });
}
