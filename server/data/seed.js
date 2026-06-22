// Seed data shared by both storage backends (local JSON file and
// Supabase). This is the single source of truth for "what does a fresh
// install look like" - edit here, not in store-local.js or the seed SQL.

function isoDaysFromToday(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const USERS = [
  { id: "admin", password: "admin", display_name: "Admin", is_admin: true, phone: null },

  // PSIPL
  { id: "rajat", password: "rajat", display_name: "Rajat", is_admin: false, phone: "+919820011111" },
  { id: "amit", password: "amit", display_name: "Amit", is_admin: false, phone: "+919820022222" },
  { id: "reema", password: "reema", display_name: "Reema", is_admin: false, phone: "+919820033333" },

  // SEPL
  { id: "kanu", password: "kanu", display_name: "Kanu", is_admin: false, phone: "+919820044444" },
  { id: "praveen", password: "praveen", display_name: "Praveen", is_admin: false, phone: "+919820055555" },
  { id: "sales", password: "sales", display_name: "Sales", is_admin: false, phone: "+919820066666" },
  { id: "accounts", password: "accounts", display_name: "Accounts", is_admin: false, phone: "+919820077777" },

  // Gaurav
  { id: "gaurav", password: "gaurav", display_name: "Gaurav", is_admin: false, phone: "+919820088888" },
];

// Workspaces: admin can see/manage all three (handled in access.js via
// is_admin, not by membership rows) - PSIPL and SEPL are owned by the
// first member added so "who created it" has a sensible answer, Gaurav
// owns his own workspace.
const WORKSPACES = [
  { id: 1, name: "PSIPL", color: "#5b93ff", owner_id: "rajat", parent_id: null },
  { id: 2, name: "SEPL", color: "#e3a83c", owner_id: "kanu", parent_id: null },
  { id: 3, name: "Gaurav", color: "#8b6ce0", owner_id: "gaurav", parent_id: null },
];

const MEMBERSHIPS = [
  { workspace_id: 1, user_id: "rajat" },
  { workspace_id: 1, user_id: "amit" },
  { workspace_id: 1, user_id: "reema" },

  { workspace_id: 2, user_id: "kanu" },
  { workspace_id: 2, user_id: "praveen" },
  { workspace_id: 2, user_id: "sales" },
  { workspace_id: 2, user_id: "accounts" },

  { workspace_id: 3, user_id: "gaurav" },
];

function hoursFromNowClock(hours) {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  return d.toTimeString().slice(0, 5); // "HH:MM"
}
function hoursFromNowDate(hours) {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

const TASKS = [
  // PSIPL sample tasks
  { id: 1, workspace_id: 1, name: "Finalize vendor contract", priority: "High", due_date: isoDaysFromToday(2), due_time: "17:00", status: "In progress", notes: "Waiting on legal review.", attachments: 1, archived_at: null, assignee_ids: ["rajat"] },
  { id: 2, workspace_id: 1, name: "Onboard new hire", priority: "Medium", due_date: isoDaysFromToday(5), due_time: "10:00", status: "Ready to start", notes: "", attachments: 0, archived_at: null, assignee_ids: ["amit"] },
  { id: 3, workspace_id: 1, name: "Renew office lease", priority: "High", due_date: isoDaysFromToday(-3), due_time: "17:00", status: "Ready to start", notes: "Overdue - landlord needs signed copy.", attachments: 0, archived_at: null, assignee_ids: ["reema"] },
  { id: 4, workspace_id: 1, name: "Q2 expense report", priority: "Low", due_date: null, due_time: null, status: "Done", notes: "Submitted to accounts.", attachments: 1, archived_at: null, assignee_ids: ["amit", "reema"] },

  // SEPL sample tasks
  { id: 5, workspace_id: 2, name: "Pack festival orders", priority: "High", due_date: isoDaysFromToday(1), due_time: "18:00", status: "Ready to start", notes: "300 boxes need to ship before the weekend.", attachments: 1, archived_at: null, assignee_ids: ["kanu", "praveen"] },
  { id: 6, workspace_id: 2, name: "Renew shop license", priority: "High", due_date: isoDaysFromToday(-5), due_time: "17:00", status: "Ready to start", notes: "Overdue - call the municipal office.", attachments: 0, archived_at: null, assignee_ids: ["kanu"] },
  { id: 7, workspace_id: 2, name: "Chase pending invoices", priority: "Medium", due_date: isoDaysFromToday(3), due_time: "12:00", status: "Waiting for review", notes: "", attachments: 0, archived_at: null, assignee_ids: ["accounts"] },
  { id: 8, workspace_id: 2, name: "Update price list", priority: "Low", due_date: null, due_time: null, status: "Done", notes: "Sent to all retailers.", attachments: 0, archived_at: null, assignee_ids: ["sales"] },
  { id: 9, workspace_id: 2, name: "Follow up with distributor", priority: "Medium", due_date: isoDaysFromToday(4), due_time: "15:00", status: "In progress", notes: "", attachments: 0, archived_at: null, assignee_ids: ["sales"] },
  // Due in ~20 minutes from server start, so the 15-min alert fires
  // soon after you run the seed - useful for seeing the bell light up
  // without waiting hours.
  { id: 12, workspace_id: 2, name: "Demo: alert escalation task", priority: "High", due_date: hoursFromNowDate(0.33), due_time: hoursFromNowClock(0.33), status: "Ready to start", notes: "Seeded with a near-future due time so you can watch the alert thresholds fire.", attachments: 0, archived_at: null, assignee_ids: ["kanu"] },

  // Gaurav sample tasks
  { id: 10, workspace_id: 3, name: "Renew passport", priority: "Medium", due_date: isoDaysFromToday(12), due_time: "11:00", status: "Ready to start", notes: "Appointment needed at regional office.", attachments: 0, archived_at: null, assignee_ids: ["gaurav"] },
  { id: 11, workspace_id: 3, name: "Pay electricity bill", priority: "High", due_date: isoDaysFromToday(-2), due_time: "17:00", status: "Ready to start", notes: "", attachments: 0, archived_at: null, assignee_ids: ["gaurav"] },
];

module.exports = { USERS, WORKSPACES, MEMBERSHIPS, TASKS, isoDaysFromToday };
