import { env } from "cloudflare:workers";
import { ensureDatabase, getWorkspaceAccessForUser } from "../../../db/repository";
import { translateTextToAmericanEnglish } from "../../../db/translation";
import { prepareWorkspaceForUser } from "../../../db/workspaces";
import { getChatGPTUser } from "../../chatgpt-auth";

export const runtime = "edge";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to translate workspace content." }, { status: 401 });
  await ensureDatabase();
  await prepareWorkspaceForUser(env.DB, user);
  const workspace = await getWorkspaceAccessForUser(env.DB, user.userId);
  if (!workspace) return Response.json({ error: "Workspace unavailable." }, { status: 404 });
  const payload = await request.json().catch(() => ({})) as { texts?: unknown[] };
  const texts = [...new Set((payload.texts ?? []).map((item) => String(item ?? "").trim()).filter(Boolean))]
    .slice(0, 16).map((item) => item.slice(0, 2_000));
  const credentialOwnerId = String(workspace.credential_owner_user_id ?? user.userId);
  const translations: Record<string, string> = {};
  for (const text of texts) {
    try { translations[text] = await translateTextToAmericanEnglish(env.DB, credentialOwnerId, text); }
    catch { translations[text] = "Translation is temporarily unavailable."; }
  }
  return Response.json({ translations, locale: "en-US" });
}
