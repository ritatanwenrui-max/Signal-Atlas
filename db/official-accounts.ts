type OfficialAccountCandidate = {
  source?: unknown;
  author?: unknown;
  url?: unknown;
  socialMetrics?: { authorUsername?: unknown } | null;
};

function decoded(value: string) {
  try { return decodeURIComponent(value); }
  catch { return value; }
}

export function normalizeSocialHandle(value: unknown) {
  const raw = decoded(String(value ?? "").trim()).normalize("NFKC");
  if (!raw) return "";
  const atHandle = raw.match(/(?:^|[\s:/(])@([a-z0-9._-]+)/i)?.[1];
  if (atHandle) return atHandle.toLocaleLowerCase();
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const host = parsed.hostname.replace(/^www\./, "").toLocaleLowerCase();
    if (["x.com", "twitter.com", "instagram.com", "tiktok.com", "facebook.com"].some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      const segment = segments[0] === "@" ? segments[1] : segments[0];
      if (segment && !["p", "reel", "tv", "video", "status", "watch"].includes(segment.toLocaleLowerCase())) return segment.replace(/^@/, "").toLocaleLowerCase();
    }
    if ((host === "youtube.com" || host.endsWith(".youtube.com")) && segments[0]?.startsWith("@")) return segments[0].slice(1).toLocaleLowerCase();
  } catch { /* A plain handle is expected most of the time. */ }
  const plain = raw.replace(/^@/, "").trim();
  return /^[a-z0-9._-]+$/i.test(plain) ? plain.toLocaleLowerCase() : "";
}

export function officialAccountHandles(value: unknown) {
  return [...new Set(String(value ?? "").split(/[\n,，]/).map(normalizeSocialHandle).filter(Boolean))];
}

function identityHandles(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const handles = new Set<string>();
  const normalized = normalizeSocialHandle(raw);
  if (normalized) handles.add(normalized);
  for (const match of raw.matchAll(/@([a-z0-9._-]+)/gi)) handles.add(match[1].toLocaleLowerCase());
  return [...handles];
}

export function comesFromOfficialAccount(candidate: OfficialAccountCandidate, configuredAccounts: unknown) {
  const official = new Set(Array.isArray(configuredAccounts)
    ? configuredAccounts.map(normalizeSocialHandle).filter(Boolean)
    : officialAccountHandles(configuredAccounts));
  if (!official.size) return false;
  const identities = [candidate.socialMetrics?.authorUsername, candidate.author, candidate.source, candidate.url]
    .flatMap(identityHandles);
  return identities.some((handle) => official.has(handle));
}
