import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("dashboard starts automatic news search and exposes a manual refresh", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /fetch\("\/api\/sync"/);
  assert.match(page, /setInterval\(\(\) => void syncNews\(false, false\), 10 \* 60 \* 1000\)/);
  assert.match(page, /立即搜索/);
  assert.match(page, /AUTO SEARCH · 每 10 分钟/);
  assert.match(page, /补充漏报内容/);
});

test("news sync searches, deduplicates, classifies countries, and records runs", async () => {
  const [sync, repository, migration] = await Promise.all([
    source("db/news-sync.ts"),
    source("db/repository.ts"),
    source("drizzle/0002_gorgeous_mad_thinker.sql"),
  ]);

  assert.match(sync, /api\.gdeltproject\.org\/api\/v2\/doc\/doc/);
  assert.match(sync, /SELECT url FROM mentions/);
  assert.match(sync, /lastRunAge < 15 \* 1000/);
  assert.match(sync, /countryNames/);
  assert.match(sync, /INSERT INTO mentions/);
  assert.match(sync, /INSERT INTO alerts/);
  assert.match(repository, /CREATE TABLE IF NOT EXISTS sync_runs/);
  assert.match(migration, /CREATE TABLE `sync_runs`/);
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
