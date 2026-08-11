import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("dashboard onboards any brand and starts automatic monitoring", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /fetch\("\/api\/sync"/);
  assert.match(page, /10 \* 60 \* 1000/);
  assert.match(page, /立即搜索/);
  assert.match(page, /AUTO SEARCH · 每 10 分钟/);
  assert.match(page, /创建品牌监测档案/);
  assert.match(page, /saveBrandProfile/);
  assert.match(page, /链路推断置信/);
  assert.match(page, /补充漏报内容/);
  assert.doesNotMatch(page, /Somnia|硅姬|矽姬/);
});

test("monitoring searches multiple providers, clusters propagation, and records runs", async () => {
  const [sync, providers, repository, migration] = await Promise.all([
    source("db/news-sync.ts"),
    source("db/providers.ts"),
    source("db/repository.ts"),
    source("drizzle/0004_polite_talos.sql"),
  ]);

  assert.match(providers, /api\.gdeltproject\.org\/api\/v2\/doc\/doc/);
  assert.match(providers, /api\.x\.com\/2\/tweets\/search\/recent/);
  assert.match(providers, /googleapis\.com\/youtube\/v3\/search/);
  assert.match(sync, /Promise\.allSettled/);
  assert.match(sync, /similarity/);
  assert.match(sync, /sort\(\(a, b\) => a\.publishedAt\.localeCompare/);
  assert.match(sync, /lastRunAge < 15 \* 1000/);
  assert.match(sync, /INSERT INTO sync_locks/);
  assert.match(sync, /ON CONFLICT\(name\) DO UPDATE/);
  assert.match(sync, /INSERT INTO mentions/);
  assert.match(sync, /INSERT INTO alerts/);
  assert.doesNotMatch(repository, /seedDatabase/);
  assert.match(repository, /CREATE TABLE IF NOT EXISTS brand_profiles/);
  assert.match(repository, /Meta \/ Instagram/);
  assert.match(repository, /CREATE TABLE IF NOT EXISTS sync_runs/);
  assert.match(repository, /CREATE TABLE IF NOT EXISTS sync_locks/);
  assert.match(migration, /CREATE TABLE `brand_profiles`/);
  assert.match(migration, /DELETE FROM `mentions`/);
});

test("worker has a ten-minute background schedule", async () => {
  const [worker, vite] = await Promise.all([
    source("worker/index.ts"),
    source("vite.config.ts"),
  ]);
  assert.match(worker, /async scheduled/);
  assert.match(worker, /runNewsSync\(false\)/);
  assert.match(vite, /crons: \["\*\/10 \* \* \* \*"\]/);
});
