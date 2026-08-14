import { env } from "cloudflare:workers";

const supportedProviders = new Set([
  "NewsAPI.ai", "Monid / Instagram", "X", "YouTube", "Meta / Instagram", "TikTok",
  "Azure Translator", "DeepL API Free", "LibreTranslate", "MyMemory",
]);

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey() {
  if (!env.CREDENTIALS_ENCRYPTION_KEY) throw new Error("连接器密钥保险箱尚未初始化");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.CREDENTIALS_ENCRYPTION_KEY));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function saveConnectorCredential(db: D1Database, userId: string, provider: string, value: string, displayLastFour = "") {
  if (!supportedProviders.has(provider)) throw new Error("暂不支持配置该连接器");
  if (!value.trim()) throw new Error("API 密钥不能为空");
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(`${userId}:${provider}`);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData }, key, new TextEncoder().encode(value.trim()));
  const updatedAt = new Date().toISOString();
  await db.prepare(`INSERT INTO connector_credentials (user_id, provider, encrypted_value, iv, last_four, status, updated_at)
    VALUES (?, ?, ?, ?, ?, 'saved', ?)
    ON CONFLICT(user_id, provider) DO UPDATE SET encrypted_value = excluded.encrypted_value, iv = excluded.iv,
      last_four = excluded.last_four, status = 'saved', updated_at = excluded.updated_at`)
    .bind(userId, provider, bytesToBase64(new Uint8Array(encrypted)), bytesToBase64(iv), (displayLastFour || value.trim()).slice(-4), updatedAt).run();
}

export async function deleteConnectorCredential(db: D1Database, userId: string, provider: string) {
  if (!supportedProviders.has(provider)) throw new Error("暂不支持配置该连接器");
  await db.prepare("DELETE FROM connector_credentials WHERE user_id = ? AND provider = ?").bind(userId, provider).run();
}

export async function loadConnectorCredential(db: D1Database, provider: string, userId = "") {
  const environmentValue = provider === "NewsAPI.ai" ? env.NEWSAPI_AI_KEY : provider === "Monid / Instagram" ? env.MONID_API_KEY
    : provider === "X" ? env.X_BEARER_TOKEN : provider === "YouTube" ? env.YOUTUBE_API_KEY
    : provider === "Azure Translator" && env.AZURE_TRANSLATOR_KEY
      ? JSON.stringify({ key: env.AZURE_TRANSLATOR_KEY, region: env.AZURE_TRANSLATOR_REGION || "", endpoint: env.AZURE_TRANSLATOR_ENDPOINT || "" })
    : provider === "DeepL API Free" ? env.DEEPL_API_KEY
    : provider === "LibreTranslate" && env.LIBRETRANSLATE_URL
      ? JSON.stringify({ url: env.LIBRETRANSLATE_URL, key: env.LIBRETRANSLATE_API_KEY || "" })
    : provider === "MyMemory" ? env.TRANSLATION_CONTACT_EMAIL : undefined;
  if (!userId) return environmentValue;
  const row = await db.prepare("SELECT encrypted_value, iv FROM connector_credentials WHERE user_id = ? AND provider = ?").bind(userId, provider)
    .first<{ encrypted_value: string; iv: string }>();
  if (!row) return environmentValue;
  const key = await encryptionKey();
  const additionalData = new TextEncoder().encode(`${userId}:${provider}`);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(row.iv), additionalData }, key, base64ToBytes(row.encrypted_value));
  return new TextDecoder().decode(decrypted);
}
