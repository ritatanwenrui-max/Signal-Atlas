import { env } from "cloudflare:workers";

type TranslationKind = "mention" | "comment";
type TranslationRow = { kind: TranslationKind; id: number; source: string; language: string; attempts: number };
type TranslationResult = { text: string; provider: string; detectedLanguage: string };

const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";
const MAX_CANDIDATES_PER_CYCLE = 40;
const MAX_REMOTE_ITEMS_PER_CYCLE = 2;
const MAX_SEGMENT_BYTES = 450;

const languageCodes: Record<string, string> = {
  "泰语": "th", thai: "th", th: "th",
  "日语": "ja", japanese: "ja", ja: "ja",
  "韩语": "ko", korean: "ko", ko: "ko",
  "西班牙语": "es", spanish: "es", es: "es",
  "法语": "fr", french: "fr", fr: "fr",
  "德语": "de", german: "de", de: "de",
  "越南语": "vi", vietnamese: "vi", vi: "vi",
  "意大利语": "it", italian: "it", it: "it",
  "葡萄牙语": "pt", portuguese: "pt", pt: "pt",
  "印度尼西亚语": "id", indonesian: "id", id: "id",
  "马来语": "ms", malay: "ms", ms: "ms",
  "阿拉伯语": "ar", arabic: "ar", ar: "ar",
  "俄语": "ru", russian: "ru", ru: "ru",
};

function normalizedLanguage(value: string) {
  return value.trim().toLocaleLowerCase().replaceAll("_", "-");
}

export function translationNotNeeded(language: string, source: string) {
  const normalized = normalizedLanguage(language);
  if (language.includes("中文") || ["zh", "zh-cn", "zh-tw", "zh-hk", "zh-hans", "zh-hant", "chinese"].includes(normalized)) return true;
  if (["英文", "英语", "en", "en-us", "en-gb", "english"].includes(normalized)) return true;
  if (/\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}|\p{Script=Thai}/u.test(source)) return false;
  const han = (source.match(/\p{Script=Han}/gu) ?? []).length;
  const latin = (source.match(/[A-Za-z]/g) ?? []).length;
  if (han >= 4 && han >= latin * 0.35) return true;
  if (!han && latin >= 24) {
    const englishSignals = (source.toLocaleLowerCase().match(/\b(the|and|for|with|from|this|that|has|have|will|was|were|are|company|news|post|about|into|its|their)\b/g) ?? []).length;
    if (englishSignals >= 2) return true;
  }
  return false;
}

function sourceLanguageCode(language: string, source: string) {
  const normalized = normalizedLanguage(language);
  if (languageCodes[normalized]) return languageCodes[normalized];
  if (/\p{Script=Thai}/u.test(source)) return "th";
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(source)) return "ja";
  if (/\p{Script=Hangul}/u.test(source)) return "ko";
  return "Autodetect";
}

function sourceHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function truncateByBytes(value: string) {
  const encoder = new TextEncoder();
  let current = "";
  for (const character of value) {
    const candidate = current + character;
    if (encoder.encode(candidate).length > MAX_SEGMENT_BYTES) break;
    current = candidate;
  }
  return current.trim();
}

function decodeEntities(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

async function translateWithMyMemory(source: string, language: string): Promise<TranslationResult> {
  const sourceLanguage = sourceLanguageCode(language, source);
  const segment = truncateByBytes(source);
  const url = new URL(MYMEMORY_ENDPOINT);
  url.searchParams.set("q", segment);
  url.searchParams.set("langpair", `${sourceLanguage}|en`);
  url.searchParams.set("mt", "1");
  if (env.TRANSLATION_CONTACT_EMAIL) url.searchParams.set("de", env.TRANSLATION_CONTACT_EMAIL);
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6_000) });
  const payload = await response.json().catch(() => ({})) as {
    responseData?: { translatedText?: string; detectedLanguage?: string };
    responseStatus?: number; responseDetails?: string; quotaFinished?: boolean;
  };
  const status = Number(payload.responseStatus ?? response.status);
  if (!response.ok || status >= 400 || payload.quotaFinished) {
    throw new Error(payload.quotaFinished ? "独立翻译服务当日免费额度已用完" : payload.responseDetails || `独立翻译服务 HTTP ${status}`);
  }
  const text = decodeEntities(String(payload.responseData?.translatedText ?? "").trim());
  if (!text) throw new Error("独立翻译服务未返回译文");
  return { text, provider: "MyMemory", detectedLanguage: String(payload.responseData?.detectedLanguage ?? sourceLanguage) };
}

async function translateWithLibreTranslate(source: string): Promise<TranslationResult> {
  const endpoint = String(env.LIBRETRANSLATE_URL ?? "").trim();
  if (!endpoint) throw new Error("LibreTranslate 未配置");
  const response = await fetch(new URL("/translate", endpoint), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ q: source, source: "auto", target: "en", format: "text", api_key: env.LIBRETRANSLATE_API_KEY || undefined }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({})) as { translatedText?: string; detectedLanguage?: { language?: string }; error?: string };
  if (!response.ok || !payload.translatedText?.trim()) throw new Error(payload.error || `LibreTranslate HTTP ${response.status}`);
  return { text: payload.translatedText.trim(), provider: "LibreTranslate", detectedLanguage: payload.detectedLanguage?.language ?? "" };
}

async function translate(source: string, language: string) {
  if (env.LIBRETRANSLATE_URL) {
    try { return await translateWithLibreTranslate(source); }
    catch { /* The keyless provider below remains available as a fallback. */ }
  }
  return translateWithMyMemory(source, language);
}

function tableFor(kind: TranslationKind) {
  return kind === "mention" ? "mentions" : "mention_comments";
}

function retryAt(attempts: number) {
  const delays = [15 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000];
  return new Date(Date.now() + delays[Math.min(delays.length - 1, Math.max(0, attempts - 1))]).toISOString();
}

function isDailyQuotaError(message: string) {
  return /免费额度已用完|USED ALL AVAILABLE FREE TRANSLATIONS|USAGELIMITS/i.test(message);
}

async function updateSkipped(db: D1Database, brandId: number, item: TranslationRow) {
  await db.prepare(`UPDATE ${tableFor(item.kind)} SET translation_en = '', translation_status = 'skipped',
    translation_provider = '', translation_source_hash = ?, translation_error = '', translation_next_retry_at = '', translated_at = ?
    WHERE brand_id = ? AND id = ?`).bind(sourceHash(item.source), new Date().toISOString(), brandId, item.id).run();
}

async function processItem(db: D1Database, brandId: number, item: TranslationRow) {
  if (translationNotNeeded(item.language, item.source)) {
    await updateSkipped(db, brandId, item);
    return "skipped" as const;
  }
  const table = tableFor(item.kind);
  const hash = sourceHash(item.source);
  const attempt = item.attempts + 1;
  await db.prepare(`UPDATE ${table} SET translation_status = 'translating', translation_provider = 'Independent translator',
    translation_error = '', translation_attempts = ?, translation_next_retry_at = '' WHERE brand_id = ? AND id = ?`)
    .bind(attempt, brandId, item.id).run();
  try {
    const result = await translate(item.source, item.language);
    if (["en", "en-us", "en-gb", "zh", "zh-cn", "zh-tw", "zh-hk"].includes(normalizedLanguage(result.detectedLanguage))) {
      await updateSkipped(db, brandId, item);
      return "skipped" as const;
    }
    await db.prepare(`UPDATE ${table} SET translation_en = ?, translation_status = 'translated', translation_provider = ?,
      translation_source_hash = ?, translation_error = '', translation_next_retry_at = '', translated_at = ?
      WHERE brand_id = ? AND id = ?`).bind(result.text, result.provider, hash, new Date().toISOString(), brandId, item.id).run();
    return "translated" as const;
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "独立翻译失败";
    const dailyQuota = isDailyQuotaError(rawMessage);
    const message = (dailyQuota ? "独立翻译服务当日免费额度已用完" : rawMessage).slice(0, 500);
    const nextRetryAt = dailyQuota ? new Date(Date.now() + 24 * 60 * 60_000).toISOString() : retryAt(attempt);
    await db.prepare(`UPDATE ${table} SET translation_status = 'error', translation_provider = 'Independent translator',
      translation_error = ?, translation_next_retry_at = ?, translated_at = ? WHERE brand_id = ? AND id = ?`)
      .bind(message, nextRetryAt, new Date().toISOString(), brandId, item.id).run();
    return "error" as const;
  }
}

export async function runTranslationCycle(db: D1Database, brandId: number) {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE monid_jobs SET status = 'STOPPED', error = '翻译已迁移到独立队列', completed_at = ?, updated_at = ?
      WHERE brand_id = ? AND stage = 'translation' AND status IN ('CREATED','QUEUED','PENDING','READY','RUNNING')`).bind(now, now, brandId),
    db.prepare(`UPDATE mentions SET translation_status = 'pending', translation_provider = '', translation_error = '', translation_next_retry_at = ''
      WHERE brand_id = ? AND translation_status IN ('translating','blocked')`).bind(brandId),
    db.prepare(`UPDATE mention_comments SET translation_status = 'pending', translation_provider = '', translation_error = '', translation_next_retry_at = ''
      WHERE brand_id = ? AND translation_status IN ('translating','blocked')`).bind(brandId),
  ]);
  const [mentions, comments] = await Promise.all([
    db.prepare(`SELECT id, title, excerpt, summary, language, translation_attempts AS attempts FROM mentions WHERE brand_id = ?
      AND (translation_status = 'pending' OR (translation_status = 'error' AND (translation_next_retry_at = '' OR translation_next_retry_at <= ?)))
      ORDER BY published_at DESC, id DESC LIMIT 24`).bind(brandId, now)
      .all<{ id: number; title: string; excerpt: string; summary: string; language: string; attempts: number }>(),
    db.prepare(`SELECT id, content, language, translation_attempts AS attempts FROM mention_comments WHERE brand_id = ?
      AND (translation_status = 'pending' OR (translation_status = 'error' AND (translation_next_retry_at = '' OR translation_next_retry_at <= ?)))
      ORDER BY COALESCE(NULLIF(published_at, ''), collected_at) DESC, id DESC LIMIT 24`).bind(brandId, now)
      .all<{ id: number; content: string; language: string; attempts: number }>(),
  ]);
  const queue: TranslationRow[] = [
    ...mentions.results.map((row) => ({ kind: "mention" as const, id: row.id,
      source: [row.title, row.excerpt || row.summary].filter(Boolean).join("\n").trim(), language: row.language, attempts: Number(row.attempts ?? 0) })),
    ...comments.results.map((row) => ({ kind: "comment" as const, id: row.id, source: row.content.trim(), language: row.language, attempts: Number(row.attempts ?? 0) })),
  ].filter((item) => item.source).slice(0, MAX_CANDIDATES_PER_CYCLE);
  const skipped = queue.filter((item) => translationNotNeeded(item.language, item.source));
  const remote = queue.filter((item) => !translationNotNeeded(item.language, item.source)).slice(0, MAX_REMOTE_ITEMS_PER_CYCLE);
  const summary = { queued: skipped.length + remote.length, translated: 0, skipped: 0, errors: 0 };
  for (const item of skipped) {
    await updateSkipped(db, brandId, item);
    summary.skipped += 1;
  }
  const remoteResults = await Promise.all(remote.map((item) => processItem(db, brandId, item)));
  for (const result of remoteResults) {
    if (result === "translated") summary.translated += 1;
    else if (result === "skipped") summary.skipped += 1;
    else summary.errors += 1;
  }
  return summary;
}
