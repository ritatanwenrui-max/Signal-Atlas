export type NewsProviderPlan = {
  provider: string;
  intervalMs: number;
  dailyLimit: number;
  unitsPerRun: number;
  scheduleLabel: string;
  quotaLabel: string;
  rationale: string;
};

const HOUR = 3600_000;

export const NEWS_PROVIDER_PLANS: Record<string, NewsProviderPlan> = {
  "NewsAPI.ai": {
    provider: "NewsAPI.ai", intervalMs: 6 * HOUR, dailyLimit: 48, unitsPerRun: 3,
    scheduleLabel: "每 6 小时", quotaLabel: "48 次请求 / 日安全预算",
    rationale: "每轮最多翻 3 页；保留月度额度余量用于人工补扫与失败重试",
  },
  "Media Cloud": {
    provider: "Media Cloud", intervalMs: 4 * HOUR, dailyLimit: 36, unitsPerRun: 1,
    scheduleLabel: "每 4 小时", quotaLabel: "36 次检索 / 日安全预算",
    rationale: "低于每周约 300 次搜索的公开账户经验上限，并遵守每分钟 2 次请求",
  },
  "NewsData.io": {
    provider: "NewsData.io", intervalMs: 2 * HOUR, dailyLimit: 160, unitsPerRun: 1,
    scheduleLabel: "每 2 小时", quotaLabel: "160 credits / 日自动预算",
    rationale: "免费额度 200 credits / 日，预留 40 credits 给分页、补扫与人工触发",
  },
  "World News API": {
    provider: "World News API", intervalMs: 6 * HOUR, dailyLimit: 36, unitsPerRun: 2,
    scheduleLabel: "每 6 小时", quotaLabel: "36 points / 日自动预算",
    rationale: "免费额度 50 points / 日；按每次搜索及返回结果预扣 2 points，保留 14 points 余量",
  },
  "ScrapeCreators": {
    provider: "ScrapeCreators", intervalMs: 3 * HOUR, dailyLimit: 20, unitsPerRun: 2,
    scheduleLabel: "每 3 小时", quotaLabel: "20 credits / 日站内安全预算",
    rationale: "每轮各运行一次 Instagram Reels 与 TikTok 关键词搜索；保留 credits 给补扫与重试",
  },
  "Brave Search": {
    provider: "Brave Search", intervalMs: 6 * HOUR, dailyLimit: 16, unitsPerRun: 3,
    scheduleLabel: "每 6 小时", quotaLabel: "16 次搜索 / 日站内安全预算",
    rationale: "每轮按三组社交平台域名检索；保留免费月度 credits 给人工补扫",
  },
  "Apify": {
    provider: "Apify", intervalMs: 12 * HOUR, dailyLimit: 2, unitsPerRun: 1,
    scheduleLabel: "每 12 小时", quotaLabel: "2 个补全批次 / 日站内安全预算",
    rationale: "每天最多两次 Google 索引补全，避免 Actor 计算资源被连续消耗",
  },
  "Bright Data": {
    provider: "Bright Data", intervalMs: 12 * HOUR, dailyLimit: 2, unitsPerRun: 1,
    scheduleLabel: "每 12 小时", quotaLabel: "2 个 SERP 批次 / 日站内安全预算",
    rationale: "作为第二搜索索引补收未被其他来源发现的公开社媒页面",
  },
  "The News API": {
    provider: "The News API", intervalMs: 6 * HOUR, dailyLimit: 20, unitsPerRun: 1,
    scheduleLabel: "每 6 小时", quotaLabel: "20 次请求 / 日站内安全预算",
    rationale: "免费方案通常为每日 100 次；低频补全并保留大部分额度给分页、重试和人工补扫",
  },
  "GNews": {
    provider: "GNews", intervalMs: 6 * HOUR, dailyLimit: 16, unitsPerRun: 1,
    scheduleLabel: "每 6 小时", quotaLabel: "16 次请求 / 日站内安全预算",
    rationale: "免费方案通常为每日 100 次且内容有延迟；作为补充来源，不承担实时告警",
  },
  "NewsAPI.org": {
    provider: "NewsAPI.org", intervalMs: 6 * HOUR, dailyLimit: 16, unitsPerRun: 1,
    scheduleLabel: "每 6 小时", quotaLabel: "16 次请求 / 日站内安全预算",
    rationale: "开发者方案通常为每日 100 次且不可直接用于商业生产；仅在符合许可时启用",
  },
  "mediastack": {
    provider: "mediastack", intervalMs: 24 * HOUR, dailyLimit: 3, unitsPerRun: 1,
    scheduleLabel: "每日 1 次", quotaLabel: "3 次请求 / 日站内安全预算",
    rationale: "免费方案月度额度较小；每日低频补档并预留月度余量",
  },
  "Guardian Open Platform": {
    provider: "Guardian Open Platform", intervalMs: 4 * HOUR, dailyLimit: 24, unitsPerRun: 1,
    scheduleLabel: "每 4 小时", quotaLabel: "24 次请求 / 日站内安全预算",
    rationale: "开发者密钥仅适合非商业用途；只检索 Guardian 内容并保留大量请求余量",
  },
  "Mastodon": {
    provider: "Mastodon", intervalMs: 6 * HOUR, dailyLimit: 12, unitsPerRun: 1,
    scheduleLabel: "每 6 小时", quotaLabel: "12 次搜索 / 日站内安全预算",
    rationale: "每个实例的全文索引范围不同；使用团队指定实例和只读令牌进行低频检索",
  },
  "Bluesky Search": {
    provider: "Bluesky Search", intervalMs: 6 * HOUR, dailyLimit: 12, unitsPerRun: 1,
    scheduleLabel: "每 6 小时", quotaLabel: "12 次公开搜索 / 日站内安全预算",
    rationale: "公开免密钥接口；低频运行并遵守服务端返回的限流信息",
  },
  "Hacker News": {
    provider: "Hacker News", intervalMs: 6 * HOUR, dailyLimit: 12, unitsPerRun: 1,
    scheduleLabel: "每 6 小时", quotaLabel: "12 次公开搜索 / 日站内安全预算",
    rationale: "公开免密钥搜索；用于补充技术社区中的品牌讨论",
  },
  "WordPress.com Reader": {
    provider: "WordPress.com Reader", intervalMs: 6 * HOUR, dailyLimit: 12, unitsPerRun: 3,
    scheduleLabel: "每 6 小时", quotaLabel: "12 次标签检索 / 日站内安全预算",
    rationale: "免注册、免密钥；每轮检索最多 3 个品牌与产品标签，覆盖公开 WordPress.com 与已连接 Jetpack 博客",
  },
  "DEV / Forem Blogs": {
    provider: "DEV / Forem Blogs", intervalMs: 6 * HOUR, dailyLimit: 4, unitsPerRun: 1,
    scheduleLabel: "每 6 小时", quotaLabel: "4 次关键词检索 / 日站内安全预算",
    rationale: "公开免密钥关键词搜索；补充 DEV 与 Forem 技术博客、开发者文章和产品讨论",
  },
  "Tumblr Tagged": {
    provider: "Tumblr Tagged", intervalMs: 6 * HOUR, dailyLimit: 12, unitsPerRun: 3,
    scheduleLabel: "每 6 小时", quotaLabel: "12 次标签检索 / 日站内安全预算",
    rationale: "免费开发者密钥；每轮最多检索 3 个标签，补充多语言创作者博客与转载内容",
  },
};

export function quotaDay(now = new Date()) { return now.toISOString().slice(0, 10); }

export function nextQuotaReset(now = new Date()) {
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return reset.toISOString();
}

export async function reserveNewsProviderQuota(db: D1Database, credentialOwnerUserId: string, provider: string) {
  const plan = NEWS_PROVIDER_PLANS[provider];
  if (!plan) return { allowed: true, used: 0, remaining: Number.POSITIVE_INFINITY, resetAt: "" };
  const usageDate = quotaDay();
  const now = new Date().toISOString();
  const result = await db.prepare(`INSERT INTO provider_daily_usage
    (credential_owner_user_id, provider, usage_date, units_used, request_count, updated_at)
    VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT(credential_owner_user_id, provider, usage_date) DO UPDATE SET
      units_used = provider_daily_usage.units_used + excluded.units_used,
      request_count = provider_daily_usage.request_count + 1,
      updated_at = excluded.updated_at
    WHERE provider_daily_usage.units_used + excluded.units_used <= ?`)
    .bind(credentialOwnerUserId, provider, usageDate, plan.unitsPerRun, now, plan.dailyLimit).run();
  const row = await db.prepare(`SELECT units_used, request_count FROM provider_daily_usage
    WHERE credential_owner_user_id = ? AND provider = ? AND usage_date = ?`)
    .bind(credentialOwnerUserId, provider, usageDate).first<{ units_used: number; request_count: number }>();
  const used = Number(row?.units_used ?? 0);
  return { allowed: Number(result.meta.changes ?? 0) > 0, used, remaining: Math.max(0, plan.dailyLimit - used), resetAt: nextQuotaReset() };
}

export async function getNewsProviderQuotaSnapshots(db: D1Database, credentialOwnerUserId: string) {
  const usageDate = quotaDay();
  const rows = await db.prepare(`SELECT provider, units_used, request_count FROM provider_daily_usage
    WHERE credential_owner_user_id = ? AND usage_date = ?`)
    .bind(credentialOwnerUserId, usageDate).all<{ provider: string; units_used: number; request_count: number }>();
  const usage = new Map(rows.results.map((row) => [row.provider, row]));
  return Object.values(NEWS_PROVIDER_PLANS).map((plan) => ({
    provider: plan.provider,
    used: Number(usage.get(plan.provider)?.units_used ?? 0),
    requestCount: Number(usage.get(plan.provider)?.request_count ?? 0),
    limit: plan.dailyLimit,
    remaining: Math.max(0, plan.dailyLimit - Number(usage.get(plan.provider)?.units_used ?? 0)),
    resetAt: nextQuotaReset(),
    scheduleLabel: plan.scheduleLabel,
    quotaLabel: plan.quotaLabel,
    rationale: plan.rationale,
  }));
}
