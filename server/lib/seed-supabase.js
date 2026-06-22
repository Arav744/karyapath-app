// Run once against a fresh Supabase project (after running schema.sql)
// to load the starter users/workspaces/tasks:
//
//   cd server
//   node lib/seed-supabase.js
//
// Safe to run only once - it will error on duplicate primary keys if
// run again. To start over, truncate the tables in the Supabase SQL
// editor first: `truncate users, workspaces, memberships, tasks,
// task_assignees, pokes cascade;`

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { USERS, WORKSPACES, MEMBERSHIPS, TASKS } = require("../data/seed");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in .env - nothing to seed.");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  console.log("Seeding users...");
  let { error } = await supabase.from("users").insert(USERS);
  if (error) throw error;

  console.log("Seeding workspaces...");
  ({ error } = await supabase.from("workspaces").insert(WORKSPACES));
  if (error) throw error;

  console.log("Seeding memberships...");
  ({ error } = await supabase.from("memberships").insert(MEMBERSHIPS));
  if (error) throw error;

  console.log("Seeding tasks...");
  for (const t of TASKS) {
    const { assignee_ids, ...taskFields } = t;
    const { error: taskErr } = await supabase.from("tasks").insert(taskFields);
    if (taskErr) throw taskErr;
    if (assignee_ids.length) {
      const { error: assignErr } = await supabase.from("task_assignees")
        .insert(assignee_ids.map(uid => ({ task_id: t.id, user_id: uid })));
      if (assignErr) throw assignErr;
    }
  }

  console.log("Done. Your Supabase project now has the starter data.");
}

main().catch(e => {
  console.error("Seeding failed:", e.message);
  process.exit(1);
});
