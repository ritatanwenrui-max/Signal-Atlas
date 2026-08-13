import { analyzeCommentText, meaningfulTokens, type CommentTone, type DetailedEmotion } from "./text-analysis";

export type CalibrationRule = {
  token: string;
  sentiment: CommentTone;
  emotion: DetailedEmotion;
  weight: number;
  sample_count: number;
};

type BaseAnalysis = ReturnType<typeof analyzeCommentText>;
type AnnotationSample = {
  content: string;
  model_sentiment: string;
  model_emotion: string;
  manual_sentiment: CommentTone;
  manual_emotion: DetailedEmotion;
};

const scoreForTone: Record<CommentTone, number> = { 正面: 75, 中性: 0, 负面: -75, 混合: 0 };

export function manualToneScore(tone: CommentTone) {
  return scoreForTone[tone];
}

export async function loadCalibrationRules(db: D1Database, brandId: number) {
  const rows = await db.prepare(`SELECT token, sentiment, emotion, weight, sample_count
    FROM sentiment_calibration_rules WHERE brand_id = ? ORDER BY weight DESC, sample_count DESC LIMIT 500`)
    .bind(brandId).all<CalibrationRule>();
  return rows.results;
}

export function applyCalibrationRules(text: string, base: BaseAnalysis, rules: CalibrationRule[]) {
  if (!rules.length) return { ...base, calibrated: false, calibrationTokens: [] as string[] };
  const tokens = new Set(meaningfulTokens(text));
  const matched = rules.filter((rule) => tokens.has(rule.token));
  if (!matched.length) return { ...base, calibrated: false, calibrationTokens: [] as string[] };
  const sentimentScores = new Map<string, number>();
  const emotionScores = new Map<string, number>();
  for (const rule of matched) {
    sentimentScores.set(rule.sentiment, (sentimentScores.get(rule.sentiment) ?? 0) + rule.weight);
    emotionScores.set(rule.emotion, (emotionScores.get(rule.emotion) ?? 0) + rule.weight);
  }
  const sentiment = [...sentimentScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as CommentTone | undefined;
  const emotion = [...emotionScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as DetailedEmotion | undefined;
  return {
    ...base,
    sentiment: sentiment ?? base.sentiment,
    emotion: emotion ?? base.emotion,
    score: sentiment ? manualToneScore(sentiment) : base.score,
    calibrated: true,
    calibrationTokens: matched.map((item) => item.token),
  };
}

export async function analyzeCommentWithCalibration(db: D1Database, brandId: number, text: string, rules?: CalibrationRule[]) {
  return applyCalibrationRules(text, analyzeCommentText(text), rules ?? await loadCalibrationRules(db, brandId));
}

function winner(counts: Map<string, number>) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
}

export async function getCommentCalibrationStats(db: D1Database, brandId: number) {
  const [totals, confusion, emotionConfusion, rules, recent] = await Promise.all([
    db.prepare(`SELECT (SELECT COUNT(*) FROM mention_comments WHERE brand_id = ?) AS total,
      COUNT(*) AS labeled,
      SUM(CASE WHEN model_sentiment = manual_sentiment THEN 1 ELSE 0 END) AS sentiment_correct,
      SUM(CASE WHEN model_emotion = manual_emotion THEN 1 ELSE 0 END) AS emotion_correct,
      SUM(CASE WHEN model_sentiment != manual_sentiment OR model_emotion != manual_emotion THEN 1 ELSE 0 END) AS disagreements
      FROM comment_annotations WHERE brand_id = ?`).bind(brandId, brandId).first<Record<string, number>>(),
    db.prepare(`SELECT model_sentiment AS model, manual_sentiment AS human, COUNT(*) AS count
      FROM comment_annotations WHERE brand_id = ? GROUP BY model_sentiment, manual_sentiment ORDER BY count DESC`).bind(brandId).all<Record<string, unknown>>(),
    db.prepare(`SELECT model_emotion AS model, manual_emotion AS human, COUNT(*) AS count
      FROM comment_annotations WHERE brand_id = ? AND model_emotion != manual_emotion
      GROUP BY model_emotion, manual_emotion ORDER BY count DESC LIMIT 8`).bind(brandId).all<Record<string, unknown>>(),
    db.prepare("SELECT COUNT(*) AS count FROM sentiment_calibration_rules WHERE brand_id = ?").bind(brandId).first<{ count: number }>(),
    db.prepare("SELECT MAX(updated_at) AS updated_at FROM comment_annotations WHERE brand_id = ?").bind(brandId).first<{ updated_at: string }>(),
  ]);
  const labeled = Number(totals?.labeled ?? 0);
  const total = Number(totals?.total ?? 0);
  return {
    total,
    labeled,
    remaining: Math.max(0, total - labeled),
    progress: total ? Math.round(labeled / total * 100) : 0,
    sentimentAccuracy: labeled ? Math.round(Number(totals?.sentiment_correct ?? 0) / labeled * 100) : null,
    emotionAccuracy: labeled ? Math.round(Number(totals?.emotion_correct ?? 0) / labeled * 100) : null,
    disagreements: Number(totals?.disagreements ?? 0),
    ruleCount: Number(rules?.count ?? 0),
    lastUpdated: recent?.updated_at ?? "",
    confusion: confusion.results,
    emotionDifferences: emotionConfusion.results,
  };
}

export async function rebuildCommentCalibration(db: D1Database, brandId: number) {
  const samples = await db.prepare(`SELECT comments.content, annotation.model_sentiment, annotation.model_emotion,
      annotation.manual_sentiment, annotation.manual_emotion
    FROM comment_annotations annotation JOIN mention_comments comments ON comments.id = annotation.comment_id
    WHERE annotation.brand_id = ?`).bind(brandId).all<AnnotationSample>();
  const tokenStats = new Map<string, {
    samples: number;
    mismatches: number;
    sentiments: Map<string, number>;
    emotions: Map<string, number>;
  }>();
  for (const sample of samples.results) {
    for (const token of new Set(meaningfulTokens(sample.content))) {
      const state = tokenStats.get(token) ?? { samples: 0, mismatches: 0, sentiments: new Map(), emotions: new Map() };
      state.samples += 1;
      if (sample.model_sentiment !== sample.manual_sentiment || sample.model_emotion !== sample.manual_emotion) state.mismatches += 1;
      state.sentiments.set(sample.manual_sentiment, (state.sentiments.get(sample.manual_sentiment) ?? 0) + 1);
      state.emotions.set(sample.manual_emotion, (state.emotions.get(sample.manual_emotion) ?? 0) + 1);
      tokenStats.set(token, state);
    }
  }
  const learned = [...tokenStats.entries()].flatMap(([token, state]) => {
    const topSentiment = winner(state.sentiments);
    const topEmotion = winner(state.emotions);
    if (!topSentiment || !topEmotion || state.samples < 2 || state.mismatches < 1) return [];
    const confidence = Math.min(topSentiment[1], topEmotion[1]) / state.samples;
    if (confidence < .67) return [];
    return [{ token, sentiment: topSentiment[0] as CommentTone, emotion: topEmotion[0] as DetailedEmotion,
      weight: Math.round(confidence * 100 + Math.min(20, state.mismatches * 4)), sampleCount: state.samples }];
  }).sort((a, b) => b.weight - a.weight || b.sampleCount - a.sampleCount).slice(0, 500);
  await db.prepare("DELETE FROM sentiment_calibration_rules WHERE brand_id = ?").bind(brandId).run();
  for (let index = 0; index < learned.length; index += 40) {
    const now = new Date().toISOString();
    const statements = learned.slice(index, index + 40).map((rule) => db.prepare(`INSERT INTO sentiment_calibration_rules
      (brand_id, token, sentiment, emotion, weight, sample_count, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(brandId, rule.token, rule.sentiment, rule.emotion, rule.weight, rule.sampleCount, now));
    if (statements.length) await db.batch(statements);
  }
  const rules = await loadCalibrationRules(db, brandId);
  const unlabelled = await db.prepare(`SELECT comments.id, comments.content FROM mention_comments comments
    WHERE comments.brand_id = ? AND NOT EXISTS (SELECT 1 FROM comment_annotations annotation WHERE annotation.comment_id = comments.id)
    ORDER BY comments.id DESC LIMIT 5000`).bind(brandId).all<{ id: number; content: string }>();
  for (let index = 0; index < unlabelled.results.length; index += 35) {
    const statements = unlabelled.results.slice(index, index + 35).map((comment) => {
      const analysis = applyCalibrationRules(comment.content, analyzeCommentText(comment.content), rules);
      return db.prepare(`UPDATE mention_comments SET sentiment = ?, emotion = ?, sentiment_score = ?, language = ?, topic = ? WHERE id = ? AND brand_id = ?`)
        .bind(analysis.sentiment, analysis.emotion, analysis.score, analysis.language, analysis.topic, comment.id, brandId);
    });
    if (statements.length) await db.batch(statements);
  }
  return getCommentCalibrationStats(db, brandId);
}
