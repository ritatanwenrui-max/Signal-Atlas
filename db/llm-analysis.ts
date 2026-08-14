import { loadConnectorCredential } from "./credentials";

export const ANALYSIS_MODEL = "gpt-5.6-luna";
export const REPORT_MODEL = "gpt-5.6-sol";

type Candidate = {
  kind: "mention" | "comment";
  id: number;
  text: string;
  ruleSentiment: string;
  ruleEmotion: string;
  ruleTopic: string;
  triggerReason: string;
};

type LlmAnalysis = {
  sentiment: "正面" | "中性" | "负面" | "混合";
  emotion: "认可赞赏" | "兴奋期待" | "购买意向" | "好奇讨论" | "轻松戏谑" | "中性陈述" | "担忧顾虑" | "怀疑质疑" | "失望抱怨" | "愤怒抵制" | "反感不适" | "伦理争议";
  topic: string;
  stance: "支持" | "中立" | "质疑" | "反对" | "购买意向";
  intent: "分享信息" | "咨询" | "表达体验" | "投诉" | "建议" | "号召行动" | "其他";
  risk_type: "无" | "安全" | "隐私" | "伦理" | "欺诈" | "质量" | "价格" | "服务" | "错误信息" | "抵制";
  risk_score: number;
  confidence: number;
  evidence: string;
  needs_review: boolean;
};

export type LlmReportBrief = {
  executive_summary: string;
  content_finding: string;
  audience_finding: string;
  regional_finding: string;
  risk_finding: string;
  opportunity: string;
  recommended_actions: string[];
  caveats: string;
  generated_at?: string;
  model?: string;
  version?: string;
};

class OpenAIRequestError extends Error {
  status: number;
  retryAfter: string;
  constructor(message: string, status: number, retryAfter = "") {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function providerKey(brandId: number) { return `${brandId}:OpenAI LLM`; }

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function bounded(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

function extractOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as unknown[] : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const row = part as Record<string, unknown>;
      if ((row.type === "output_text" || row.type === "text") && typeof row.text === "string") return row.text;
    }
  }
  return "";
}

function retryAtFrom(response: Response) {
  const raw = response.headers.get("retry-after") ?? "";
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) return new Date(Date.now() + seconds * 1000).toISOString();
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return new Date(Date.now() + (response.status === 429 ? 60 : 15) * 60_000).toISOString();
}

async function openAIResponse(apiKey: string, model: string, system: string, input: string, schemaName: string, schema: Record<string, unknown>) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: model === REPORT_MODEL ? "low" : "none" },
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: input }] },
      ],
      text: { format: { type: "json_schema", name: schemaName, strict: true, schema } },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const raw = await response.text();
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(raw) as Record<string, unknown>; } catch { /* Use the HTTP status below. */ }
  if (!response.ok) {
    const error = payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : {};
    throw new OpenAIRequestError(String(error.message ?? `OpenAI HTTP ${response.status}`), response.status, retryAtFrom(response));
  }
  const text = extractOutputText(payload);
  if (!text) throw new OpenAIRequestError("OpenAI 未返回可解析的结构化结果", 502);
  try { return JSON.parse(text) as Record<string, unknown>; }
  catch { throw new OpenAIRequestError("OpenAI 返回的结构化结果无法解析", 502); }
}

const analysisSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    sentiment: { type: "string", enum: ["正面", "中性", "负面", "混合"] },
    emotion: { type: "string", enum: ["认可赞赏", "兴奋期待", "购买意向", "好奇讨论", "轻松戏谑", "中性陈述", "担忧顾虑", "怀疑质疑", "失望抱怨", "愤怒抵制", "反感不适", "伦理争议"] },
    topic: { type: "string" },
    stance: { type: "string", enum: ["支持", "中立", "质疑", "反对", "购买意向"] },
    intent: { type: "string", enum: ["分享信息", "咨询", "表达体验", "投诉", "建议", "号召行动", "其他"] },
    risk_type: { type: "string", enum: ["无", "安全", "隐私", "伦理", "欺诈", "质量", "价格", "服务", "错误信息", "抵制"] },
    risk_score: { type: "integer", minimum: 0, maximum: 100 },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    evidence: { type: "string" },
    needs_review: { type: "boolean" },
  },
  required: ["sentiment", "emotion", "topic", "stance", "intent", "risk_type", "risk_score", "confidence", "evidence", "needs_review"],
};

const reportSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    executive_summary: { type: "string" },
    content_finding: { type: "string" },
    audience_finding: { type: "string" },
    regional_finding: { type: "string" },
    risk_finding: { type: "string" },
    opportunity: { type: "string" },
    recommended_actions: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
    caveats: { type: "string" },
  },
  required: ["executive_summary", "content_finding", "audience_finding", "regional_finding", "risk_finding", "opportunity", "recommended_actions", "caveats"],
};

export async function verifyOpenAIApiKey(apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey.trim()}` }, signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    let message = `OpenAI API Key 验证失败（HTTP ${response.status}）`;
    try {
      const payload = await response.json() as { error?: { message?: string } };
      if (payload.error?.message) message = payload.error.message;
    } catch { /* Keep the status message. */ }
    throw new Error(message);
  }
}

async function loadCandidates(db: D1Database, brandId: number) {
  const [mentions, comments] = await Promise.all([
    db.prepare(`SELECT id, title, excerpt, translation_en, sentiment, emotion, topics, risk, impact, engagement, language
      FROM mentions WHERE brand_id = ? AND published_at >= datetime('now', '-31 days')
        AND (risk >= 55 OR impact >= 80 OR engagement >= 50 OR sentiment = '混合'
          OR language NOT IN ('中文','英文','简体中文','繁体中文'))
      ORDER BY risk DESC, engagement DESC, impact DESC, published_at DESC LIMIT 12`).bind(brandId).all<Record<string, unknown>>(),
    db.prepare(`SELECT comments.id, comments.content, comments.translation_en, comments.sentiment, comments.emotion,
        comments.topic, comments.likes, comments.replies, comments.language
      FROM mention_comments comments
      WHERE comments.brand_id = ?
        AND NOT EXISTS (SELECT 1 FROM comment_annotations annotation WHERE annotation.comment_id = comments.id)
        AND (comments.likes >= 3 OR comments.replies >= 1 OR comments.sentiment IN ('负面','混合')
          OR length(comments.content) >= 80 OR comments.language NOT IN ('中文','英文','简体中文','繁体中文'))
      ORDER BY (comments.likes + comments.replies * 2) DESC, comments.id DESC LIMIT 20`).bind(brandId).all<Record<string, unknown>>(),
  ]);
  const mentionCandidates: Candidate[] = [];
  const commentCandidates: Candidate[] = [];
  for (const row of mentions.results) {
    const reasons = [];
    if (Number(row.risk) >= 55) reasons.push("高风险");
    if (Number(row.impact) >= 80 || Number(row.engagement) >= 50) reasons.push("高影响/互动");
    if (String(row.sentiment) === "混合") reasons.push("混合情绪");
    if (!["中文", "英文", "简体中文", "繁体中文"].includes(String(row.language))) reasons.push("跨语言");
    mentionCandidates.push({ kind: "mention", id: Number(row.id), text: `${row.title}\n${row.excerpt ?? ""}\n${row.translation_en ?? ""}`.slice(0, 6000),
      ruleSentiment: String(row.sentiment), ruleEmotion: String(row.emotion), ruleTopic: String(row.topics), triggerReason: reasons.join("、") || "语义复核" });
  }
  for (const row of comments.results) {
    const reasons = [];
    if (Number(row.likes) >= 3 || Number(row.replies) >= 1) reasons.push("高互动");
    if (["负面", "混合"].includes(String(row.sentiment))) reasons.push("风险/混合情绪");
    if (String(row.content ?? "").length >= 80) reasons.push("复杂表达");
    if (!["中文", "英文", "简体中文", "繁体中文"].includes(String(row.language))) reasons.push("跨语言");
    commentCandidates.push({ kind: "comment", id: Number(row.id), text: `${row.content}\n${row.translation_en ?? ""}`.slice(0, 5000),
      ruleSentiment: String(row.sentiment), ruleEmotion: String(row.emotion), ruleTopic: String(row.topic), triggerReason: reasons.join("、") || "语义复核" });
  }
  const candidates: Candidate[] = [];
  for (let index = 0; index < Math.max(mentionCandidates.length, commentCandidates.length); index += 1) {
    if (mentionCandidates[index]) candidates.push(mentionCandidates[index]);
    if (commentCandidates[index]) candidates.push(commentCandidates[index]);
  }
  return candidates;
}

async function analyzeCandidate(apiKey: string, brand: Record<string, unknown>, candidate: Candidate) {
  const system = `你是品牌舆情分析员。判断文本对被监测品牌或其产品的态度，而不是文本整体语气。准确处理反讽、否定、引用、新闻客观转述和多语言表达。品牌为“${String(brand.name ?? "品牌")}”，别名为“${String(brand.aliases ?? "")}”，业务限定词为“${String(brand.scope_terms ?? "")}”。只根据给定文本作答，不补充外部事实。证据必须是简短释义，不能伪造原文。`;
  const input = `对象：${candidate.kind === "comment" ? "公开评论" : "新闻或社媒内容"}\n规则初判：${candidate.ruleSentiment} / ${candidate.ruleEmotion} / ${candidate.ruleTopic}\n进入复核原因：${candidate.triggerReason}\n\n原始文本：\n${candidate.text}`;
  const raw = await openAIResponse(apiKey, ANALYSIS_MODEL, system, input, "brand_opinion_analysis", analysisSchema);
  return { ...raw, risk_score: bounded(raw.risk_score), confidence: bounded(raw.confidence) } as LlmAnalysis;
}

async function upsertQueuedJob(db: D1Database, brandId: number, candidate: Candidate, sourceHash: string) {
  const existing = await db.prepare(`SELECT source_hash, status, next_retry_at FROM llm_analysis_jobs
    WHERE brand_id = ? AND kind = ? AND target_id = ?`).bind(brandId, candidate.kind, candidate.id)
    .first<{ source_hash: string; status: string; next_retry_at: string }>();
  if (existing?.source_hash === sourceHash && existing.status === "completed") return false;
  if (existing?.source_hash === sourceHash && existing.next_retry_at && new Date(existing.next_retry_at).getTime() > Date.now()) return false;
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO llm_analysis_jobs
    (brand_id, kind, target_id, source_hash, status, model, trigger_reason, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?)
    ON CONFLICT(brand_id, kind, target_id) DO UPDATE SET source_hash = excluded.source_hash, status = 'queued',
      model = excluded.model, trigger_reason = excluded.trigger_reason, last_error = '', next_retry_at = '', updated_at = excluded.updated_at`)
    .bind(brandId, candidate.kind, candidate.id, sourceHash, ANALYSIS_MODEL, candidate.triggerReason, now, now).run();
  return true;
}

async function applyAnalysis(db: D1Database, brandId: number, candidate: Candidate, analysis: LlmAnalysis, sourceHash: string) {
  const now = new Date().toISOString();
  if (analysis.confidence >= 70) {
    if (candidate.kind === "comment") {
      await db.prepare(`UPDATE mention_comments SET sentiment = ?, emotion = ?, sentiment_score = ?, topic = ?
        WHERE id = ? AND brand_id = ? AND NOT EXISTS
          (SELECT 1 FROM comment_annotations annotation WHERE annotation.comment_id = mention_comments.id)`)
        .bind(analysis.sentiment, analysis.emotion, analysis.sentiment === "正面" ? 75 : analysis.sentiment === "负面" ? -75 : 0,
          analysis.topic.slice(0, 80), candidate.id, brandId).run();
    } else {
      await db.prepare(`UPDATE mentions SET sentiment = ?, emotion = ?, sentiment_score = ?, topics = ?, risk = MAX(risk, ?)
        WHERE id = ? AND brand_id = ?`).bind(analysis.sentiment, analysis.emotion,
          analysis.sentiment === "正面" ? 75 : analysis.sentiment === "负面" ? -75 : 0,
          analysis.topic.slice(0, 80), analysis.risk_score, candidate.id, brandId).run();
    }
  }
  await db.prepare(`UPDATE llm_analysis_jobs SET status = 'completed', result_json = ?, confidence = ?,
    last_error = '', next_retry_at = '', completed_at = ?, updated_at = ?
    WHERE brand_id = ? AND kind = ? AND target_id = ? AND source_hash = ?`)
    .bind(JSON.stringify(analysis), analysis.confidence, now, now, brandId, candidate.kind, candidate.id, sourceHash).run();
}

async function failJob(db: D1Database, brandId: number, candidate: Candidate, error: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 500) : "LLM 分析失败";
  const retryAt = error instanceof OpenAIRequestError && error.retryAfter ? error.retryAfter : new Date(Date.now() + 30 * 60_000).toISOString();
  await db.prepare(`UPDATE llm_analysis_jobs SET status = 'error', attempts = attempts + 1, last_error = ?, next_retry_at = ?, updated_at = ?
    WHERE brand_id = ? AND kind = ? AND target_id = ?`)
    .bind(message, retryAt, new Date().toISOString(), brandId, candidate.kind, candidate.id).run();
  return { message, retryAt, limited: error instanceof OpenAIRequestError && [429, 500, 502, 503, 504].includes(error.status) };
}

async function reportContext(db: D1Database, brandId: number) {
  const [content, countries, platforms, topics, comments, commentTopics, commentEvidence, commentRegions, topPosts, collection, reviews] = await Promise.all([
    db.prepare(`SELECT COUNT(*) total, SUM(sentiment = '正面') positive, SUM(sentiment = '负面') negative,
      SUM(sentiment = '中性') neutral, SUM(sentiment = '混合') mixed, MAX(risk) max_risk, SUM(engagement) engagement
      FROM mentions WHERE brand_id = ? AND published_at >= datetime('now', '-30 days')`).bind(brandId).first<Record<string, unknown>>(),
    db.prepare(`SELECT source_country label, COUNT(*) count FROM mentions WHERE brand_id = ? AND published_at >= datetime('now', '-30 days')
      GROUP BY source_country ORDER BY count DESC LIMIT 6`).bind(brandId).all<Record<string, unknown>>(),
    db.prepare(`SELECT platform label, COUNT(*) count FROM mentions WHERE brand_id = ? AND published_at >= datetime('now', '-30 days')
      GROUP BY platform ORDER BY count DESC LIMIT 6`).bind(brandId).all<Record<string, unknown>>(),
    db.prepare(`SELECT topics label, COUNT(*) count FROM mentions WHERE brand_id = ? AND published_at >= datetime('now', '-30 days')
      AND topics != '' GROUP BY topics ORDER BY count DESC LIMIT 8`).bind(brandId).all<Record<string, unknown>>(),
    db.prepare(`SELECT COUNT(*) total_collected, SUM(sentiment != '无实意') meaningful_total,
      SUM(sentiment = '无实意') meaningless, SUM(sentiment = '正面') positive, SUM(sentiment = '负面') negative,
      SUM(sentiment = '中性') neutral, SUM(sentiment = '混合') mixed, SUM(likes) likes, SUM(replies) replies,
      COUNT(DISTINCT COALESCE(NULLIF(author_id, ''), NULLIF(author_username, ''))) authors
      FROM mention_comments WHERE brand_id = ? AND (published_at = '' OR published_at >= datetime('now', '-30 days'))`).bind(brandId).first<Record<string, unknown>>(),
    db.prepare(`SELECT topic, COUNT(*) count,
      SUM(sentiment = '正面') positive, SUM(sentiment = '中性') neutral, SUM(sentiment = '负面') negative, SUM(sentiment = '混合') mixed,
      SUM(likes) likes, SUM(replies) replies
      FROM mention_comments WHERE brand_id = ? AND sentiment != '无实意' AND (published_at = '' OR published_at >= datetime('now', '-30 days'))
      GROUP BY topic ORDER BY count DESC, likes DESC LIMIT 10`).bind(brandId).all<Record<string, unknown>>(),
    db.prepare(`SELECT c.content, c.sentiment, c.emotion, c.topic, c.likes, c.replies, c.platform, c.language,
      m.title post_title, m.source post_source, m.source_country,
      CASE WHEN COALESCE(m.source_country, '') NOT IN ('', '地区待确认', '地区未披露', '全球') THEN m.source_country
        WHEN c.language = '泰语' THEN '泰语文化区' WHEN c.language = '日语' THEN '日语文化区'
        WHEN c.language = '韩语' THEN '韩语文化区' WHEN c.language = '中文' THEN '华语地区'
        WHEN c.language = '英文' THEN '英语地区' ELSE '地区未知' END audience_region
      FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
      WHERE c.brand_id = ? AND c.sentiment != '无实意' AND (c.published_at = '' OR c.published_at >= datetime('now', '-30 days'))
      ORDER BY (c.likes + c.replies * 2) DESC, c.id DESC LIMIT 15`).bind(brandId).all<Record<string, unknown>>(),
    db.prepare(`SELECT CASE WHEN COALESCE(m.source_country, '') NOT IN ('', '地区待确认', '地区未披露', '全球') THEN m.source_country
        WHEN c.language = '泰语' THEN '泰语文化区' WHEN c.language = '日语' THEN '日语文化区'
        WHEN c.language = '韩语' THEN '韩语文化区' WHEN c.language = '中文' THEN '华语地区'
        WHEN c.language = '英文' THEN '英语地区' ELSE '地区未知' END region,
      COUNT(*) total, SUM(c.sentiment = '正面') positive, SUM(c.sentiment = '中性') neutral,
      SUM(c.sentiment = '负面') negative, SUM(c.sentiment = '混合') mixed, SUM(c.likes) likes, SUM(c.replies) replies
      FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
      WHERE c.brand_id = ? AND c.sentiment != '无实意' AND (c.published_at = '' OR c.published_at >= datetime('now', '-30 days'))
      GROUP BY region ORDER BY total DESC LIMIT 8`).bind(brandId).all<Record<string, unknown>>(),
    db.prepare(`SELECT m.title, m.source, m.platform, COUNT(c.id) comments, SUM(c.likes) likes,
      SUM(c.sentiment = '负面') negative, SUM(c.sentiment = '正面') positive
      FROM mention_comments c JOIN mentions m ON m.id = c.mention_id
      WHERE c.brand_id = ? AND c.sentiment != '无实意' AND (c.published_at = '' OR c.published_at >= datetime('now', '-30 days'))
      GROUP BY m.id, m.title, m.source, m.platform ORDER BY comments DESC, likes DESC LIMIT 8`).bind(brandId).all<Record<string, unknown>>(),
    db.prepare(`SELECT COALESCE(SUM(reported_count), 0) reported, COALESCE(SUM(collected_count), 0) collected,
      SUM(status IN ('review','blocked','error','unavailable')) problem_targets
      FROM social_comment_targets WHERE brand_id = ?`).bind(brandId).first<Record<string, unknown>>(),
    db.prepare(`SELECT kind, trigger_reason, confidence, result_json FROM llm_analysis_jobs WHERE brand_id = ?
      AND kind IN ('mention','comment') AND status = 'completed' ORDER BY completed_at DESC LIMIT 12`).bind(brandId).all<Record<string, unknown>>(),
  ]);
  const reported = Number(collection?.reported ?? 0); const collected = Number(collection?.collected ?? 0);
  return { report_version: "audience-evidence-v2", period: "过去30天", content, countries: countries.results, platforms: platforms.results, content_topics: topics.results,
    audience: { summary: comments, topics: commentTopics.results, high_interaction_comments: commentEvidence.results,
      regions: commentRegions.results, top_posts: topPosts.results,
      collection: { reported, collected, coverage_percent: reported ? Math.min(100, Math.round(collected / reported * 100)) : Number(comments?.total ?? 0) ? 100 : 0,
        problem_targets: Number(collection?.problem_targets ?? 0) } },
    reviewed_items: reviews.results.map((item) => { try { return { ...item, result: JSON.parse(String(item.result_json)) }; } catch { return item; } }) };
}

async function runReportAgent(db: D1Database, brandId: number, brand: Record<string, unknown>, apiKey: string) {
  const context = await reportContext(db, brandId);
  if (Number(context.content?.total ?? 0) + Number(context.audience?.summary?.meaningful_total ?? 0) === 0) return { generated: false, reason: "no_data" };
  const sourceHash = stableHash(`audience-evidence-v2|${JSON.stringify(context)}`);
  const existing = await db.prepare(`SELECT source_hash, status FROM llm_analysis_jobs WHERE brand_id = ? AND kind = 'report' AND target_id = ?`)
    .bind(brandId, brandId).first<{ source_hash: string; status: string }>();
  if (existing?.source_hash === sourceHash && existing.status === "completed") return { generated: false, reason: "unchanged" };
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO llm_analysis_jobs
    (brand_id, kind, target_id, source_hash, status, model, trigger_reason, created_at, updated_at)
    VALUES (?, 'report', ?, ?, 'queued', ?, '30天数据汇总', ?, ?)
    ON CONFLICT(brand_id, kind, target_id) DO UPDATE SET source_hash = excluded.source_hash, status = 'queued', model = excluded.model,
      trigger_reason = excluded.trigger_reason, last_error = '', next_retry_at = '', updated_at = excluded.updated_at`)
    .bind(brandId, brandId, sourceHash, REPORT_MODEL, now, now).run();
  try {
    const result = await openAIResponse(apiKey, REPORT_MODEL,
      `你是企业品牌舆情分析负责人。把结构化数据转化为可直接用于周报或月报的中文判断，品牌为“${String(brand.name ?? "品牌")}”。受众舆情是报告重点：不要复述全部数字，而要识别受众最关心的问题、支持或反对的具体理由、高互动观点与普通评论是否不同、地区间是否存在有证据的差异，以及这些发现意味着什么。每条重要判断必须在同一句或下一句写出可核验依据，例如评论条数、样本占比、获赞数、回复数或代表性原文。不要创造或使用“净情绪指数、共鸣分、接受度指数、风险指数”等读者不熟悉的综合分数。严格区分观察事实、分析推断和建议动作；不要把媒体发布地区当成评论者真实国籍，也不要把推断传播链路写成已证实事实。样本少、采集覆盖低或地区置信度不足时必须明确说明，禁止为了显得有洞察而夸大结论。`,
      JSON.stringify(context), "brand_intelligence_report", reportSchema) as unknown as LlmReportBrief;
    const stored = { ...result, generated_at: now, model: REPORT_MODEL, version: "audience-evidence-v2" };
    await db.prepare(`UPDATE llm_analysis_jobs SET status = 'completed', result_json = ?, confidence = 100,
      completed_at = ?, updated_at = ? WHERE brand_id = ? AND kind = 'report' AND target_id = ? AND source_hash = ?`)
      .bind(JSON.stringify(stored), now, now, brandId, brandId, sourceHash).run();
    return { generated: true };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "报告 Agent 生成失败";
    const retryAt = error instanceof OpenAIRequestError && error.retryAfter ? error.retryAfter : new Date(Date.now() + 60 * 60_000).toISOString();
    await db.prepare(`UPDATE llm_analysis_jobs SET status = 'error', attempts = attempts + 1, last_error = ?, next_retry_at = ?, updated_at = ?
      WHERE brand_id = ? AND kind = 'report' AND target_id = ?`).bind(message, retryAt, new Date().toISOString(), brandId, brandId).run();
    throw error;
  }
}

async function markHealth(db: D1Database, brandId: number, status: string, error = "", retryAfter = "") {
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO provider_health
    (provider, status, consecutive_failures, retry_after, last_error, last_attempt_at, last_success_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET status = excluded.status,
      consecutive_failures = CASE WHEN excluded.status = 'online' THEN 0 ELSE provider_health.consecutive_failures + 1 END,
      retry_after = excluded.retry_after, last_error = excluded.last_error, last_attempt_at = excluded.last_attempt_at,
      last_success_at = CASE WHEN excluded.status = 'online' THEN excluded.last_success_at ELSE provider_health.last_success_at END,
      updated_at = excluded.updated_at`)
    .bind(providerKey(brandId), status, status === "online" ? 0 : 1, retryAfter, error, now, status === "online" ? now : "", now).run();
}

export async function runHybridAnalysisCycle(db: D1Database, brandId: number, credentialOwnerId = "") {
  const apiKey = await loadConnectorCredential(db, "OpenAI LLM", credentialOwnerId);
  if (!apiKey) return { configured: false, queued: 0, analyzed: 0, skipped: 0, errors: 0, reportGenerated: false };
  const health = await db.prepare("SELECT retry_after FROM provider_health WHERE provider = ?").bind(providerKey(brandId)).first<{ retry_after: string }>();
  if (health?.retry_after && new Date(health.retry_after).getTime() > Date.now()) {
    return { configured: true, queued: 0, analyzed: 0, skipped: 0, errors: 0, reportGenerated: false, retryAt: health.retry_after };
  }
  const brand = await db.prepare("SELECT name, aliases, scope_terms FROM brand_profiles WHERE id = ?").bind(brandId).first<Record<string, unknown>>();
  if (!brand) return { configured: true, queued: 0, analyzed: 0, skipped: 0, errors: 0, reportGenerated: false };
  const candidates = await loadCandidates(db, brandId);
  let queued = 0; let analyzed = 0; let skipped = 0; let errors = 0;
  let limited: { message: string; retryAt: string } | null = null;
  for (const candidate of candidates) {
    if (queued >= 8) break;
    const sourceHash = stableHash(`${candidate.text}|${candidate.ruleSentiment}|${candidate.ruleEmotion}|${candidate.ruleTopic}`);
    if (!await upsertQueuedJob(db, brandId, candidate, sourceHash)) { skipped += 1; continue; }
    queued += 1;
    try {
      const analysis = await analyzeCandidate(apiKey, brand, candidate);
      await applyAnalysis(db, brandId, candidate, analysis, sourceHash);
      analyzed += 1;
    } catch (error) {
      errors += 1;
      const failure = await failJob(db, brandId, candidate, error);
      if (failure.limited) { limited = failure; break; }
    }
  }
  let reportGenerated = false;
  if (!limited) {
    try { reportGenerated = (await runReportAgent(db, brandId, brand, apiKey)).generated; }
    catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : "报告 Agent 生成失败";
      const retryAt = error instanceof OpenAIRequestError ? error.retryAfter : new Date(Date.now() + 60 * 60_000).toISOString();
      limited = { message, retryAt };
    }
  }
  if (limited) await markHealth(db, brandId, "limited", limited.message, limited.retryAt);
  else await markHealth(db, brandId, "online");
  return { configured: true, queued, analyzed, skipped, errors, reportGenerated, retryAt: limited?.retryAt ?? "" };
}
