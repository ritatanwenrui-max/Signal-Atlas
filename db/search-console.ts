import { loadConnectorCredential } from "./credentials";

type SearchConsoleRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };
type SearchConsoleResponse = { rows?: SearchConsoleRow[]; metadata?: { first_incomplete_date?: string } };
type StoredCredential = {
  property?: string;
  credentials?: string | Record<string, unknown>;
  type?: string;
  client_email?: string;
  private_key?: string;
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
};
type DailySignal = { date: string; clicks: number; impressions: number; ctr: number; position: number; complete: number };

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const SIX_HOURS = 6 * 3600_000;
const ONE_DAY = 24 * 3600_000;

function base64Url(bytes: Uint8Array | string) {
  const raw = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let binary = "";
  for (const byte of raw) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function pemBytes(pem: string) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function parseCredential(raw: string, fallbackWebsite = "") {
  const outer = JSON.parse(raw) as StoredCredential;
  const nested = typeof outer.credentials === "string" ? JSON.parse(outer.credentials) as StoredCredential
    : outer.credentials && typeof outer.credentials === "object" ? outer.credentials as StoredCredential : outer;
  const website = fallbackWebsite.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const property = String(outer.property || nested.property || (website ? `sc-domain:${website}` : "")).trim();
  if (!property) throw new Error("Search Console 资源不能为空，例如 sc-domain:example.com");
  return { auth: nested, property };
}

async function serviceAccountToken(auth: StoredCredential) {
  const email = String(auth.client_email ?? "").trim();
  const privateKey = String(auth.private_key ?? "");
  if (!email || !privateKey) throw new Error("服务账号 JSON 缺少 client_email 或 private_key");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ iss: email, scope: SEARCH_CONSOLE_SCOPE, aud: GOOGLE_TOKEN_ENDPOINT, iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${base64Url(signature)}` }),
  });
  const json = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !json.access_token) throw new Error(json.error_description || `Google OAuth 返回 HTTP ${response.status}`);
  return json.access_token;
}

async function refreshToken(auth: StoredCredential) {
  const clientId = String(auth.client_id ?? "").trim();
  const clientSecret = String(auth.client_secret ?? "").trim();
  const token = String(auth.refresh_token ?? "").trim();
  if (!clientId || !clientSecret || !token) throw new Error("OAuth JSON 缺少 client_id、client_secret 或 refresh_token");
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: token, grant_type: "refresh_token" }),
  });
  const json = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !json.access_token) throw new Error(json.error_description || `Google OAuth 返回 HTTP ${response.status}`);
  return json.access_token;
}

async function accessToken(auth: StoredCredential) {
  return auth.type === "service_account" || auth.client_email ? serviceAccountToken(auth) : refreshToken(auth);
}

function dateOnly(date: Date) { return date.toISOString().slice(0, 10); }

async function queryDailySignals(rawCredential: string, website = "", days = 120) {
  const { auth, property } = parseCredential(rawCredential, website);
  const token = await accessToken(auth);
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * ONE_DAY);
  const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate: dateOnly(start), endDate: dateOnly(end), dimensions: ["date"], type: "web", aggregationType: "byProperty", dataState: "all", rowLimit: 25000 }),
  });
  const json = await response.json() as SearchConsoleResponse & { error?: { message?: string } };
  if (!response.ok) throw new Error(json.error?.message || `Search Console 返回 HTTP ${response.status}`);
  const firstIncomplete = json.metadata?.first_incomplete_date ?? "";
  const rows = (json.rows ?? []).flatMap((row): DailySignal[] => {
    const date = String(row.keys?.[0] ?? "");
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? [{ date, clicks: Math.round(Number(row.clicks ?? 0)), impressions: Math.round(Number(row.impressions ?? 0)),
      ctr: Number(row.ctr ?? 0), position: Number(row.position ?? 0), complete: !firstIncomplete || date < firstIncomplete ? 1 : 0 }] : [];
  });
  return { property, rows };
}

function median(values: number[]) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function addDays(date: string, offset: number) {
  const parsed = new Date(`${date}T12:00:00Z`);
  return dateOnly(new Date(parsed.getTime() + offset * ONE_DAY));
}

export function detectSearchEventWindows(rows: DailySignal[]) {
  const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const windows: Array<{ eventKey: string; peakDate: string; startDate: string; endDate: string; peakClicks: number; peakImpressions: number; baselineClicks: number; spikeRatio: number; triggerSource: string; status: string }> = [];
  const starts: Array<{ index: number; baseline: number; deviation: number }> = [];
  for (let index = 7; index < ordered.length; index += 1) {
    const history = ordered.slice(Math.max(0, index - 21), index).map((row) => row.clicks);
    const baseline = Math.max(1, median(history));
    const deviation = median(history.map((value) => Math.abs(value - baseline)));
    const current = ordered[index];
    const previous = ordered[index - 1]?.clicks ?? baseline;
    const relativeThreshold = baseline < 10 ? 2.5 : 1.8;
    const statisticalThreshold = baseline + Math.max(8, deviation * 3);
    const obviousRise = current.clicks >= statisticalThreshold && current.clicks / baseline >= relativeThreshold
      && current.clicks >= Math.max(previous * 1.3, baseline * relativeThreshold);
    if (!obviousRise) continue;

    let start = index;
    const risingFloor = Math.max(5, baseline * 1.35, baseline + Math.max(4, deviation * 1.5));
    while (start > 0 && index - start < 3 && ordered[start - 1].clicks >= risingFloor
      && ordered[start - 1].clicks < ordered[start].clicks) start -= 1;
    const previousStart = starts.at(-1);
    if (previousStart && start - previousStart.index <= 3) continue;
    starts.push({ index: start, baseline, deviation });
  }

  for (let candidateIndex = 0; candidateIndex < starts.length; candidateIndex += 1) {
    const startCandidate = starts[candidateIndex];
    const nextStart = starts[candidateIndex + 1]?.index ?? ordered.length;
    const continuationThreshold = Math.max(5, startCandidate.baseline * 1.35,
      startCandidate.baseline + Math.max(4, startCandidate.deviation * 1.5));
    let end = startCandidate.index;
    let quietDays = 0;
    for (let cursor = startCandidate.index + 1; cursor < nextStart; cursor += 1) {
      if (ordered[cursor].clicks >= continuationThreshold) { end = cursor; quietDays = 0; }
      else quietDays += 1;
      if (quietDays >= 2) break;
    }
    if (nextStart < ordered.length && end >= nextStart - 2) end = nextStart - 1;
    const segment = ordered.slice(startCandidate.index, end + 1);
    const peak = segment.reduce((best, row) => row.clicks > best.clicks ? row : best, segment[0]);
    const stillElevated = end === ordered.length - 1 && ordered[end].clicks >= continuationThreshold;
    windows.push({ eventKey: `search-event-${ordered[startCandidate.index].date}`, peakDate: peak.date, startDate: ordered[startCandidate.index].date,
      endDate: ordered[end]?.date ?? addDays(peak.date, 3), peakClicks: peak.clicks, peakImpressions: peak.impressions,
      baselineClicks: Math.round(startCandidate.baseline), spikeRatio: Math.round(peak.clicks / startCandidate.baseline * 100), triggerSource: "gsc",
      status: stillElevated ? "active" : "confirmed" });
  }
  return windows;
}

async function rebuildEventWindows(db: D1Database, brandId: number, rows: DailySignal[]) {
  const windows = detectSearchEventWindows(rows);
  await db.prepare("DELETE FROM search_event_windows WHERE brand_id = ? AND trigger_source = 'gsc'").bind(brandId).run();
  for (const window of windows) {
    await db.prepare(`INSERT INTO search_event_windows
      (brand_id, event_key, peak_date, start_date, end_date, peak_clicks, peak_impressions, baseline_clicks, spike_ratio, trigger_source, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'gsc', ?, ?)
      ON CONFLICT(brand_id, event_key) DO UPDATE SET start_date = excluded.start_date, end_date = excluded.end_date,
        peak_clicks = excluded.peak_clicks, peak_impressions = excluded.peak_impressions, baseline_clicks = excluded.baseline_clicks,
        spike_ratio = excluded.spike_ratio, trigger_source = 'gsc', status = excluded.status, updated_at = excluded.updated_at`)
      .bind(brandId, window.eventKey, window.peakDate, window.startDate, window.endDate, window.peakClicks, window.peakImpressions,
        window.baselineClicks, window.spikeRatio, window.status, new Date().toISOString()).run();
    await db.prepare(`UPDATE event_origins SET event_key = ?, updated_at = ? WHERE brand_id = ? AND event_key IN (
      SELECT event_key FROM search_event_windows WHERE brand_id = ? AND trigger_source = 'manual'
        AND date(start_date) <= date(?) AND date(end_date) >= date(?)
    )`).bind(window.eventKey, new Date().toISOString(), brandId, brandId, window.endDate, window.startDate).run();
    await db.prepare(`DELETE FROM search_event_windows WHERE brand_id = ? AND trigger_source = 'manual'
      AND event_key != ? AND date(start_date) <= date(?) AND date(end_date) >= date(?)`)
      .bind(brandId, window.eventKey, window.endDate, window.startDate).run();
  }
  return windows;
}

export async function verifySearchConsoleCredential(rawCredential: string, website = "") {
  const result = await queryDailySignals(rawCredential, website, 7);
  return { property: result.property, rows: result.rows.length };
}

export async function syncSearchConsoleSignals(db: D1Database, brandId: number, credentialOwnerId: string, website = "", force = false) {
  const rawCredential = await loadConnectorCredential(db, "Google Search Console", credentialOwnerId);
  if (!rawCredential) return { configured: false, updated: 0, events: 0 };
  const provider = `${brandId}:Google Search Console`;
  const health = await db.prepare("SELECT last_success_at, retry_after FROM provider_health WHERE provider = ?").bind(provider)
    .first<{ last_success_at: string; retry_after: string }>();
  if (!force && health?.retry_after && new Date(health.retry_after).getTime() > Date.now()) return { configured: true, deferred: true, updated: 0, events: 0 };
  if (!force && health?.last_success_at && Date.now() - new Date(health.last_success_at).getTime() < SIX_HOURS) return { configured: true, skipped: true, updated: 0, events: 0 };
  const attemptedAt = new Date().toISOString();
  try {
    const result = await queryDailySignals(rawCredential, website);
    for (let index = 0; index < result.rows.length; index += 75) {
      await db.batch(result.rows.slice(index, index + 75).map((row) => db.prepare(`INSERT INTO search_demand_signals
        (brand_id, signal_date, clicks, impressions, ctr_micros, position_millis, complete, source, collected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'gsc', ?)
        ON CONFLICT(brand_id, signal_date) DO UPDATE SET clicks = excluded.clicks, impressions = excluded.impressions,
          ctr_micros = excluded.ctr_micros, position_millis = excluded.position_millis, complete = excluded.complete,
          source = 'gsc', collected_at = excluded.collected_at`)
        .bind(brandId, row.date, row.clicks, row.impressions, Math.round(row.ctr * 1_000_000), Math.round(row.position * 1000), row.complete, attemptedAt)));
    }
    const events = await rebuildEventWindows(db, brandId, result.rows);
    await db.prepare(`INSERT INTO provider_health (provider, status, consecutive_failures, retry_after, last_error, last_attempt_at, last_success_at, updated_at)
      VALUES (?, 'online', 0, '', '', ?, ?, ?) ON CONFLICT(provider) DO UPDATE SET status = 'online', consecutive_failures = 0,
      retry_after = '', last_error = '', last_attempt_at = excluded.last_attempt_at, last_success_at = excluded.last_success_at, updated_at = excluded.updated_at`)
      .bind(provider, attemptedAt, attemptedAt, attemptedAt).run();
    return { configured: true, updated: result.rows.length, events: events.length, property: result.property };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search Console 同步失败";
    const retryAt = new Date(Date.now() + SIX_HOURS).toISOString();
    await db.prepare(`INSERT INTO provider_health (provider, status, consecutive_failures, retry_after, last_error, last_attempt_at, last_success_at, updated_at)
      VALUES (?, 'degraded', 1, ?, ?, ?, '', ?) ON CONFLICT(provider) DO UPDATE SET status = 'degraded',
      consecutive_failures = provider_health.consecutive_failures + 1, retry_after = excluded.retry_after,
      last_error = excluded.last_error, last_attempt_at = excluded.last_attempt_at, updated_at = excluded.updated_at`)
      .bind(provider, retryAt, message, attemptedAt, attemptedAt).run();
    return { configured: true, updated: 0, events: 0, error: message, retryAt };
  }
}
