/* =========================================================
   KARYAPATH CLIENT
   Talks to the Express API in ../server instead of holding data in
   memory. Every render function that used to read a local `DB` object
   now calls `api.*` and awaits a real HTTP response.
   ========================================================= */

const API_BASE = "";

let session = {
  token: localStorage.getItem("karyapath_token") || null,
  user: null,
};

// ---------------------------------------------------------------------
// API CLIENT
// ---------------------------------------------------------------------
async function apiCall(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const api = {
  login: (id, password) => apiCall("POST", "/login", { id, password }),
  logout: () => apiCall("POST", "/logout"),
  me: () => apiCall("GET", "/me"),
  health: () => apiCall("GET", "/health"),
  users: () => apiCall("GET", "/users"),
  workspaces: () => apiCall("GET", "/workspaces"),
  subWorkspaces: (id) => apiCall("GET", `/workspaces/${id}/subworkspaces`),
  createWorkspace: (data) => apiCall("POST", "/workspaces", data),
  members: (id) => apiCall("GET", `/workspaces/${id}/members`),
  tasks: (id, archived) => apiCall("GET", `/workspaces/${id}/tasks${archived ? "?archived=true" : ""}`),
  createTask: (wsId, data) => apiCall("POST", `/workspaces/${wsId}/tasks`, data),
  updateTask: (taskId, patch) => apiCall("PATCH", `/tasks/${taskId}`, patch),
  archiveTask: (taskId) => apiCall("POST", `/tasks/${taskId}/archive`),
  restoreTask: (taskId) => apiCall("POST", `/tasks/${taskId}/restore`),
  pokes: (taskId) => apiCall("GET", `/tasks/${taskId}/pokes`),
  createPoke: (taskId, toUserId) => apiCall("POST", `/tasks/${taskId}/pokes`, { to_user_id: toUserId }),
  notifications: (unreadOnly) => apiCall("GET", `/notifications${unreadOnly ? "?unread=true" : ""}`),
  markNotificationRead: (id) => apiCall("POST", `/notifications/${id}/read`),
  markAllNotificationsRead: () => apiCall("POST", "/notifications/read-all"),
};

// ---------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------
let state = {
  screen: { name: "dashboard", workspaceId: null },
  openMenuTaskId: null,
  switcherOpen: false,
  authView: "login",
  allUsers: [], // cached after login, used for avatars/names without refetching constantly
};

const STAGES = ["Ready to start", "In progress", "Waiting for review", "Done"];

// ---------------------------------------------------------------------
// ICONS (same minimal set as before)
// ---------------------------------------------------------------------
const ICONS = {
  search: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
  plus: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  users: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3.2 3.2 0 0 1 0 6.2"/><path d="M16.5 14.3a5.5 5.5 0 0 1 4 5.7"/></svg>',
  more: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18.5" r="1.3"/></svg>',
  edit: '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19.5 8.5a2 2 0 0 0-4-4L4 16z"/><path d="M14.5 6 18 9.5"/></svg>',
  archive: '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4" width="17" height="4" rx="1"/><path d="M5 8v10.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V8"/><path d="M10 13h4"/></svg>',
  restore: '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3"/><path d="M3 3.5v5h5"/></svg>',
  paperclip: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.1l-9 9a4.5 4.5 0 0 1-6.4-6.4l9-9a3 3 0 0 1 4.3 4.3l-8.5 8.5a1.5 1.5 0 0 1-2.1-2.1l7.8-7.8"/></svg>',
  calendar: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M16 3v4M8 3v4M3.5 9.5h17"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  inbox: '<svg class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  lock: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="11" width="15" height="8.5" rx="1.8"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  whatsapp: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.6-.8-1.9-.9-.2-.1-.4-.1-.6.1-.2.2-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.6-.8-2.6-1.4-3.7-3.1-.3-.4 0-.4.3-.8.2-.2.3-.4.1-.6-.1-.2-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4-.2 0-.4 0-.6.1-.2.1-.9.4-1.3 1.4-.4 1-.1 2.1.5 3 1.2 1.9 2.5 3.1 4.5 4 1.8.8 2.6.7 3.2.6.7-.1 1.6-.6 1.8-1.3.2-.6.2-1.2.1-1.3-.1-.2-.2-.2-.5-.1zM12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.6 1.5 5.1L2.1 22l5-1.3C8.5 21.5 10.2 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>',
  history: '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v4.5l3 2"/></svg>',
  alert: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01M10.3 3.9L2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  table: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 10h17M9.5 4.5v15"/></svg>',
  kanban: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M9 4.5v15M15 4.5v15"/></svg>',
  dashboard: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 12l3.5-3.5"/></svg>',
  integrate: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.3"/><circle cx="6" cy="18" r="2.3"/><circle cx="18" cy="12" r="2.3"/><path d="M8 6.8L16 11M8 17.2L16 13"/></svg>',
  automate: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 13.5h6L9 22l9-11.5h-6z"/></svg>',
  comment: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5h16v11H9l-4 4v-4H4z"/></svg>',
  bell: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9.5a6 6 0 0 1 12 0c0 3.2 1 4.7 1.8 5.8.2.3 0 .7-.4.7H4.6c-.4 0-.6-.4-.4-.7C5 14.2 6 12.7 6 9.5Z"/><path d="M9.5 19a2.5 2.5 0 0 0 5 0"/></svg>',
};

function stageClass(stage) {
  return stage === "Done" ? "pill-completed"
    : stage === "Waiting for review" ? "pill-review"
    : stage === "In progress" ? "pill-progress"
    : "pill-pending";
}

// ---------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function isOverdue(t) { return t.due_date && t.status !== "Done" && t.due_date < todayISO(); }
function userById(id) { return state.allUsers.find(u => u.id === id) || { id, display_name: id, is_admin: false }; }
function initials(name) {
  const parts = String(name).trim().split(/\s+/);
  return (parts[0]?.[0] || "").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
}
const AVATAR_COLORS = ["#5b93ff", "#3ecf8e", "#e3a83c", "#8b6ce0", "#f0695f", "#3ab8c9"];
function colorForUser(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}
function avatarHtml(userId) {
  const u = userById(userId);
  return `<span class="avatar" style="background:${colorForUser(u.id)}" title="${escapeHtml(u.display_name)}">${initials(u.display_name)}</span>`;
}
function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}
function emptyState(iconKey, message) {
  return `<div class="empty-state">${ICONS[iconKey] || ""}<p>${escapeHtml(message)}</p></div>`;
}
function showToast(message, opts = {}) {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = "toast" + (opts.isError ? " error" : "");
  el.innerHTML = `${opts.isError ? "" : ICONS.check} <span>${escapeHtml(message)}</span>`;
  root.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
  setTimeout(() => {
    el.style.opacity = "0"; el.style.transform = "translateY(10px)";
    setTimeout(() => el.remove(), 250);
  }, 2600);
}
function closeModal() { document.getElementById("modal-root").innerHTML = ""; }

async function withErrorToast(promiseFn) {
  try {
    return await promiseFn();
  } catch (e) {
    showToast(e.message || "Something went wrong.", { isError: true });
    throw e;
  }
}

// ---------------------------------------------------------------------
// NAVIGATION
// ---------------------------------------------------------------------
function navigate(screen, workspaceId) {
  state.screen = { name: screen, workspaceId: workspaceId || null };
  render();
}

// ---------------------------------------------------------------------
// AUTH SCREEN
// ---------------------------------------------------------------------
function renderAuth() {
  const root = document.getElementById("auth-root");
  root.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-logo-row"><span>कार्यपथ</span></div>
        <div class="auth-title">Sign in</div>
        <p class="auth-subtitle">Enter the ID and password your admin gave you.</p>
        <div class="field">
          <label for="login-id">ID</label>
          <input id="login-id" type="text" placeholder="e.g. rajat" autocomplete="username" autofocus />
        </div>
        <div class="field" style="margin-bottom:6px;">
          <label for="login-pass">Password</label>
          <input id="login-pass" type="password" placeholder="••••••••" autocomplete="current-password" />
        </div>
        <div id="login-error"></div>
        <button class="btn btn-primary btn-block" id="login-submit">Sign in</button>
      </div>
    </div>`;

  async function attemptLogin() {
    const id = document.getElementById("login-id").value.trim().toLowerCase();
    const password = document.getElementById("login-pass").value;
    const errBox = document.getElementById("login-error");
    errBox.innerHTML = "";
    if (!id || !password) { errBox.innerHTML = `<p class="error-text">Enter both an ID and a password.</p>`; return; }
    try {
      const { token, user } = await api.login(id, password);
      session.token = token;
      session.user = user;
      localStorage.setItem("karyapath_token", token);
      const { users } = await api.users();
      state.allUsers = users;
      document.getElementById("auth-root").style.display = "none";
      document.getElementById("app-root").style.display = "";
      navigate("dashboard");
      showToast(`Welcome back, ${user.display_name}.`);
      refreshNotifBadge();
    } catch (e) {
      errBox.innerHTML = `<p class="error-text">${escapeHtml(e.message)}</p>`;
    }
  }
  document.getElementById("login-submit").onclick = attemptLogin;
  document.getElementById("login-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") attemptLogin(); });
}

async function logout() {
  try { await api.logout(); } catch (e) { /* ignore - we're logging out regardless */ }
  session = { token: null, user: null };
  localStorage.removeItem("karyapath_token");
  document.getElementById("app-root").style.display = "none";
  document.getElementById("auth-root").style.display = "";
  renderAuth();
}

// Try to resume a session from a stored token on page load.
async function tryResumeSession() {
  if (!session.token) return false;
  try {
    const { user } = await api.me();
    session.user = user;
    const { users } = await api.users();
    state.allUsers = users;
    return true;
  } catch (e) {
    session.token = null;
    localStorage.removeItem("karyapath_token");
    return false;
  }
}

// ---------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------
async function renderDashboard() {
  document.getElementById("topbar-title").textContent = "कार्यपथ";
  document.getElementById("page-content").innerHTML = `<div class="empty-state">${ICONS.dashboard}<p>Loading workspaces…</p></div>`;

  const { workspaces } = await withErrorToast(() => api.workspaces());

  const cards = workspaces.map(w => {
    const isOwner = w.owner_id === session.user.id;
    const roleTag = isOwner
      ? `<span class="workspace-role-tag">Owner</span>`
      : `<span class="workspace-role-tag shared">${session.user.is_admin ? "Admin access" : "Shared"}</span>`;
    return `
      <div class="workspace-card" data-ws="${w.id}">
        ${roleTag}
        <div class="workspace-card-top">
          <span class="category-dot-lg" style="background:${w.color}"></span>
          <h3>${escapeHtml(w.name)}</h3>
        </div>
        <div class="workspace-card-stats">
          <div><div class="workspace-card-stat-num">${w.active_task_count}</div><div class="workspace-card-stat-label">Active tasks</div></div>
          <div><div class="workspace-card-stat-num">${w.member_count}</div><div class="workspace-card-stat-label">${w.member_count === 1 ? "Member" : "Members"}</div></div>
        </div>
      </div>`;
  }).join("");

  document.getElementById("page-content").innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-eyebrow">Overview</div>
        <h1 class="page-title">Your workspaces</h1>
        <p class="page-subtitle">Each workspace keeps its own tasks. Workspaces can be added any time, but once created they stay — there's no delete, so your history is always safe.</p>
      </div>
      <div class="page-actions-row">
        <button class="btn btn-primary btn-block" id="btn-new-workspace">${ICONS.plus} New workspace</button>
      </div>
    </div>
    ${workspaces.length ? `<div class="workspace-grid">${cards}</div>` : emptyState("inbox", "No workspaces yet.")}
    ${workspaces.length ? `<div class="workspace-locked-note">${ICONS.lock} Workspaces can't be deleted, only created — so nothing is ever lost by accident.</div>` : ""}
  `;

  document.querySelectorAll(".workspace-card").forEach(el => {
    el.onclick = () => navigate("category", Number(el.dataset.ws));
  });
  document.getElementById("btn-new-workspace").onclick = () => openAddWorkspaceModal();
  renderStickyBar(null);
}

// ---------------------------------------------------------------------
// WORKSPACE DETAIL (Kanban board)
// ---------------------------------------------------------------------
async function renderCategory() {
  const wsId = state.screen.workspaceId;
  document.getElementById("page-content").innerHTML = `<div class="empty-state">${ICONS.kanban}<p>Loading board…</p></div>`;

  let tasks, allWorkspaces;
  try {
    [tasks, allWorkspaces] = await Promise.all([
      api.tasks(wsId).then(r => r.tasks),
      api.workspaces().then(r => r.workspaces),
    ]);
  } catch (e) {
    showToast(e.message || "You don't have access to that workspace.", { isError: true });
    navigate("dashboard");
    return;
  }

  // Workspace metadata isn't in the active-workspaces list if it's a
  // private sub-workspace, so fetch members (which also confirms
  // access) to get name/color/parent context for the header.
  let ws = allWorkspaces.find(w => w.id === wsId);
  let parent = null;
  if (!ws) {
    // It's a sub-workspace or otherwise not top-level for this user;
    // members endpoint will 403 if truly inaccessible.
    const subsOfEach = await Promise.all(allWorkspaces.map(w => api.subWorkspaces(w.id).then(r => r.workspaces).catch(() => [])));
    for (let i = 0; i < allWorkspaces.length; i++) {
      const found = subsOfEach[i].find(s => s.id === wsId);
      if (found) { ws = found; parent = allWorkspaces[i]; break; }
    }
  }
  if (!ws) { navigate("dashboard"); return; }

  document.getElementById("topbar-title").textContent = ws.name;
  const overdueCount = tasks.filter(isOverdue).length;

  document.getElementById("page-content").innerHTML = `
    <div class="page-header">
      <div>
        ${parent ? `<a href="#" id="back-to-parent-link" style="display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:600;color:var(--ink-faint);margin-bottom:6px;">← Back to ${escapeHtml(parent.name)}</a>` : ""}
        <div class="page-eyebrow">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${ws.color}"></span> Workspace
          ${ws.parent_id ? `<span class="ws-switcher-private-tag" style="margin-left:6px;">${ICONS.lock} Private — only you can see this</span>` : ""}
        </div>
        <h1 class="page-title">${escapeHtml(ws.name)}</h1>
      </div>
      <div class="page-actions-row">
        <a href="#" class="btn btn-secondary" id="btn-archive-link">${ICONS.archive} Archive</a>
        ${ws.parent_id ? "" : `<button class="btn btn-secondary" id="btn-share">${ICONS.users} Members</button>`}
        <button class="btn btn-primary" id="btn-new-task">${ICONS.plus} New task</button>
      </div>
    </div>

    <div class="board-tabs">
      <button class="board-tab" disabled title="Not built in this demo">${ICONS.table} Main table</button>
      <button class="board-tab active">${ICONS.kanban} Kanban</button>
      <button class="board-tab" disabled title="Not built in this demo">${ICONS.dashboard} Dashboard</button>
      <button class="board-tab board-tab-add" disabled title="Not built in this demo">${ICONS.plus}</button>
      <div class="board-tabs-spacer"></div>
      <button class="board-tab board-tab-ghost" disabled title="Not built in this demo">${ICONS.integrate} Integrate</button>
      <button class="board-tab board-tab-ghost" disabled title="Not built in this demo">${ICONS.automate} Automate</button>
    </div>

    ${overdueCount ? `<div class="board-overdue-flag">${ICONS.alert} <strong>${overdueCount}</strong> overdue task${overdueCount > 1 ? "s" : ""} on this board</div>` : ""}

    ${tasks.length ? renderKanbanBoard(tasks, ws) : emptyState("inbox", "No tasks yet. Create your first one.")}
  `;

  document.getElementById("btn-new-task").onclick = () => openTaskModal(ws, null);
  const shareBtn = document.getElementById("btn-share");
  if (shareBtn) shareBtn.onclick = () => openMembersModal(ws);
  document.getElementById("btn-archive-link").onclick = (e) => { e.preventDefault(); navigate("archive", ws.id); };
  const backLink = document.getElementById("back-to-parent-link");
  if (backLink) backLink.onclick = (e) => { e.preventDefault(); navigate("category", parent.id); };
  attachKanbanHandlers(ws);
  renderStickyBar(ws);
}

function renderKanbanBoard(tasks, ws) {
  const columns = STAGES.map(stage => {
    const colTasks = tasks
      .filter(t => t.status === stage)
      .sort((a, b) => {
        const ao = isOverdue(a) ? 0 : 1, bo = isOverdue(b) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });

    const cards = colTasks.map(t => {
      const overdue = isOverdue(t);
      const priorityClass = t.priority === "High" ? "pill-high" : t.priority === "Low" ? "pill-low" : "pill-medium";
      const avatars = t.assignee_ids.length
        ? `<div class="avatar-stack">${t.assignee_ids.map(id => avatarHtml(id)).join("")}</div>`
        : `<span class="avatar-stack-empty">—</span>`;
      return `
        <div class="kanban-card ${overdue ? "is-overdue" : ""}" data-task="${t.id}" draggable="true">
          <div class="kanban-card-title">${escapeHtml(t.name)}</div>
          <div class="kanban-card-pills">
            ${overdue ? `<span class="overdue-pill">OVERDUE</span>` : ""}
            <span class="pill ${priorityClass}">${t.priority}</span>
          </div>
          <div class="kanban-card-foot">
            ${avatars}
            <div class="kanban-card-foot-stats">
              ${t.due_date ? `<span class="meta-chip">${ICONS.calendar}${t.due_date.slice(5)}</span>` : ""}
              ${t.attachments ? `<span class="meta-chip">${ICONS.paperclip}${t.attachments}</span>` : ""}
              <button class="quick-action-btn" data-action="menu" aria-label="More actions">${ICONS.more}</button>
            </div>
          </div>
          ${state.openMenuTaskId === t.id ? `
            <div class="row-menu kanban-row-menu">
              <button data-action="whatsapp" class="whatsapp-item">${ICONS.whatsapp} Poke on WhatsApp</button>
              <button data-action="edit">${ICONS.edit} Edit task</button>
              <button data-action="history">${ICONS.history} Activity log</button>
              <button data-action="archive" class="danger-item">${ICONS.archive} Move to archive</button>
            </div>` : ""}
        </div>`;
    }).join("");

    return `
      <div class="kanban-column" data-stage="${escapeHtml(stage)}">
        <div class="kanban-column-head kanban-head-${stage.replace(/\s+/g, "-").toLowerCase()}">
          <span>${escapeHtml(stage)}</span>
          <span class="kanban-column-count">${colTasks.length}</span>
        </div>
        <div class="kanban-column-body" data-dropzone="${escapeHtml(stage)}">
          ${cards || `<div class="kanban-empty-col">No tasks here</div>`}
        </div>
      </div>`;
  }).join("");

  return `<div class="kanban-board">${columns}</div>`;
}

function attachKanbanHandlers(ws) {
  document.querySelectorAll(".kanban-card").forEach(card => {
    const taskId = Number(card.dataset.task);

    card.querySelectorAll('[data-action="menu"]').forEach(btn => btn.onclick = (e) => {
      e.stopPropagation();
      state.openMenuTaskId = state.openMenuTaskId === taskId ? null : taskId;
      renderCategory();
    });
    card.querySelectorAll('[data-action="edit"]').forEach(btn => btn.onclick = async (e) => {
      e.stopPropagation(); state.openMenuTaskId = null;
      const { tasks } = await api.tasks(ws.id);
      openTaskModal(ws, tasks.find(t => t.id === taskId));
    });
    card.querySelectorAll('[data-action="archive"]').forEach(btn => btn.onclick = (e) => {
      e.stopPropagation(); state.openMenuTaskId = null; openArchiveConfirm(ws, taskId);
    });
    card.querySelectorAll('[data-action="whatsapp"]').forEach(btn => btn.onclick = async (e) => {
      e.stopPropagation(); state.openMenuTaskId = null;
      const { tasks } = await api.tasks(ws.id);
      openWhatsAppPokeModal(ws, tasks.find(t => t.id === taskId));
    });
    card.querySelectorAll('[data-action="history"]').forEach(btn => btn.onclick = async (e) => {
      e.stopPropagation(); state.openMenuTaskId = null;
      openActivityLogModal(ws, taskId);
    });
    card.addEventListener("click", async (e) => {
      if (e.target.closest('.quick-action-btn, .row-menu')) return;
      const { tasks } = await api.tasks(ws.id);
      openTaskModal(ws, tasks.find(t => t.id === taskId));
    });

    card.addEventListener("dragstart", (e) => {
      card.classList.add("is-dragging");
      e.dataTransfer.setData("text/plain", String(taskId));
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => card.classList.remove("is-dragging"));
  });

  document.querySelectorAll(".kanban-column-body").forEach(zone => {
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("is-drop-target"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-drop-target"));
    zone.addEventListener("drop", async (e) => {
      e.preventDefault();
      zone.classList.remove("is-drop-target");
      const taskId = Number(e.dataTransfer.getData("text/plain"));
      const newStage = zone.dataset.dropzone;
      try {
        await api.updateTask(taskId, { status: newStage });
        showToast(`Task moved to ${newStage}.`);
        renderCategory();
      } catch (err) {
        showToast(err.message, { isError: true });
      }
    });
  });

  document.addEventListener("click", closeMenuOnOutsideClick);
}
function closeMenuOnOutsideClick(e) {
  if (state.openMenuTaskId !== null && !e.target.closest(".row-menu") && !e.target.closest('[data-action="menu"]')) {
    state.openMenuTaskId = null;
    document.removeEventListener("click", closeMenuOnOutsideClick);
    if (state.screen.name === "category") renderCategory();
  }
}

function renderStickyBar(ws) {
  const root = document.getElementById("sticky-bar-root");
  if (!ws) { root.innerHTML = ""; return; }
  root.innerHTML = `
    <div class="sticky-action-bar">
      <button class="btn btn-primary btn-block" id="sticky-new-task">${ICONS.plus} New task</button>
    </div>`;
  document.getElementById("sticky-new-task").onclick = () => openTaskModal(ws, null);
}

// ---------------------------------------------------------------------
// ARCHIVE
// ---------------------------------------------------------------------
async function renderArchive() {
  const wsId = state.screen.workspaceId;
  document.getElementById("page-content").innerHTML = `<div class="empty-state">${ICONS.archive}<p>Loading archive…</p></div>`;
  let tasks;
  try {
    tasks = (await api.tasks(wsId, true)).tasks;
  } catch (e) {
    showToast(e.message, { isError: true });
    navigate("dashboard");
    return;
  }
  document.getElementById("topbar-title").textContent = "Archive";

  const rows = tasks.map(t => {
    const avatars = t.assignee_ids.length
      ? `<div class="avatar-stack">${t.assignee_ids.map(id => avatarHtml(id)).join("")}</div>`
      : `<span class="avatar-stack-empty">—</span>`;
    const priorityClass = t.priority === "High" ? "pill-high" : t.priority === "Low" ? "pill-low" : "pill-medium";
    const statusClass = stageClass(t.status);
    return `
      <div class="task-card" data-task="${t.id}" style="opacity:0.82;">
        <div class="status-toggle d-col" style="visibility:hidden;"></div>
        <div class="m-card-body">
          <div class="task-row-line">
            <span class="status-toggle" style="visibility:hidden;"></span>
            <div class="task-name-row">
              <span class="task-name">${escapeHtml(t.name)}</span>
              <div class="task-meta-row">
                <span class="pill ${statusClass}">${t.status}</span>
                <span class="pill ${priorityClass}">${t.priority}</span>
              </div>
            </div>
            ${avatars}
            <div class="task-card-quick-actions">
              <button class="quick-action-btn" data-action="restore" aria-label="Restore">${ICONS.restore}</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join("");

  document.getElementById("page-content").innerHTML = `
    <div class="page-header">
      <div>
        <a href="#" id="back-link" style="display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:600;color:var(--ink-faint);margin-bottom:6px;">← Back</a>
        <h1 class="page-title">Archive</h1>
        <p class="page-subtitle">Archived tasks stay here forever — restore any of them any time.</p>
      </div>
    </div>
    ${tasks.length ? `<div class="task-list">${rows}</div>` : emptyState("inbox", "Nothing archived yet.")}
  `;

  document.getElementById("back-link").onclick = (e) => { e.preventDefault(); navigate("category", wsId); };
  document.querySelectorAll('[data-action="restore"]').forEach(btn => {
    btn.onclick = async (e) => {
      const card = e.target.closest(".task-card");
      const taskId = Number(card.dataset.task);
      try {
        await api.restoreTask(taskId);
        showToast("Task restored.");
        renderArchive();
      } catch (err) {
        showToast(err.message, { isError: true });
      }
    };
  });
  renderStickyBar(null);
}

// ---------------------------------------------------------------------
// MODALS
// ---------------------------------------------------------------------
function openAddWorkspaceModal(parentWs) {
  const colors = ["#5b93ff", "#3ecf8e", "#e3a83c", "#f0695f", "#8b6ce0", "#3ab8c9"];
  let selectedColor = colors[0];
  document.getElementById("modal-root").innerHTML = `
    <div class="modal-overlay" id="overlay">
      <div class="modal-box">
        <div class="modal-grabber"></div>
        <h2>${parentWs ? `New private workspace under ${escapeHtml(parentWs.name)}` : "New workspace"}</h2>
        <p class="modal-subtitle">${parentWs
          ? `This stays private to you — no one else in "${escapeHtml(parentWs.name)}" (including its owner) will be able to see or open it.`
          : "Give it a name your team will recognize. Workspaces can't be deleted later."}</p>
        ${parentWs ? `
        <div class="auth-success-box" style="background:var(--surface);color:var(--ink-muted);">
          ${ICONS.lock}<span>Private sub-workspace — visible only to you (${escapeHtml(session.user.display_name)}).</span>
        </div>` : ""}
        <div class="field">
          <label for="ws-name">Workspace name</label>
          <input id="ws-name" placeholder="e.g. PSIPL, SEPL" autofocus />
        </div>
        <div class="field">
          <label>Color</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;" id="color-picker">
            ${colors.map((c, i) => `<button type="button" data-color="${c}" style="width:34px;height:34px;border-radius:50%;background:${c};border:2px solid ${i === 0 ? "var(--ink)" : "transparent"};cursor:pointer;"></button>`).join("")}
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary btn-block" id="save-btn">${parentWs ? "Create private workspace" : "Create workspace"}</button>
          <button class="btn btn-secondary btn-block" id="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>`;
  document.querySelectorAll("#color-picker button").forEach(b => {
    b.onclick = () => {
      selectedColor = b.dataset.color;
      document.querySelectorAll("#color-picker button").forEach(x => x.style.borderColor = "transparent");
      b.style.borderColor = "var(--ink)";
    };
  });
  document.getElementById("cancel-btn").onclick = closeModal;
  document.getElementById("overlay").onclick = (e) => { if (e.target.id === "overlay") closeModal(); };
  document.getElementById("save-btn").onclick = async () => {
    const name = document.getElementById("ws-name").value.trim();
    if (!name) { showToast("Please enter a workspace name.", { isError: true }); return; }
    try {
      const { workspace } = await api.createWorkspace({ name, color: selectedColor, parent_id: parentWs ? parentWs.id : null });
      closeModal();
      showToast(parentWs ? `"${name}" created — private to you.` : `"${name}" created.`);
      navigate("category", workspace.id);
    } catch (e) {
      showToast(e.message, { isError: true });
    }
  };
}

function openTaskModal(ws, task) {
  const isEditing = !!task;
  withErrorToast(() => api.members(ws.id)).then(({ members }) => {
    let selected = new Set(task ? task.assignee_ids : []);
    document.getElementById("modal-root").innerHTML = `
      <div class="modal-overlay" id="overlay">
        <div class="modal-box">
          <div class="modal-grabber"></div>
          <h2>${isEditing ? "Edit task" : "New task"}</h2>
          <div class="field">
            <label for="t-name">Task name</label>
            <input id="t-name" value="${task ? escapeHtml(task.name) : ""}" placeholder="What needs to get done?" autofocus />
          </div>
          <div class="field">
            <label>Assign to</label>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${members.map(m => `
                <label style="display:flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-full);padding:4px 10px 4px 4px;cursor:pointer;">
                  <input type="checkbox" data-assignee="${m.id}" ${selected.has(m.id) ? "checked" : ""} style="margin:0;" />
                  ${avatarHtml(m.id)} <span style="font-size:12.5px;">${escapeHtml(m.display_name)}</span>
                </label>`).join("")}
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="t-priority">Priority</label>
              <select id="t-priority">
                ${["High", "Medium", "Low"].map(p => `<option ${task && task.priority === p ? "selected" : ""}>${p}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="t-due">Due date</label>
              <input id="t-due" type="date" value="${task && task.due_date ? task.due_date : ""}" />
            </div>
          </div>
          <div class="field">
            <label for="t-status">Stage</label>
            <select id="t-status">
              ${STAGES.map(s => `<option ${task && task.status === s ? "selected" : ""}>${s}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="t-notes">Notes</label>
            <textarea id="t-notes" placeholder="Any extra detail…">${task ? escapeHtml(task.notes || "") : ""}</textarea>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary btn-block" id="save-task-btn">${isEditing ? "Save changes" : "Create task"}</button>
            <button class="btn btn-secondary btn-block" id="cancel-btn">Cancel</button>
          </div>
        </div>
      </div>`;

    document.querySelectorAll('[data-assignee]').forEach(cb => {
      cb.onchange = () => { cb.checked ? selected.add(cb.dataset.assignee) : selected.delete(cb.dataset.assignee); };
    });
    document.getElementById("cancel-btn").onclick = closeModal;
    document.getElementById("overlay").onclick = (e) => { if (e.target.id === "overlay") closeModal(); };
    document.getElementById("save-task-btn").onclick = async () => {
      const name = document.getElementById("t-name").value.trim();
      if (!name) { showToast("Please enter a task name.", { isError: true }); return; }
      const payload = {
        name,
        priority: document.getElementById("t-priority").value,
        due_date: document.getElementById("t-due").value || null,
        status: document.getElementById("t-status").value,
        notes: document.getElementById("t-notes").value,
        assignee_ids: [...selected],
      };
      try {
        if (isEditing) {
          await api.updateTask(task.id, payload);
          showToast("Task updated.");
        } else {
          await api.createTask(ws.id, payload);
          showToast("Task created.");
        }
        closeModal();
        if (state.screen.name === "category") renderCategory();
      } catch (e) {
        showToast(e.message, { isError: true });
      }
    };
  });
}

function openArchiveConfirm(ws, taskId) {
  document.getElementById("modal-root").innerHTML = `
    <div class="modal-overlay" id="overlay">
      <div class="modal-box">
        <div class="modal-grabber"></div>
        <h2>Move to archive?</h2>
        <p class="modal-subtitle">You can restore it from the Archive any time — nothing is deleted permanently.</p>
        <div class="modal-actions">
          <button class="btn btn-danger btn-block" id="confirm-btn">${ICONS.archive} Move to archive</button>
          <button class="btn btn-secondary btn-block" id="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>`;
  document.getElementById("cancel-btn").onclick = closeModal;
  document.getElementById("overlay").onclick = (e) => { if (e.target.id === "overlay") closeModal(); };
  document.getElementById("confirm-btn").onclick = async () => {
    try {
      await api.archiveTask(taskId);
      closeModal();
      showToast("Task archived.");
      renderCategory();
    } catch (e) {
      showToast(e.message, { isError: true });
    }
  };
}

function openMembersModal(ws) {
  withErrorToast(() => api.members(ws.id)).then(({ members }) => {
    document.getElementById("modal-root").innerHTML = `
      <div class="modal-overlay" id="overlay">
        <div class="modal-box">
          <div class="modal-grabber"></div>
          <h2>${ICONS.users} Members</h2>
          <p class="modal-subtitle">Members of "${escapeHtml(ws.name)}". Membership is managed by your admin for now.</p>
          ${members.map(m => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
              ${avatarHtml(m.id)}
              <div>
                <div style="font-weight:600;font-size:13.5px;">${escapeHtml(m.display_name)}</div>
                <div style="font-size:11.5px;color:var(--ink-faint);">${escapeHtml(m.id)}${m.is_admin ? " · admin" : ""}</div>
              </div>
            </div>`).join("")}
          <div class="modal-actions">
            <button class="btn btn-secondary btn-block" id="cancel-btn">Close</button>
          </div>
        </div>
      </div>`;
    document.getElementById("cancel-btn").onclick = closeModal;
    document.getElementById("overlay").onclick = (e) => { if (e.target.id === "overlay") closeModal(); };
  });
}

const MAX_POKES_PER_DAY = 5;

function openWhatsAppPokeModal(ws, task) {
  if (!task.assignee_ids.length) {
    showToast("This task has no one assigned yet — add an assignee first.", { isError: true });
    return;
  }
  let selectedAssigneeId = task.assignee_ids[0];

  async function renderBody() {
    const assignee = userById(selectedAssigneeId);
    const { pokes } = await withErrorToast(() => api.pokes(task.id));
    const todayStr = todayISO();
    const sentToday = pokes.filter(p => p.by_user_id === session.user.id && p.at.slice(0, 10) === todayStr).length;
    const remaining = MAX_POKES_PER_DAY - sentToday;
    const blocked = remaining <= 0;
    const lastPoke = pokes.length ? pokes[pokes.length - 1] : null;
    const message = `Hi ${assignee.display_name}, quick nudge on "${task.name}" - could you take a look? — ${session.user.display_name} via Karyapath`;

    document.getElementById("modal-root").innerHTML = `
      <div class="modal-overlay" id="overlay">
        <div class="modal-box">
          <div class="modal-grabber"></div>
          <h2>${ICONS.whatsapp} Poke on WhatsApp</h2>
          <p class="modal-subtitle">Send a quick WhatsApp reminder about "${escapeHtml(task.name)}".</p>

          ${task.assignee_ids.length > 1 ? `
            <div class="field">
              <label for="poke-assignee">Send to</label>
              <select id="poke-assignee">
                ${task.assignee_ids.map(id => `<option value="${id}" ${id === selectedAssigneeId ? "selected" : ""}>${escapeHtml(userById(id).display_name)}</option>`).join("")}
              </select>
            </div>` : `
            <div class="field">
              <label>Sending to</label>
              <div style="display:flex;align-items:center;gap:10px;">
                ${avatarHtml(assignee.id)}
                <span style="font-size:13.5px;font-weight:600;">${escapeHtml(assignee.display_name)}</span>
              </div>
            </div>`}

          <div class="field">
            <label>Message preview</label>
            <div class="wa-preview">${escapeHtml(message)}</div>
          </div>

          ${lastPoke ? `<p class="field-hint">${ICONS.history} Last poked ${timeAgo(lastPoke.at)} by ${escapeHtml(userById(lastPoke.by_user_id).display_name)}.</p>` : ""}
          <p class="field-hint">${remaining > 0 ? `${remaining} of ${MAX_POKES_PER_DAY} pokes left today for this task.` : "Daily poke limit reached for this task."}</p>

          <div class="modal-actions">
            <button class="btn btn-block" id="send-btn" style="background:var(--whatsapp);color:white;" ${blocked ? "disabled" : ""}>${ICONS.whatsapp} ${blocked ? "Limit reached" : "Send on WhatsApp"}</button>
            <button class="btn btn-secondary btn-block" id="cancel-btn">Cancel</button>
          </div>
        </div>
      </div>`;

    const assigneeSelect = document.getElementById("poke-assignee");
    if (assigneeSelect) assigneeSelect.onchange = () => { selectedAssigneeId = assigneeSelect.value; renderBody(); };
    document.getElementById("cancel-btn").onclick = closeModal;
    document.getElementById("overlay").onclick = (e) => { if (e.target.id === "overlay") closeModal(); };
    const sendBtn = document.getElementById("send-btn");
    if (sendBtn && !blocked) sendBtn.onclick = async () => {
      try {
        const result = await api.createPoke(task.id, selectedAssigneeId);
        window.open(result.whatsapp_url, "_blank");
        closeModal();
        showToast(`Poke sent to ${assignee.display_name}.`);
      } catch (e) {
        showToast(e.message, { isError: true });
      }
    };
  }
  renderBody();
}

function openActivityLogModal(ws, taskId) {
  withErrorToast(() => api.pokes(taskId)).then(({ pokes }) => {
    const rows = pokes.length
      ? pokes.slice().reverse().map(p => `
          <div class="activity-row">
            <span class="activity-icon whatsapp">${ICONS.whatsapp}</span>
            <div>
              <div style="font-size:13px;">${escapeHtml(userById(p.by_user_id).display_name)} poked ${escapeHtml(userById(p.to_user_id).display_name)}</div>
              <div style="font-size:11.5px;color:var(--ink-faint);">${timeAgo(p.at)}</div>
            </div>
          </div>`).join("")
      : `<p class="modal-subtitle">No activity logged for this task yet.</p>`;
    document.getElementById("modal-root").innerHTML = `
      <div class="modal-overlay" id="overlay">
        <div class="modal-box">
          <div class="modal-grabber"></div>
          <h2>${ICONS.history} Activity log</h2>
          ${rows}
          <div class="modal-actions">
            <button class="btn btn-secondary btn-block" id="cancel-btn">Close</button>
          </div>
        </div>
      </div>`;
    document.getElementById("cancel-btn").onclick = closeModal;
    document.getElementById("overlay").onclick = (e) => { if (e.target.id === "overlay") closeModal(); };
  });
}

// ---------------------------------------------------------------------
// WORKSPACE SWITCHER (topbar avatar menu)
// ---------------------------------------------------------------------
function openSwitcher() {
  state.switcherOpen = true;
  document.getElementById("ws-switcher-menu").classList.add("open");
  document.addEventListener("click", closeSwitcherOnOutsideClick);
}
function closeSwitcher() {
  state.switcherOpen = false;
  document.getElementById("ws-switcher-menu").classList.remove("open");
  document.removeEventListener("click", closeSwitcherOnOutsideClick);
}
function closeSwitcherOnOutsideClick(e) {
  if (!e.target.closest(".ws-switcher-wrap")) closeSwitcher();
}

async function renderWorkspaceSwitcher() {
  const menu = document.getElementById("ws-switcher-menu");
  const { workspaces } = await api.workspaces();
  const subsByParent = {};
  for (const w of workspaces) {
    subsByParent[w.id] = (await api.subWorkspaces(w.id).catch(() => ({ workspaces: [] }))).workspaces;
  }

  menu.innerHTML = `
    <div class="ws-switcher-user-block">
      <span class="avatar" style="background:${colorForUser(session.user.id)};margin-left:0;">${initials(session.user.display_name)}</span>
      <div>
        <div class="ws-switcher-user-name">${escapeHtml(session.user.display_name)}${session.user.is_admin ? `<span class="ws-switcher-admin-badge">ADMIN</span>` : ""}</div>
        <div class="ws-switcher-user-tag">${escapeHtml(session.user.id)}</div>
      </div>
    </div>
    <div class="ws-switcher-section-label">
      <span>Workspaces</span>
      <button class="ws-switcher-add-btn" id="ws-add-workspace" aria-label="New workspace">${ICONS.plus}</button>
    </div>
    ${workspaces.map(w => {
      const subs = subsByParent[w.id] || [];
      return `
      <button class="ws-switcher-item ${state.screen.name === "category" && state.screen.workspaceId === w.id ? "active" : ""}" data-go="category" data-ws="${w.id}">
        <span class="nav-dot" style="background:${w.color}"></span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(w.name)}</span>
      </button>
      ${subs.map(s => `
        <button class="ws-switcher-item ws-switcher-sub-item ${state.screen.name === "category" && state.screen.workspaceId === s.id ? "active" : ""}" data-go="category" data-ws="${s.id}">
          <span class="nav-dot" style="background:${s.color}"></span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(s.name)}</span>
          <span class="ws-switcher-private-tag" title="Only you can see this workspace">${ICONS.lock} Private</span>
        </button>`).join("")}
      <button class="ws-switcher-item ws-switcher-sub-add" data-add-sub="${w.id}">
        ${ICONS.plus} New private workspace under ${escapeHtml(w.name)}
      </button>`;
    }).join("")}
    <div class="ws-switcher-divider"></div>
    <button class="ws-switcher-item" data-go="archive">${ICONS.archive} Archive</button>
    <div class="ws-switcher-divider"></div>
    <button class="ws-switcher-item" id="ws-logout" style="color:var(--danger);">${ICONS.lock} Log out</button>
  `;

  menu.querySelectorAll('[data-go="category"]').forEach(btn => {
    btn.onclick = () => { closeSwitcher(); navigate("category", Number(btn.dataset.ws)); };
  });
  const archiveBtn = menu.querySelector('[data-go="archive"]');
  if (archiveBtn) archiveBtn.onclick = () => {
    closeSwitcher();
    const wsId = state.screen.workspaceId || (workspaces[0] && workspaces[0].id);
    navigate("archive", wsId);
  };
  document.getElementById("ws-add-workspace").onclick = () => { closeSwitcher(); openAddWorkspaceModal(); };
  menu.querySelectorAll("[data-add-sub]").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const parentWs = workspaces.find(w => w.id === Number(btn.dataset.addSub));
      closeSwitcher();
      openAddWorkspaceModal(parentWs);
    };
  });
  document.getElementById("ws-logout").onclick = () => { closeSwitcher(); logout(); };
}

// ---------------------------------------------------------------------
// NOTIFICATIONS (alert bell)
// ---------------------------------------------------------------------
let notifPanelOpen = false;

async function refreshNotifBadge() {
  try {
    const { notifications } = await api.notifications(true);
    const badge = document.getElementById("notif-badge");
    if (notifications.length > 0) {
      badge.textContent = notifications.length > 9 ? "9+" : String(notifications.length);
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  } catch (e) { /* silent - badge just won't update this cycle */ }
}

function closeNotifPanel() {
  notifPanelOpen = false;
  document.getElementById("notif-panel").classList.remove("open");
  document.removeEventListener("click", closeNotifPanelOnOutsideClick);
}
function closeNotifPanelOnOutsideClick(e) {
  if (!e.target.closest(".notif-wrap")) closeNotifPanel();
}

async function renderNotifPanel() {
  const panel = document.getElementById("notif-panel");
  let notifications;
  try {
    notifications = (await api.notifications()).notifications;
  } catch (e) {
    panel.innerHTML = `<div class="notif-panel-empty">Couldn't load notifications.</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="notif-panel-head">
      <span>Notifications</span>
      ${notifications.some(n => !n.read_at) ? `<button id="notif-mark-all">Mark all read</button>` : ""}
    </div>
    ${notifications.length ? notifications.slice(0, 30).map(n => `
      <div class="notif-row ${n.read_at ? "" : "is-unread"} ${n.threshold_key.startsWith("overdue") ? "is-overdue-alert" : ""}" data-notif="${n.id}">
        <span class="notif-dot"></span>
        <div>
          <div class="notif-text">${escapeHtml(n.message)}</div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
      </div>`).join("") : `<div class="notif-panel-empty">${ICONS.bell}<p style="margin-top:8px;">No notifications yet.</p></div>`}
  `;

  const markAllBtn = document.getElementById("notif-mark-all");
  if (markAllBtn) markAllBtn.onclick = async (e) => {
    e.stopPropagation();
    await api.markAllNotificationsRead();
    refreshNotifBadge();
    renderNotifPanel();
  };
  panel.querySelectorAll("[data-notif]").forEach(row => {
    row.onclick = async () => {
      const id = Number(row.dataset.notif);
      if (row.classList.contains("is-unread")) {
        await api.markNotificationRead(id);
        refreshNotifBadge();
        row.classList.remove("is-unread");
      }
    };
  });
}

document.getElementById("topbar-bell").addEventListener("click", async (e) => {
  e.stopPropagation();
  if (notifPanelOpen) { closeNotifPanel(); return; }
  await renderNotifPanel();
  notifPanelOpen = true;
  document.getElementById("notif-panel").classList.add("open");
  document.addEventListener("click", closeNotifPanelOnOutsideClick);
});

// ---------------------------------------------------------------------
// MAIN RENDER DISPATCH
// ---------------------------------------------------------------------
async function render() {
  document.getElementById("topbar-avatar").style.background = colorForUser(session.user.id);
  document.getElementById("topbar-avatar").textContent = initials(session.user.display_name);

  if (state.screen.name === "dashboard") await renderDashboard();
  else if (state.screen.name === "category") await renderCategory();
  else if (state.screen.name === "archive") await renderArchive();
}

document.getElementById("topbar-avatar").addEventListener("click", async () => {
  if (state.switcherOpen) { closeSwitcher(); return; }
  await renderWorkspaceSwitcher();
  openSwitcher();
});

// ---------------------------------------------------------------------
// BOOT
// ---------------------------------------------------------------------
(async () => {
  try {
    const health = await api.health();
    document.getElementById("backend-kind").textContent = health.backend === "supabase" ? "Supabase / Postgres" : "local JSON file";
  } catch (e) {
    document.getElementById("backend-kind").textContent = "unreachable — is the server running?";
  }

  const resumed = await tryResumeSession();
  if (resumed) {
    document.getElementById("auth-root").style.display = "none";
    document.getElementById("app-root").style.display = "";
    navigate("dashboard");
    refreshNotifBadge();
  } else {
    renderAuth();
  }

  // Poll the unread badge every minute - cheap enough, and means a
  // new alert shows up within a minute of the server's 5-minute sweep
  // firing it, without needing a websocket for this scope of app.
  setInterval(() => { if (session.token) refreshNotifBadge(); }, 60 * 1000);
})();
