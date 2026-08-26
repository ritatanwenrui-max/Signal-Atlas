import { loadDashboardData } from "../../../db/repository";
import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureDatabase, getActiveBrandForUser } from "../../../db/repository";
import { env } from "cloudflare:workers";
import { prepareWorkspaceForUser, requireWorkspaceAccess } from "../../../db/workspaces";
import { enqueueSyncPipelines, getLatestSyncPipeline, getSyncPipelineJob, type SyncPipelineJob } from "../../../db/sync-pipeline";

function pipelineResponse(payload: Record<string, unknown>, jobs: Array<SyncPipelineJob | null>, status = 200) {
  const jobIds = jobs.filter((job): job is SyncPipelineJob => Boolean(job))
    .filter((job) => ["queued", "running", "retrying"].includes(job.status)).map((job) => job.id);
  return Response.json(payload, { status, headers: { "x-sync-pipeline-ids": jobIds.join(","), "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({})) as { force?: boolean };
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "请先登录后再启动品牌巡检" }, { status: 401 });
    await ensureDatabase();
    await prepareWorkspaceForUser(env.DB, user);
    await requireWorkspaceAccess(env.DB, user.userId, "edit");
    const jobs = await enqueueSyncPipelines(user.userId, Boolean(payload.force));
    if (!jobs.main || !jobs.reddit) throw new Error("后台巡检任务未能创建");
    return pipelineResponse({ sync: { queued: true, job: jobs.main, redditJob: jobs.reddit },
      data: { ...await loadDashboardData(user.userId), viewer: { authenticated: true } } }, [jobs.main, jobs.reddit], 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "新闻自动搜索失败";
    return Response.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "请先登录后再查看巡检进度" }, { status: 401 });
    await ensureDatabase();
    await prepareWorkspaceForUser(env.DB, user);
    await requireWorkspaceAccess(env.DB, user.userId, "edit");
    const brand = await getActiveBrandForUser(env.DB, user.userId);
    if (!brand) return Response.json({ error: "请先配置品牌" }, { status: 400 });
    const requestedId = new URL(request.url).searchParams.get("jobId") ?? "";
    const job = requestedId ? await getSyncPipelineJob(requestedId) : await getLatestSyncPipeline(Number(brand.id), "main");
    if (!job || Number(job.brand_id) !== Number(brand.id)) return Response.json({ error: "没有可查看的巡检任务" }, { status: 404 });
    const redditJob = await getLatestSyncPipeline(Number(brand.id), "reddit");
    return pipelineResponse({ sync: { queued: [job, redditJob].some((item) => item && ["queued", "running", "retrying"].includes(item.status)), job, redditJob },
      data: { ...await loadDashboardData(user.userId), viewer: { authenticated: true } } }, [job, redditJob]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法读取巡检进度";
    return Response.json({ error: message }, { status: 502 });
  }
}
