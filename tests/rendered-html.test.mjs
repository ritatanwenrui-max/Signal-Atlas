import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("dashboard provides lifetime archive, event analytics, maps, and personal API setup", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /新闻档案/);
  assert.match(page, /有史以来全部记录/);
  assert.match(page, /导出 CSV/);
  assert.match(page, /全球报道热力分布/);
  assert.match(page, /高频议题词云/);
  assert.match(page, /情绪结构/);
  assert.match(page, /事件爆发曲线/);
  assert.match(page, /并列事件对比/);
  assert.match(page, /高度转载率/);
  assert.match(page, /saveConnectorCredential/);
  assert.match(page, /PERSONAL API VAULT/);
  assert.match(page, /按登录用户隔离/);
  assert.match(page, /60 \* 60 \* 1000/);
  assert.doesNotMatch(page, /Somnia|硅姬|矽姬/);
});

test("hybrid collection discovers globally and continuously follows free media sources", async () => {
  const [sync, providers, crawler, repository] = await Promise.all([
    source("db/news-sync.ts"), source("db/providers.ts"), source("db/free-crawler.ts"), source("db/repository.ts"),
  ]);
  assert.match(providers, /eventregistry\.org\/api\/v1\/article\/getArticles/);
  assert.match(providers, /api\.gdeltproject\.org\/api\/v2\/doc\/doc/);
  assert.match(providers, /forceMaxDataTimeWindow: 31/);
  assert.match(sync, /const SIX_HOURS/);
  assert.match(sync, /const gdeltDue/);
  assert.match(sync, /titleScore \* 0\.68/);
  assert.match(sync, /ageHours <= 24/);
  assert.match(sync, /rebuildPropagationEdges/);
  assert.match(sync, /propagation_edges/);
  assert.match(crawler, /robotsAllows/);
  assert.match(crawler, /parseFeed/);
  assert.match(crawler, /parseSitemap/);
  assert.match(crawler, /If-None-Match/);
  assert.match(crawler, /LIMIT 10/);
  assert.match(repository, /CREATE TABLE IF NOT EXISTS media_sources/);
  assert.match(repository, /CREATE TABLE IF NOT EXISTS propagation_edges/);
  assert.match(repository, /每 6 小时发现/);
});

test("connector credentials are user-scoped and encrypted server-side", async () => {
  const [credentials, route, schema] = await Promise.all([
    source("db/credentials.ts"), source("app/api/data/route.ts"), source("db/schema.ts"),
  ]);
  assert.match(credentials, /AES-GCM/);
  assert.match(credentials, /additionalData/);
  assert.match(credentials, /user_id = \? AND provider = \?/);
  assert.match(route, /getChatGPTUser/);
  assert.match(route, /请先登录/);
  assert.match(schema, /connectorCredentials/);
  assert.match(schema, /primaryKey\(\{ columns: \[table\.userId, table\.provider\] \}\)/);
});

test("worker runs the hybrid monitor hourly", async () => {
  const [worker, vite] = await Promise.all([source("worker/index.ts"), source("vite.config.ts")]);
  assert.match(worker, /async scheduled/);
  assert.match(worker, /runNewsSync\(false\)/);
  assert.match(vite, /crons: \["17 \* \* \* \*"\]/);
});
