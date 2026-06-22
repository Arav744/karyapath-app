require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { createSession, destroySession, checkPassword, authMiddleware } = require("./lib/auth");
const access = require("./lib/access");
const { startScheduler } = require("./lib/scheduler");

const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
const store = useSupabase ? require("./lib/store-supabase") : require("./lib/store-local");

const app = express();
app.use(cors());
app.use(express.json());

// Serve the client as static files so the whole app is one server to run.
app.use(express.static(path.join(__dirname, "..", "client")));

const requireAuth = authMiddleware(store);

function publicUser(u) {
  return { id: u.id, display_name: u.display_name, is_admin: u.is_admin, phone: u.phone || null };
}

// ---------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------
app.post("/api/login", async (req, res) => {
  const { id, password } = req.body || {};
  const user = await store.getUser((id || "").trim().toLowerCase());
  if (!checkPassword(user, password)) {
    return res.status(401).json({ error: "Incorrect ID or password." });
  }
  const token = createSession(user.id);
  res.json({ token, user: publicUser(user) });
});

app.post("/api/logout", requireAuth, (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) destroySession(token);
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ---------------------------------------------------------------------
// USERS (for assignee pickers, "send WhatsApp to" dropdowns, etc.)
// ---------------------------------------------------------------------
app.get("/api/users", requireAuth, async (req, res) => {
  const users = await store.listUsers();
  res.json({ users: users.map(publicUser) });
});

// ---------------------------------------------------------------------
// WORKSPACES
// ---------------------------------------------------------------------
app.get("/api/workspaces", requireAuth, async (req, res) => {
  const workspaces = await access.myWorkspaces(store, req.user);
  const withCounts = await Promise.all(workspaces.map(async w => {
    const tasks = await store.listTasks(w.id, { includeArchived: false });
    const members = await store.listMemberships(w.id);
    return { ...w, active_task_count: tasks.length, member_count: members.length };
  }));
  res.json({ workspaces: withCounts });
});

app.get("/api/workspaces/:id/subworkspaces", requireAuth, async (req, res) => {
  const subs = await access.mySubWorkspaces(store, req.user, req.params.id);
  res.json({ workspaces: subs });
});

app.post("/api/workspaces", requireAuth, async (req, res) => {
  const { name, color, parent_id } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Workspace name is required." });

  // If creating a sub-workspace, the parent must be one the user can
  // already see (you can't fork a private workspace under one you
  // don't have access to).
  if (parent_id) {
    const canSeeParent = await access.canAccessWorkspace(store, req.user, parent_id);
    if (!canSeeParent) return res.status(403).json({ error: "You don't have access to that parent workspace." });
  }

  const ws = await store.createWorkspace({
    name: name.trim(),
    color,
    owner_id: req.user.id,
    parent_id: parent_id || null,
  });
  res.status(201).json({ workspace: ws });
});

app.get("/api/workspaces/:id/members", requireAuth, async (req, res) => {
  const ok = await access.canAccessWorkspace(store, req.user, req.params.id);
  if (!ok) return res.status(403).json({ error: "You don't have access to this workspace." });
  const memberIds = await store.listMemberships(req.params.id);
  const allUsers = await store.listUsers();
  const members = allUsers.filter(u => memberIds.includes(u.id));
  res.json({ members });
});

// ---------------------------------------------------------------------
// TASKS
// ---------------------------------------------------------------------
app.get("/api/workspaces/:id/tasks", requireAuth, async (req, res) => {
  const ok = await access.canAccessWorkspace(store, req.user, req.params.id);
  if (!ok) return res.status(403).json({ error: "You don't have access to this workspace." });
  const archived = req.query.archived === "true";
  const tasks = await store.listTasks(req.params.id, { includeArchived: archived });
  res.json({ tasks });
});

app.post("/api/workspaces/:id/tasks", requireAuth, async (req, res) => {
  const ok = await access.canAccessWorkspace(store, req.user, req.params.id);
  if (!ok) return res.status(403).json({ error: "You don't have access to this workspace." });
  const { name, priority, due_date, due_time, status, notes, assignee_ids } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Task name is required." });
  const task = await store.createTask({
    workspace_id: req.params.id,
    name: name.trim(), priority, due_date, due_time, status, notes,
    assignee_ids: assignee_ids || [],
  });
  res.status(201).json({ task });
});

async function taskWorkspaceCheck(req, res) {
  const task = await store.getTask(req.params.taskId);
  if (!task) { res.status(404).json({ error: "Task not found." }); return null; }
  const ok = await access.canAccessWorkspace(store, req.user, task.workspace_id);
  if (!ok) { res.status(403).json({ error: "You don't have access to this workspace." }); return null; }
  return task;
}

app.patch("/api/tasks/:taskId", requireAuth, async (req, res) => {
  const task = await taskWorkspaceCheck(req, res);
  if (!task) return;
  const allowed = ["name", "priority", "due_date", "due_time", "status", "notes", "attachments", "assignee_ids"];
  const patch = {};
  for (const key of allowed) if (key in req.body) patch[key] = req.body[key];
  const updated = await store.updateTask(req.params.taskId, patch);
  res.json({ task: updated });
});

app.post("/api/tasks/:taskId/archive", requireAuth, async (req, res) => {
  const task = await taskWorkspaceCheck(req, res);
  if (!task) return;
  const updated = await store.updateTask(req.params.taskId, { archived_at: new Date().toISOString().slice(0, 10) });
  res.json({ task: updated });
});

app.post("/api/tasks/:taskId/restore", requireAuth, async (req, res) => {
  const task = await taskWorkspaceCheck(req, res);
  if (!task) return;
  const updated = await store.updateTask(req.params.taskId, { archived_at: null });
  res.json({ task: updated });
});

// ---------------------------------------------------------------------
// WHATSAPP POKES
// A poke does not call any WhatsApp API - it logs that a nudge was
// sent and hands back a wa.me link for the client to open, which
// launches WhatsApp Web/the WhatsApp app with the message pre-filled.
// Works for ANY member of the workspace, not just one hardcoded path.
// ---------------------------------------------------------------------
const MAX_POKES_PER_DAY = 5;

app.get("/api/tasks/:taskId/pokes", requireAuth, async (req, res) => {
  const task = await taskWorkspaceCheck(req, res);
  if (!task) return;
  const pokes = await store.listPokes(req.params.taskId);
  res.json({ pokes });
});

app.post("/api/tasks/:taskId/pokes", requireAuth, async (req, res) => {
  const task = await taskWorkspaceCheck(req, res);
  if (!task) return;
  const { to_user_id } = req.body || {};
  if (!to_user_id) return res.status(400).json({ error: "to_user_id is required." });
  if (!task.assignee_ids.includes(to_user_id)) {
    return res.status(400).json({ error: "That person isn't assigned to this task." });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const existing = await store.listPokes(req.params.taskId);
  const sentTodayByMe = existing.filter(p => p.by_user_id === req.user.id && p.at.slice(0, 10) === todayStr).length;
  if (sentTodayByMe >= MAX_POKES_PER_DAY) {
    return res.status(429).json({ error: `You've reached the limit of ${MAX_POKES_PER_DAY} pokes per day for this task.` });
  }

  const toUser = await store.getUser(to_user_id);
  if (!toUser) return res.status(404).json({ error: "Recipient not found." });

  const poke = await store.createPoke({ task_id: req.params.taskId, by_user_id: req.user.id, to_user_id });
  const message = `Hi ${toUser.display_name}, quick nudge on "${task.name}" - could you take a look? — ${req.user.display_name} via Karyapath`;
  // If we have a phone number, deep-link straight to that contact;
  // otherwise fall back to a generic wa.me share link with the message
  // pre-filled, which still lets the person pick a contact manually.
  const waLink = toUser.phone
    ? `https://wa.me/${toUser.phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  res.status(201).json({ poke, whatsapp_url: waLink, message });
});

// ---------------------------------------------------------------------
// NOTIFICATIONS (in-app alert bell)
// Populated by the background scheduler (lib/scheduler.js), which
// sweeps every 5 minutes and fires the 1d/12h/6h/3h/1h/30m/15m ladder,
// then hourly while still overdue, for any task with a due date/time
// that isn't Done or archived.
// ---------------------------------------------------------------------
app.get("/api/notifications", requireAuth, async (req, res) => {
  const unreadOnly = req.query.unread === "true";
  const notifications = await store.listNotifications(req.user.id, { unreadOnly });
  res.json({ notifications });
});

app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
  const note = await store.markNotificationRead(req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: "Notification not found." });
  res.json({ notification: note });
});

app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
  const count = await store.markAllNotificationsRead(req.user.id);
  res.json({ ok: true, marked: count });
});

// Lets you trigger a sweep immediately (e.g. right after seeding the
// near-future demo task) instead of waiting up to 5 minutes for the
// next scheduled pass. Harmless to call any time - it's the exact same
// sweep the scheduler runs automatically.
app.post("/api/dev/run-alert-sweep", async (req, res) => {
  await scheduler.runNow();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// DEV-ONLY: reset local store back to seed data
// ---------------------------------------------------------------------
app.post("/api/dev/reset", async (req, res) => {
  if (useSupabase) return res.status(400).json({ error: "Reset isn't available on the Supabase backend - re-run schema.sql + seed-supabase.js manually." });
  await store.resetToSeed();
  res.json({ ok: true });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, backend: store.kind });
});

const PORT = process.env.PORT || 4000;
const scheduler = startScheduler(store);
app.listen(PORT, () => {
  console.log(`Karyapath server running on http://localhost:${PORT}`);
  console.log(`Storage backend: ${store.kind}${useSupabase ? "" : " (set SUPABASE_URL + SUPABASE_SERVICE_KEY in .env to switch to Postgres)"}`);
  console.log(`Alert scheduler running - checking due dates every 5 minutes.`);
});
