import { env } from "cloudflare:workers";
import { runNewsSync, type NewsSyncMode } from "./news-sync";
import { ensureDatabase, getActiveBrandForUser } from "./repository";

export type SyncPipelineStage = "reddit" | "maintenance" | "discovery" | "audience";
export type SyncPipelineStatus = "queued" | "running" | "retrying" | "completed" | "failed";
export type SyncPipelineTaskType = "main" | "reddit";

export type SyncPipelineJob = {
  id: string;
  brand_id: number;
  owner_user_id: string;
  task_type: SyncPipelineTaskType;
  force: number;
  stage: SyncPipelineStage;
  status: SyncPipelineStatus;
  attempts: number;
  max_attempts: number;
  next_retry_at: string;
  lease_until: string;
  last_error: string;
  result_json: string;
  created_at: string;
  updated_at: string;
  completed_at: string;
};

const MAIN_STAGES: SyncPipelineStage[] = ["maintenance", "discovery", "audience"];
const LEASE_MS = 2 * 60_000;

function nextStage(stage: SyncPipelineStage) {
  const index = MAIN_STAGES.indexOf(stage);
  return index >= 0 && index < MAIN_STAGES.length - 1 ? MAIN_STAGES[index + 1] : null;
}

function retryDelay(attempts: number) {
  return Math.min(60 * 60_000, 15_000 * 2 ** Math.min(8, Math.max(0, attempts - 1)));
}

async function hasRunnableRedditDiscovery(db: D1Database, brandId: number) {
  const now = new Date().toISOString();
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM sync_pipeline_jobs
    WHERE brand_id = ? AND task_type = 'reddit' AND (
      status IN ('queued','running') OR
      (status = 'retrying' AND (next_retry_at = '' OR datetime(next_retry_at) <= datetime(?)))
    )`).bind(brandId, now).first<{ count: number }>();
  return Number(row?.count ?? 0) > 0;
}

export async function getSyncPipelineJob(jobId: string) {
  await ensureDatabase();
  return env.DB.prepare("SELECT * FROM sync_pipeline_jobs WHERE id = ?").bind(jobId).first<SyncPipelineJob>();
}

export async function getLatestSyncPipeline(brandId: number, taskType: SyncPipelineTaskType = "main") {
  await ensureDatabase();
  return env.DB.prepare("SELECT * FROM sync_pipeline_jobs WHERE brand_id = ? AND task_type = ? ORDER BY created_at DESC LIMIT 1")
    .bind(brandId, taskType).first<SyncPipelineJob>();
}

async function enqueuePipelineTask(userId: string, taskType: SyncPipelineTaskType, force = false) {
  await ensureDatabase();
  const db = env.DB;
  const brand = await getActiveBrandForUser(db, userId);
  if (!brand) throw new Error("请先配置品牌再启动巡检");
  const brandId = Number(brand.id);
  const existing = await db.prepare(`SELECT * FROM sync_pipeline_jobs WHERE brand_id = ?
    AND task_type = ? AND status IN ('queued','running','retrying') ORDER BY created_at DESC LIMIT 1`)
    .bind(brandId, taskType).first<SyncPipelineJob>();
  if (existing) {
    if (force) await db.prepare(`UPDATE sync_pipeline_jobs SET force = 1,
      status = CASE WHEN status = 'retrying' THEN 'queued' ELSE status END,
      next_retry_at = CASE WHEN status = 'retrying' THEN '' ELSE next_retry_at END, updated_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), existing.id).run();
    return await getSyncPipelineJob(existing.id) ?? existing;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const initialStage: SyncPipelineStage = taskType === "reddit" ? "reddit" : "maintenance";
  await db.prepare(`INSERT INTO sync_pipeline_jobs
    (id, brand_id, owner_user_id, task_type, force, stage, status, attempts, max_attempts, next_retry_at, lease_until,
     last_error, result_json, created_at, updated_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, 5, '', '', '', '{}', ?, ?, '')`)
    .bind(id, brandId, userId, taskType, force ? 1 : 0, initialStage, now, now).run();
  return await getSyncPipelineJob(id);
}

export async function enqueueSyncPipelines(userId: string, force = false) {
  const [main, reddit] = await Promise.all([
    enqueuePipelineTask(userId, "main", force),
    enqueuePipelineTask(userId, "reddit", force),
  ]);
  return { main, reddit };
}

export async function processSyncPipeline(jobId: string) {
  await ensureDatabase();
  const db = env.DB;
  const before = await getSyncPipelineJob(jobId);
  if (!before || before.status === "completed" || before.status === "failed") return before;
  const now = new Date().toISOString();
  if (before.next_retry_at && new Date(before.next_retry_at).getTime() > Date.now()) return before;
  if (before.status === "running" && before.lease_until && new Date(before.lease_until).getTime() > Date.now()) return before;
  const leaseUntil = new Date(Date.now() + LEASE_MS).toISOString();
  const claim = await db.prepare(`UPDATE sync_pipeline_jobs SET status = 'running', lease_until = ?, updated_at = ?
    WHERE id = ? AND status IN ('queued','retrying','running')
      AND (next_retry_at = '' OR datetime(next_retry_at) <= datetime(?))
      AND (status != 'running' OR lease_until = '' OR datetime(lease_until) <= datetime(?))`)
    .bind(leaseUntil, now, jobId, now, now).run();
  if ((claim.meta.changes ?? 0) === 0) return await getSyncPipelineJob(jobId);

  const job = await getSyncPipelineJob(jobId);
  if (!job) return null;
  try {
    const result = await runNewsSync(Boolean(job.force), job.owner_user_id, job.stage as NewsSyncMode);
    const resultJson = JSON.stringify(result);
    if (result?.reason === "sync_in_progress") {
      const retryAt = new Date(Date.now() + 20_000).toISOString();
      await db.prepare(`UPDATE sync_pipeline_jobs SET status = 'retrying', next_retry_at = ?, lease_until = '',
        last_error = '另一个阶段仍在收尾，稍后继续', result_json = ?, updated_at = ? WHERE id = ?`)
        .bind(retryAt, resultJson, new Date().toISOString(), jobId).run();
      return await getSyncPipelineJob(jobId);
    }
    if (job.task_type === "reddit" && result?.phaseRetryAt && new Date(result.phaseRetryAt).getTime() > Date.now()) {
      await db.prepare(`UPDATE sync_pipeline_jobs SET status = 'retrying', next_retry_at = ?, lease_until = '',
        last_error = 'Reddit 独立连接器正在退避，将按自己的时间重试', result_json = ?, updated_at = ? WHERE id = ?`)
        .bind(result.phaseRetryAt, resultJson, new Date().toISOString(), jobId).run();
      return await getSyncPipelineJob(jobId);
    }
    if (job.task_type === "reddit" && result?.phasePending) {
      const retryAt = new Date(Date.now() + 15_000).toISOString();
      await db.prepare(`UPDATE sync_pipeline_jobs SET status = 'queued', next_retry_at = ?, lease_until = '',
        last_error = '', result_json = ?, updated_at = ? WHERE id = ?`)
        .bind(retryAt, resultJson, new Date().toISOString(), jobId).run();
      return await getSyncPipelineJob(jobId);
    }
    if (job.task_type === "reddit") {
      const completedAt = new Date().toISOString();
      await db.prepare(`UPDATE sync_pipeline_jobs SET stage = 'reddit', status = 'completed', attempts = 0,
        next_retry_at = '', lease_until = '', last_error = '', result_json = ?, updated_at = ?, completed_at = ? WHERE id = ?`)
        .bind(resultJson, completedAt, completedAt, jobId).run();
      return await getSyncPipelineJob(jobId);
    }
    if (job.stage === "discovery") {
      const redditDiscoveryActive = await hasRunnableRedditDiscovery(db, job.brand_id);
      const archiveDiscoveryPending = Boolean(result?.phasePending);
      const archiveChanged = Number(result?.inserted ?? 0) > 0;
      if (archiveDiscoveryPending || archiveChanged || redditDiscoveryActive) {
        const retryAt = new Date(Date.now() + 15_000).toISOString();
        const progress = archiveDiscoveryPending ? `仍有 ${Number(result?.searchPending ?? 0)} 个社媒搜索任务待返回`
          : archiveChanged ? `本轮新增 ${Number(result?.inserted ?? 0)} 条内容，正在执行无新增复核`
          : "Reddit 发现任务仍在运行，新闻档案优先等待";
        await db.prepare(`UPDATE sync_pipeline_jobs SET stage = 'discovery', status = 'queued', force = 0,
          attempts = 0, next_retry_at = ?, lease_until = '', last_error = ?, result_json = ?, updated_at = ? WHERE id = ?`)
          .bind(retryAt, progress, resultJson, new Date().toISOString(), jobId).run();
        return await getSyncPipelineJob(jobId);
      }
    }
    const next = nextStage(job.stage);
    if (!next) {
      const completedAt = new Date().toISOString();
      await db.prepare(`UPDATE sync_pipeline_jobs SET stage = 'audience', status = 'completed', attempts = 0,
        next_retry_at = '', lease_until = '', last_error = '', result_json = ?, updated_at = ?, completed_at = ? WHERE id = ?`)
        .bind(resultJson, completedAt, completedAt, jobId).run();
    } else {
      await db.prepare(`UPDATE sync_pipeline_jobs SET stage = ?, status = 'queued', attempts = 0,
        next_retry_at = '', lease_until = '', last_error = '', result_json = ?, updated_at = ? WHERE id = ?`)
        .bind(next, resultJson, new Date().toISOString(), jobId).run();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "后台阶段执行失败";
    const attempts = Number(job.attempts ?? 0) + 1;
    const terminal = attempts >= Number(job.max_attempts ?? 5);
    const retryAt = new Date(Date.now() + retryDelay(attempts)).toISOString();
    await db.prepare(`UPDATE sync_pipeline_jobs SET status = ?, attempts = ?, next_retry_at = ?, lease_until = '',
      last_error = ?, updated_at = ?, completed_at = ? WHERE id = ?`)
      .bind(terminal ? "failed" : "retrying", attempts, terminal ? "" : retryAt, message,
        new Date().toISOString(), terminal ? new Date().toISOString() : "", jobId).run();
  }
  return await getSyncPipelineJob(jobId);
}

export async function processDueSyncPipelines(limit = 4) {
  await ensureDatabase();
  const now = new Date().toISOString();
  const rows = await env.DB.prepare(`SELECT id FROM sync_pipeline_jobs
    WHERE status IN ('queued','retrying','running')
      AND (next_retry_at = '' OR datetime(next_retry_at) <= datetime(?))
      AND (status != 'running' OR lease_until = '' OR datetime(lease_until) <= datetime(?))
    ORDER BY updated_at ASC LIMIT ?`).bind(now, now, limit).all<{ id: string }>();
  const results = [];
  for (const row of rows.results) results.push(await processSyncPipeline(row.id));
  return results;
}

export async function enqueueAllSyncPipelines() {
  await ensureDatabase();
  const rows = await env.DB.prepare(`SELECT COALESCE(workspaces.owner_user_id, brand_profiles.user_id) AS user_id
    FROM brand_profiles LEFT JOIN workspaces ON workspaces.id = brand_profiles.workspace_id
    WHERE brand_profiles.active = 1 AND COALESCE(workspaces.owner_user_id, brand_profiles.user_id) != ''
    GROUP BY brand_profiles.id ORDER BY brand_profiles.id ASC LIMIT 100`).all<{ user_id: string }>();
  for (const row of rows.results) await enqueueSyncPipelines(row.user_id, false);
}

export async function runScheduledSyncPipelines() {
  await enqueueAllSyncPipelines();
  return processDueSyncPipelines(4);
}
