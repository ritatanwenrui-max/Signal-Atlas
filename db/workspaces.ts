export type WorkspaceIdentity = {
  userId: string;
  email: string;
  displayName: string;
};

type WorkspaceAccess = {
  id: number;
  name: string;
  owner_user_id: string;
  credential_owner_user_id: string;
  role: string;
};

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

async function activeAccess(db: D1Database, userId: string) {
  return db.prepare(`SELECT workspaces.*, workspace_members.role FROM workspace_members
    JOIN workspaces ON workspaces.id = workspace_members.workspace_id
    WHERE workspace_members.user_id = ? AND workspace_members.status = 'active' AND workspace_members.is_active = 1
    ORDER BY workspace_members.joined_at DESC LIMIT 1`).bind(userId).first<WorkspaceAccess>();
}

export async function prepareWorkspaceForUser(db: D1Database, user: WorkspaceIdentity) {
  const email = normalizedEmail(user.email);
  const now = new Date().toISOString();
  const pending = await db.prepare(`SELECT workspace_invites.*, workspaces.name AS workspace_name
    FROM workspace_invites JOIN workspaces ON workspaces.id = workspace_invites.workspace_id
    WHERE lower(workspace_invites.email) = ? AND workspace_invites.status = 'pending'
      AND datetime(workspace_invites.expires_at) > datetime('now')
    ORDER BY workspace_invites.created_at DESC LIMIT 1`).bind(email).first<Record<string, unknown>>();

  if (pending) {
    const workspaceId = Number(pending.workspace_id);
    await db.batch([
      db.prepare("UPDATE workspace_members SET is_active = 0 WHERE user_id = ?").bind(user.userId),
      db.prepare(`INSERT INTO workspace_members
        (workspace_id, user_id, email, display_name, role, status, is_active, joined_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?)
        ON CONFLICT(workspace_id, user_id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name,
          role = excluded.role, status = 'active', is_active = 1, last_seen_at = excluded.last_seen_at`)
        .bind(workspaceId, user.userId, email, user.displayName, String(pending.role ?? "editor"), now, now),
      db.prepare("UPDATE workspace_invites SET status = 'accepted', accepted_by = ?, accepted_at = ? WHERE id = ?")
        .bind(user.userId, now, Number(pending.id)),
    ]);
  }

  let access = await activeAccess(db, user.userId);
  if (!access) {
    const legacyBrand = await db.prepare("SELECT * FROM brand_profiles WHERE user_id = ? AND active = 1 ORDER BY id DESC LIMIT 1")
      .bind(user.userId).first<Record<string, unknown>>();
    const workspaceName = legacyBrand?.name ? `${String(legacyBrand.name)} 团队工作区` : "我的团队工作区";
    const inserted = await db.prepare(`INSERT INTO workspaces
      (name, owner_user_id, credential_owner_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(workspaceName, user.userId, user.userId, now, now).run();
    const workspaceId = Number(inserted.meta.last_row_id);
    await db.prepare(`INSERT INTO workspace_members
      (workspace_id, user_id, email, display_name, role, status, is_active, joined_at, last_seen_at)
      VALUES (?, ?, ?, ?, 'owner', 'active', 1, ?, ?)`)
      .bind(workspaceId, user.userId, email, user.displayName, now, now).run();
    if (legacyBrand?.id) await db.prepare("UPDATE brand_profiles SET workspace_id = ? WHERE id = ?")
      .bind(workspaceId, Number(legacyBrand.id)).run();
    access = await activeAccess(db, user.userId);
  } else {
    await db.prepare(`UPDATE workspace_members SET email = ?, display_name = ?, last_seen_at = ?
      WHERE workspace_id = ? AND user_id = ?`).bind(email, user.displayName, now, access.id, user.userId).run();
  }
  return access;
}

export async function requireWorkspaceAccess(db: D1Database, userId: string, permission: "read" | "edit" | "manage" = "read") {
  const access = await activeAccess(db, userId);
  if (!access) throw new Error("未找到可用的团队工作区");
  if (permission === "manage" && access.role !== "owner" && access.role !== "admin") throw new Error("只有工作区管理员可以执行此操作");
  if (permission === "edit" && access.role === "viewer") throw new Error("你在这个工作区只有查看权限");
  return access;
}

export async function inviteWorkspaceMembers(db: D1Database, workspaceId: number, invitedBy: string, rawEmails: string, role: string) {
  const emails = [...new Set(rawEmails.split(/[\n,，;；]/).map(normalizedEmail).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))].slice(0, 50);
  if (!emails.length) throw new Error("请输入至少一个有效的同事邮箱");
  const safeRole = role === "viewer" ? "viewer" : "editor";
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
  let inserted = 0;
  for (const email of emails) {
    const member = await db.prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND lower(email) = ? AND status = 'active' LIMIT 1")
      .bind(workspaceId, email).first();
    if (member) continue;
    await db.prepare("UPDATE workspace_invites SET status = 'revoked' WHERE workspace_id = ? AND lower(email) = ? AND status = 'pending'")
      .bind(workspaceId, email).run();
    await db.prepare(`INSERT INTO workspace_invites
      (workspace_id, email, role, status, invited_by, created_at, expires_at) VALUES (?, ?, ?, 'pending', ?, ?, ?)`)
      .bind(workspaceId, email, safeRole, invitedBy, now, expiresAt).run();
    inserted += 1;
  }
  return { inserted, skipped: emails.length - inserted };
}

export async function removeWorkspaceMember(db: D1Database, workspaceId: number, actorUserId: string, memberUserId: string) {
  const workspace = await db.prepare("SELECT owner_user_id FROM workspaces WHERE id = ?").bind(workspaceId).first<{ owner_user_id: string }>();
  if (!workspace || memberUserId === workspace.owner_user_id || memberUserId === actorUserId) throw new Error("工作区所有者不能被移除");
  await db.prepare("UPDATE workspace_members SET status = 'removed', is_active = 0 WHERE workspace_id = ? AND user_id = ?")
    .bind(workspaceId, memberUserId).run();
}

