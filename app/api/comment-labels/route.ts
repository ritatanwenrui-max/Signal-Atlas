import { env } from "cloudflare:workers";
import { getCommentCalibrationStats, manualToneScore, rebuildCommentCalibration } from "../../../db/comment-calibration";
import { ensureDatabase, getActiveBrandForUser, getWorkspaceAccessForUser } from "../../../db/repository";
import type { CommentTone, DetailedEmotion } from "../../../db/text-analysis";
import { prepareWorkspaceForUser } from "../../../db/workspaces";
import { getChatGPTUser } from "../../chatgpt-auth";

export const runtime = "edge";

const sentiments = new Set<CommentTone>(["正面", "中性", "负面", "混合"]);
const emotions = new Set<DetailedEmotion>([
  "认可赞赏", "兴奋期待", "购买意向", "好奇讨论", "轻松戏谑", "中性陈述",
  "担忧顾虑", "怀疑质疑", "失望抱怨", "愤怒抵制", "反感不适", "伦理争议",
]);

async function context() {
  const user = await getChatGPTUser();
  if (!user) return { error: Response.json({ error: "请先登录后标注评论" }, { status: 401 }) };
  await ensureDatabase();
  const db = env.DB;
  await prepareWorkspaceForUser(db, user);
  const [brand, workspace] = await Promise.all([getActiveBrandForUser(db, user.userId), getWorkspaceAccessForUser(db, user.userId)]);
  const brandId = Number(brand?.id ?? 0);
  if (!brandId) return { error: Response.json({ error: "请先创建品牌监测档案" }, { status: 400 }) };
  return { db, user, brandId, workspace };
}

export async function GET() {
  const value = await context();
  if ("error" in value) return value.error;
  return Response.json({ calibration: await getCommentCalibrationStats(value.db, value.brandId) });
}

export async function POST(request: Request) {
  const value = await context();
  if ("error" in value) return value.error;
  if (String(value.workspace?.role ?? "viewer") === "viewer") return Response.json({ error: "当前账号只有查看权限" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { commentId?: number; sentiment?: CommentTone; emotion?: DetailedEmotion; topic?: string; note?: string };
  const commentId = Number(body.commentId ?? 0);
  if (!Number.isInteger(commentId) || commentId <= 0 || !sentiments.has(body.sentiment as CommentTone) || !emotions.has(body.emotion as DetailedEmotion)) {
    return Response.json({ error: "请选择有效的评论、情绪极性与具体情绪" }, { status: 400 });
  }
  const comment = await value.db.prepare(`SELECT id, mention_id, sentiment, emotion, topic, sentiment_score
    FROM mention_comments WHERE id = ? AND brand_id = ?`).bind(commentId, value.brandId)
    .first<{ id: number; mention_id: number; sentiment: string; emotion: string; topic: string; sentiment_score: number }>();
  if (!comment) return Response.json({ error: "这条评论不存在或不属于当前工作区" }, { status: 404 });
  const existing = await value.db.prepare("SELECT comment_id FROM comment_annotations WHERE comment_id = ? AND brand_id = ?")
    .bind(commentId, value.brandId).first<{ comment_id: number }>();
  const manualSentiment = body.sentiment as CommentTone;
  const manualEmotion = body.emotion as DetailedEmotion;
  const manualTopic = String(body.topic ?? "").trim().slice(0, 80);
  const note = String(body.note ?? "").trim().slice(0, 500);
  const now = new Date().toISOString();
  await value.db.batch([
    value.db.prepare(`INSERT INTO comment_annotations
      (comment_id, brand_id, workspace_id, mention_id, annotator_user_id, model_sentiment, model_emotion, model_topic, model_score,
       manual_sentiment, manual_emotion, manual_topic, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(comment_id) DO UPDATE SET annotator_user_id = excluded.annotator_user_id,
        manual_sentiment = excluded.manual_sentiment, manual_emotion = excluded.manual_emotion,
        manual_topic = excluded.manual_topic, note = excluded.note, updated_at = excluded.updated_at`)
      .bind(commentId, value.brandId, Number(value.workspace?.id ?? 0), comment.mention_id, value.user.userId,
        comment.sentiment, comment.emotion, comment.topic, comment.sentiment_score,
        manualSentiment, manualEmotion, manualTopic, note, now, now),
    value.db.prepare(`UPDATE mention_comments SET sentiment = ?, emotion = ?, sentiment_score = ?,
      topic = CASE WHEN ? = '' THEN topic ELSE ? END WHERE id = ? AND brand_id = ?`)
      .bind(manualSentiment, manualEmotion, manualToneScore(manualSentiment), manualTopic, manualTopic, commentId, value.brandId),
  ]);
  const calibration = await rebuildCommentCalibration(value.db, value.brandId);
  const updated = await value.db.prepare(`SELECT comments.*, annotation.model_sentiment, annotation.model_emotion,
      annotation.model_topic, annotation.model_score, annotation.manual_sentiment, annotation.manual_emotion,
      annotation.manual_topic, annotation.note AS annotation_note, annotation.updated_at AS annotation_updated_at
    FROM mention_comments comments JOIN comment_annotations annotation ON annotation.comment_id = comments.id
    WHERE comments.id = ? AND comments.brand_id = ?`).bind(commentId, value.brandId).first<Record<string, unknown>>();
  return Response.json({ ok: true, created: !existing, comment: updated, calibration });
}
