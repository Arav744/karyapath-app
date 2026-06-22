// Local JSON-file storage backend.
//
// Implements the same async interface as store-supabase.js, so index.js
// and the route handlers never need to know which one is active. This
// is the default backend - it works the moment you run `npm start`,
// with no external account needed. Swap to Supabase later by setting
// SUPABASE_URL + SUPABASE_SERVICE_KEY in .env; nothing else changes.

const fs = require("fs");
const path = require("path");
const { USERS, WORKSPACES, MEMBERSHIPS, TASKS } = require("../data/seed");

const DB_FILE = path.join(__dirname, "..", "data", "db.json");

function freshSeed() {
  return {
    users: USERS.map(u => ({ ...u })),
    workspaces: WORKSPACES.map(w => ({ ...w })),
    memberships: MEMBERSHIPS.map(m => ({ ...m })),
    tasks: TASKS.map(t => ({ ...t, assignee_ids: [...t.assignee_ids] })),
    pokes: [],
    notifications: [],
    sentAlerts: [], // { task_id, user_id, threshold_key }
    nextTaskId: Math.max(...TASKS.map(t => t.id)) + 1,
    nextWorkspaceId: Math.max(...WORKSPACES.map(w => w.id)) + 1,
    nextPokeId: 1,
    nextNotificationId: 1,
  };
}

function load() {
  if (!fs.existsSync(DB_FILE)) {
    const fresh = freshSeed();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  try {
    const loaded = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    // Backfill fields added after this db.json may have been created,
    // so upgrading the app doesn't require deleting existing data.
    if (!loaded.notifications) loaded.notifications = [];
    if (!loaded.sentAlerts) loaded.sentAlerts = [];
    if (!loaded.nextNotificationId) loaded.nextNotificationId = 1;
    for (const t of loaded.tasks) if (!("due_time" in t)) t.due_time = null;
    return loaded;
  } catch (e) {
    console.error("Failed to read db.json, reseeding:", e.message);
    const fresh = freshSeed();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}

let db = load();

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ---- public interface ----

async function getUser(id) {
  return db.users.find(u => u.id === id) || null;
}

async function listUsers() {
  return db.users.map(({ password, ...rest }) => rest); // never leak passwords
}

async function listWorkspaces() {
  return db.workspaces.map(w => ({ ...w }));
}

async function getWorkspace(id) {
  return db.workspaces.find(w => w.id === Number(id)) || null;
}

async function createWorkspace({ name, color, owner_id, parent_id }) {
  const ws = { id: db.nextWorkspaceId++, name, color: color || "#5b93ff", owner_id, parent_id: parent_id || null };
  db.workspaces.push(ws);
  db.memberships.push({ workspace_id: ws.id, user_id: owner_id });
  persist();
  return ws;
}

async function listMemberships(workspaceId) {
  return db.memberships.filter(m => m.workspace_id === Number(workspaceId)).map(m => m.user_id);
}

async function listAllMemberships() {
  return db.memberships.map(m => ({ ...m }));
}

async function listTasks(workspaceId, { includeArchived = false } = {}) {
  return db.tasks
    .filter(t => t.workspace_id === Number(workspaceId))
    .filter(t => includeArchived ? !!t.archived_at : !t.archived_at)
    .map(t => ({ ...t, assignee_ids: [...t.assignee_ids] }));
}

async function getTask(id) {
  const t = db.tasks.find(t => t.id === Number(id));
  return t ? { ...t, assignee_ids: [...t.assignee_ids] } : null;
}

async function createTask(data) {
  const task = {
    id: db.nextTaskId++,
    workspace_id: Number(data.workspace_id),
    name: data.name,
    priority: data.priority || "Medium",
    due_date: data.due_date || null,
    due_time: data.due_time || null,
    status: data.status || "Ready to start",
    notes: data.notes || "",
    attachments: data.attachments || 0,
    archived_at: null,
    assignee_ids: data.assignee_ids || [],
  };
  db.tasks.push(task);
  persist();
  return task;
}

async function updateTask(id, patch) {
  const task = db.tasks.find(t => t.id === Number(id));
  if (!task) return null;
  Object.assign(task, patch);
  // If the due date/time changed, or the task was marked Done/archived,
  // wipe any previously-sent alerts for it so a NEW due date starts a
  // fresh escalation ladder instead of silently inheriting "already
  // sent 1d/12h/etc" from before the edit.
  if ("due_date" in patch || "due_time" in patch || patch.status === "Done" || "archived_at" in patch) {
    db.sentAlerts = db.sentAlerts.filter(a => a.task_id !== task.id);
  }
  persist();
  return { ...task, assignee_ids: [...task.assignee_ids] };
}

async function deleteTaskPermanently(id) {
  db.tasks = db.tasks.filter(t => t.id !== Number(id));
  db.pokes = db.pokes.filter(p => p.task_id !== Number(id));
  db.notifications = db.notifications.filter(n => n.task_id !== Number(id));
  db.sentAlerts = db.sentAlerts.filter(a => a.task_id !== Number(id));
  persist();
}

async function listPokes(taskId) {
  return db.pokes.filter(p => p.task_id === Number(taskId)).map(p => ({ ...p }));
}

async function createPoke({ task_id, by_user_id, to_user_id }) {
  const poke = { id: db.nextPokeId++, task_id: Number(task_id), by_user_id, to_user_id, at: new Date().toISOString() };
  db.pokes.push(poke);
  persist();
  return poke;
}

async function resetToSeed() {
  db = freshSeed();
  persist();
  return db;
}

// ---- alert scheduler support ----

// Every non-archived, non-Done task across every workspace - the
// scheduler sweep needs the whole set regardless of who's "in" which
// workspace, since alerts are about due dates, not access control.
async function listAllActiveTasks() {
  return db.tasks
    .filter(t => !t.archived_at && t.status !== "Done")
    .map(t => ({ ...t, assignee_ids: [...t.assignee_ids] }));
}

async function getSentAlertKeys(taskId, userId) {
  return new Set(
    db.sentAlerts
      .filter(a => a.task_id === Number(taskId) && a.user_id === userId)
      .map(a => a.threshold_key)
  );
}

async function recordSentAlert(taskId, userId, thresholdKey) {
  db.sentAlerts.push({ task_id: Number(taskId), user_id: userId, threshold_key: thresholdKey, sent_at: new Date().toISOString() });
  persist();
}

async function createNotification({ user_id, task_id, threshold_key, message }) {
  const note = {
    id: db.nextNotificationId++,
    user_id, task_id: Number(task_id), threshold_key, message,
    created_at: new Date().toISOString(),
    read_at: null,
  };
  db.notifications.push(note);
  persist();
  return note;
}

async function listNotifications(userId, { unreadOnly = false } = {}) {
  return db.notifications
    .filter(n => n.user_id === userId)
    .filter(n => unreadOnly ? !n.read_at : true)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(n => ({ ...n }));
}

async function markNotificationRead(id, userId) {
  const note = db.notifications.find(n => n.id === Number(id) && n.user_id === userId);
  if (!note) return null;
  note.read_at = new Date().toISOString();
  persist();
  return { ...note };
}

async function markAllNotificationsRead(userId) {
  const now = new Date().toISOString();
  let count = 0;
  for (const n of db.notifications) {
    if (n.user_id === userId && !n.read_at) { n.read_at = now; count++; }
  }
  if (count) persist();
  return count;
}

module.exports = {
  kind: "local-json",
  getUser, listUsers,
  listWorkspaces, getWorkspace, createWorkspace,
  listMemberships, listAllMemberships,
  listTasks, getTask, createTask, updateTask, deleteTaskPermanently,
  listPokes, createPoke,
  resetToSeed,
  listAllActiveTasks, getSentAlertKeys, recordSentAlert,
  createNotification, listNotifications, markNotificationRead, markAllNotificationsRead,
};
