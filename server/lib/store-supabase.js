// Supabase (Postgres) storage backend.
//
// Implements the exact same async function signatures as store-local.js.
// index.js picks whichever module to use based on whether
// SUPABASE_URL/SUPABASE_SERVICE_KEY are set - nothing in the route
// handlers needs to change either way.
//
// Run server/data/schema.sql in your Supabase project's SQL editor
// before using this backend, and run `node lib/seed-supabase.js` once
// to load the starter users/workspaces/tasks.

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

function unwrap({ data, error }) {
  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data;
}

async function getUser(id) {
  const rows = unwrap(await supabase.from("users").select("*").eq("id", id).limit(1));
  return rows[0] || null;
}

async function listUsers() {
  const rows = unwrap(await supabase.from("users").select("id, display_name, is_admin, phone, created_at"));
  return rows;
}

async function listWorkspaces() {
  return unwrap(await supabase.from("workspaces").select("*"));
}

async function getWorkspace(id) {
  const rows = unwrap(await supabase.from("workspaces").select("*").eq("id", id).limit(1));
  return rows[0] || null;
}

async function createWorkspace({ name, color, owner_id, parent_id }) {
  const rows = unwrap(await supabase.from("workspaces")
    .insert({ name, color: color || "#5b93ff", owner_id, parent_id: parent_id || null })
    .select());
  const ws = rows[0];
  unwrap(await supabase.from("memberships").insert({ workspace_id: ws.id, user_id: owner_id }));
  return ws;
}

async function listMemberships(workspaceId) {
  const rows = unwrap(await supabase.from("memberships").select("user_id").eq("workspace_id", workspaceId));
  return rows.map(r => r.user_id);
}

async function listAllMemberships() {
  return unwrap(await supabase.from("memberships").select("*"));
}

async function listTasks(workspaceId, { includeArchived = false } = {}) {
  let query = supabase.from("tasks").select("*, task_assignees(user_id)").eq("workspace_id", workspaceId);
  query = includeArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const rows = unwrap(await query);
  return rows.map(rowToTask);
}

async function getTask(id) {
  const rows = unwrap(await supabase.from("tasks").select("*, task_assignees(user_id)").eq("id", id).limit(1));
  return rows[0] ? rowToTask(rows[0]) : null;
}

function rowToTask(row) {
  const { task_assignees, ...rest } = row;
  return { ...rest, assignee_ids: (task_assignees || []).map(a => a.user_id) };
}

async function createTask(data) {
  const rows = unwrap(await supabase.from("tasks").insert({
    workspace_id: data.workspace_id,
    name: data.name,
    priority: data.priority || "Medium",
    due_date: data.due_date || null,
    due_time: data.due_time || null,
    status: data.status || "Ready to start",
    notes: data.notes || "",
    attachments: data.attachments || 0,
    archived_at: null,
  }).select());
  const task = rows[0];
  const assigneeIds = data.assignee_ids || [];
  if (assigneeIds.length) {
    unwrap(await supabase.from("task_assignees").insert(assigneeIds.map(uid => ({ task_id: task.id, user_id: uid }))));
  }
  return { ...task, assignee_ids: assigneeIds };
}

async function updateTask(id, patch) {
  const { assignee_ids, ...fields } = patch;
  if (Object.keys(fields).length) {
    unwrap(await supabase.from("tasks").update(fields).eq("id", id));
  }
  if (assignee_ids) {
    unwrap(await supabase.from("task_assignees").delete().eq("task_id", id));
    if (assignee_ids.length) {
      unwrap(await supabase.from("task_assignees").insert(assignee_ids.map(uid => ({ task_id: id, user_id: uid }))));
    }
  }
  // If due date/time changed or the task was completed/archived, clear
  // its alert history so a new due date starts a fresh ladder.
  if ("due_date" in patch || "due_time" in patch || patch.status === "Done" || "archived_at" in patch) {
    unwrap(await supabase.from("sent_alerts").delete().eq("task_id", id));
  }
  return getTask(id);
}

async function deleteTaskPermanently(id) {
  unwrap(await supabase.from("tasks").delete().eq("id", id));
}

async function listPokes(taskId) {
  return unwrap(await supabase.from("pokes").select("*").eq("task_id", taskId));
}

async function createPoke({ task_id, by_user_id, to_user_id }) {
  const rows = unwrap(await supabase.from("pokes").insert({ task_id, by_user_id, to_user_id }).select());
  return rows[0];
}

async function resetToSeed() {
  throw new Error("resetToSeed is not implemented for the Supabase backend - re-run schema.sql and the seed script manually instead.");
}

// ---- alert scheduler support ----

async function listAllActiveTasks() {
  const rows = unwrap(await supabase.from("tasks")
    .select("*, task_assignees(user_id)")
    .is("archived_at", null)
    .neq("status", "Done"));
  return rows.map(rowToTask);
}

async function getSentAlertKeys(taskId, userId) {
  const rows = unwrap(await supabase.from("sent_alerts").select("threshold_key").eq("task_id", taskId).eq("user_id", userId));
  return new Set(rows.map(r => r.threshold_key));
}

async function recordSentAlert(taskId, userId, thresholdKey) {
  unwrap(await supabase.from("sent_alerts").insert({ task_id: taskId, user_id: userId, threshold_key: thresholdKey }));
}

async function createNotification({ user_id, task_id, threshold_key, message }) {
  const rows = unwrap(await supabase.from("notifications").insert({ user_id, task_id, threshold_key, message }).select());
  return rows[0];
}

async function listNotifications(userId, { unreadOnly = false } = {}) {
  let query = supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (unreadOnly) query = query.is("read_at", null);
  return unwrap(await query);
}

async function markNotificationRead(id, userId) {
  const rows = unwrap(await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).select());
  return rows[0] || null;
}

async function markAllNotificationsRead(userId) {
  const rows = unwrap(await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null).select());
  return rows.length;
}

module.exports = {
  kind: "supabase",
  getUser, listUsers,
  listWorkspaces, getWorkspace, createWorkspace,
  listMemberships, listAllMemberships,
  listTasks, getTask, createTask, updateTask, deleteTaskPermanently,
  listPokes, createPoke,
  resetToSeed,
  listAllActiveTasks, getSentAlertKeys, recordSentAlert,
  createNotification, listNotifications, markNotificationRead, markAllNotificationsRead,
};
