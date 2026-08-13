import { env } from "cloudflare:workers";
import { ensureDatabase, getActiveBrandForUser } from "../../../db/repository";
import { meaningfulTokens } from "../../../db/text-analysis";
import { prepareWorkspaceForUser } from "../../../db/workspaces";
import { getChatGPTUser } from "../../chatgpt-auth";

export const runtime = "edge";

type Keyword = { word?: string; count?: number };

function integerParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录后查看评论舆情" }, { status: 401 });
  await ensureDatabase();
  const db = env.DB;
  await prepareWorkspaceForUser(db, user);
  const brand = await getActiveBrandForUser(db, user.userId);
  const brandId = Number(brand?.id ?? 0);
  if (!brandId) return Response.json({ error: "请先创建品牌监测档案" }, { status: 400 });

  const url = new URL(request.url);
  const page = integerParam(url.searchParams.get("page"), 1, 1, 10_000);
  const pageSize = 40;
  const range = ["1", "7", "30", "0"].includes(url.searchParams.get("range") ?? "") ? url.searchParams.get("range")! : "30";
  const sentiment = ["正面", "中性", "负面", "混合"].includes(url.searchParams.get("sentiment") ?? "") ? url.searchParams.get("sentiment")! : "";
  const platform = ["网页新闻", "Instagram", "Facebook", "TikTok", "X", "YouTube"].includes(url.searchParams.get("platform") ?? "") ? url.searchParams.get("platform")! : "";
  const sort = ["newest", "liked", "risk"].includes(url.searchParams.get("sort") ?? "") ? url.searchParams.get("sort")! : "newest";
  const query = (url.searchParams.get("query") ?? "").trim().slice(0, 120);
  const postId = integerParam(url.searchParams.get("post"), 0, 0, Number.MAX_SAFE_INTEGER);

  const clauses = ["c.brand_id = ?"];
  const binds: Array<string | number> = [brandId];
  if (range !== "0") clauses.push(`datetime(COALESCE(NULLIF(c.published_at, ''), c.collected_at)) >= datetime('now', '-${Number(range)} days')`);
  if (sentiment) { clauses.push("c.sentiment = ?"); binds.push(sentiment); }
  if (platform) { clauses.push("c.platform = ?"); binds.push(platform); }
  if (postId) { clauses.push("c.mention_id = ?"); binds.push(postId); }
  if (query) {
    clauses.push("(c.content LIKE ? OR c.author_username LIKE ? OR c.author_name LIKE ? OR m.title LIKE ?)");
    const needle = `%${query}%`;
    binds.push(needle, needle, needle, needle);
  }
  const where = clauses.join(" AND ");
  const ordering = sort === "liked" ? "c.likes DESC, c.published_at DESC" : sort === "risk" ? "c.sentiment_score ASC, c.likes DESC, c.published_at DESC" : "c.published_at DESC, c.id DESC";

  const summarySql = `SELECT COUNT(*) AS total, COUNT(DISTINCT COALESCE(NULLIF(c.author_id, ''), NULLIF(c.author_username, ''))) AS authors,
      COALESCE(SUM(c.likes), 0) AS likes, COALESCE(SUM(c.replies), 0) AS replies,
      SUM(CASE WHEN c.sentiment = '正面' THEN 1 ELSE 0 END) AS positive,
      SUM(CASE WHEN c.sentiment = '中性' THEN 1 ELSE 0 END) AS neutral,
      SUM(CASE WHEN c.sentiment = '负面' THEN 1 ELSE 0 END) AS negative,
      SUM(CASE WHEN c.sentiment = '混合' THEN 1 ELSE 0 END) AS mixed,
      COALESCE(ROUND(AVG(c.sentiment_score)), 0) AS average_score
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id WHERE ${where}`;
  const commentsSql = `SELECT c.*, m.title AS post_title, m.url AS post_url, m.source AS post_source,
      metrics.author_username AS post_author, metrics.follower_count AS post_author_followers
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
    LEFT JOIN social_post_metrics metrics ON metrics.mention_id = c.mention_id
    WHERE ${where} ORDER BY ${ordering} LIMIT ? OFFSET ?`;
  const sentimentSql = `SELECT c.sentiment AS label, COUNT(*) AS count FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
    WHERE ${where} GROUP BY c.sentiment ORDER BY count DESC`;
  const emotionSql = `SELECT c.emotion AS label, COUNT(*) AS count FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
    WHERE ${where} GROUP BY c.emotion ORDER BY count DESC`;
  const timelineSql = `SELECT substr(COALESCE(NULLIF(c.published_at, ''), c.collected_at), 1, 10) AS date, COUNT(*) AS total,
      SUM(CASE WHEN c.sentiment = '负面' THEN 1 ELSE 0 END) AS negative,
      SUM(CASE WHEN c.sentiment = '正面' THEN 1 ELSE 0 END) AS positive
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id WHERE ${where}
    GROUP BY date ORDER BY date ASC`;
  const topicSql = `SELECT c.topic AS topic, COUNT(*) AS count,
      SUM(CASE WHEN c.sentiment = '负面' THEN 1 ELSE 0 END) AS negative
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id WHERE ${where}
    GROUP BY c.topic ORDER BY count DESC LIMIT 10`;
  const topPostsSql = `SELECT c.mention_id, m.title, m.url, m.source, COUNT(*) AS comments,
      SUM(CASE WHEN c.sentiment = '负面' THEN 1 ELSE 0 END) AS negative, COALESCE(SUM(c.likes), 0) AS likes
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id WHERE ${where}
    GROUP BY c.mention_id, m.title, m.url, m.source ORDER BY comments DESC, likes DESC LIMIT 8`;
  const topAuthorsSql = `SELECT c.author_id, c.author_username, c.author_name, MAX(c.is_verified) AS is_verified,
      COUNT(*) AS comments, COALESCE(SUM(c.likes), 0) AS likes,
      SUM(CASE WHEN c.sentiment = '负面' THEN 1 ELSE 0 END) AS negative
    FROM mention_comments c JOIN mentions m ON m.id = c.mention_id WHERE ${where}
    GROUP BY c.author_id, c.author_username, c.author_name ORDER BY comments DESC, likes DESC LIMIT 8`;
  const keywordSql = `SELECT c.keywords FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
    WHERE ${where} ORDER BY c.id DESC LIMIT 5000`;

  const [summary, comments, sentimentRows, emotionRows, timeline, topics, topPosts, topAuthors, keywordRows, targets, targetTotals, riskComments] = await Promise.all([
    db.prepare(summarySql).bind(...binds).first<Record<string, number>>(),
    db.prepare(commentsSql).bind(...binds, pageSize, (page - 1) * pageSize).all<Record<string, unknown>>(),
    db.prepare(sentimentSql).bind(...binds).all<Record<string, unknown>>(),
    db.prepare(emotionSql).bind(...binds).all<Record<string, unknown>>(),
    db.prepare(timelineSql).bind(...binds).all<Record<string, unknown>>(),
    db.prepare(topicSql).bind(...binds).all<Record<string, unknown>>(),
    db.prepare(topPostsSql).bind(...binds).all<Record<string, unknown>>(),
    db.prepare(topAuthorsSql).bind(...binds).all<Record<string, unknown>>(),
    db.prepare(keywordSql).bind(...binds).all<{ keywords: string }>(),
    db.prepare(`SELECT target.*, mentions.title AS post_title, mentions.source AS post_source, mentions.url AS mention_url
      FROM social_comment_targets target JOIN mentions ON mentions.id = target.mention_id
      WHERE target.brand_id = ? ORDER BY CASE target.status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 WHEN 'collecting' THEN 2 WHEN 'error' THEN 3 ELSE 4 END,
      target.updated_at DESC LIMIT 20`).bind(brandId).all<Record<string, unknown>>(),
    db.prepare(`SELECT COALESCE(SUM(reported_count), 0) AS reported, COALESCE(SUM(collected_count), 0) AS collected
      FROM social_comment_targets WHERE brand_id = ?`).bind(brandId).first<{ reported: number; collected: number }>(),
    db.prepare(`SELECT c.*, m.title AS post_title, m.url AS post_url FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
      WHERE c.brand_id = ? AND c.sentiment IN ('负面','混合')
      ORDER BY c.sentiment_score ASC, c.likes DESC, c.published_at DESC LIMIT 8`).bind(brandId).all<Record<string, unknown>>(),
  ]);

  const wordCounts = new Map<string, number>();
  const brandTerms = [String(brand?.name ?? ""), ...String(brand?.aliases ?? "").split(/[\n,，]/)].filter(Boolean);
  for (const row of keywordRows.results) {
    try {
      for (const item of JSON.parse(row.keywords || "[]") as Keyword[]) {
        const word = String(item.word ?? "").trim();
        const count = Number(item.count ?? 0);
        if (!word || count <= 0) continue;
        for (const token of meaningfulTokens(word, brandTerms)) wordCounts.set(token, (wordCounts.get(token) ?? 0) + count);
      }
    } catch { /* Ignore legacy malformed keyword JSON. */ }
  }
  const words = [...wordCounts.entries()].map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)).slice(0, 45);
  const total = Number(summary?.total ?? 0);
  const reported = Number(targetTotals?.reported ?? 0);
  const collected = Number(targetTotals?.collected ?? 0);
  const safeSummary = {
    total,
    authors: Number(summary?.authors ?? 0),
    likes: Number(summary?.likes ?? 0),
    replies: Number(summary?.replies ?? 0),
    positive: Number(summary?.positive ?? 0),
    neutral: Number(summary?.neutral ?? 0),
    negative: Number(summary?.negative ?? 0),
    mixed: Number(summary?.mixed ?? 0),
    average_score: Number(summary?.average_score ?? 0),
  };

  return Response.json({
    summary: { ...safeSummary, reported, collected, coverage: reported ? Math.min(100, Math.round(collected / reported * 100)) : total ? 100 : 0 },
    sentiment: sentimentRows.results,
    emotions: emotionRows.results,
    timeline: timeline.results,
    topics: topics.results,
    words,
    topPosts: topPosts.results,
    topAuthors: topAuthors.results,
    targets: targets.results,
    riskComments: riskComments.results,
    comments: comments.results,
    pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
    filters: { range, sentiment, platform, query, postId, sort },
  });
}
