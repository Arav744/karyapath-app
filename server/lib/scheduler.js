// Alert scheduler: every SWEEP_INTERVAL_MS (5 minutes), check every
// active (non-Done, non-archived) task with a due_date against the
// threshold ladder in lib/alerts.js, and create an in-app notification
// for each assignee for each NEW threshold crossed since the last sweep.
//
// This intentionally does the simplest thing that works for a
// single-process app: a setInterval loop. If you ever run multiple
// server instances behind a load balancer, move this to a dedicated
// worker process or a cron-triggered endpoint instead, so sweeps don't
// run (and double-notify) once per instance.

const { SWEEP_INTERVAL_MS, dueAt, thresholdsToFire, messageFor } = require("./alerts");

function startScheduler(store) {
  async function sweep() {
    let tasks;
    try {
      tasks = await store.listAllActiveTasks();
    } catch (e) {
      console.error("[scheduler] Failed to list active tasks:", e.message);
      return;
    }

    const now = new Date();
    for (const task of tasks) {
      const due = dueAt(task);
      if (!due) continue; // no due date - nothing to alert on

      for (const userId of task.assignee_ids) {
        try {
          const alreadySent = await store.getSentAlertKeys(task.id, userId);
          const { toNotify, toMarkSent } = thresholdsToFire(now, due, alreadySent);
          for (const key of toNotify) {
            await store.createNotification({
              user_id: userId,
              task_id: task.id,
              threshold_key: key,
              message: messageFor(key, task),
            });
          }
          for (const key of toMarkSent) {
            await store.recordSentAlert(task.id, userId, key);
          }
        } catch (e) {
          console.error(`[scheduler] Failed processing task ${task.id} for ${userId}:`, e.message);
        }
      }
    }
  }

  // Run once shortly after boot (so a near-future demo task fires
  // quickly instead of waiting for the first 5-minute mark), then on
  // the regular interval.
  setTimeout(sweep, 5000);
  const handle = setInterval(sweep, SWEEP_INTERVAL_MS);

  return {
    stop: () => clearInterval(handle),
    runNow: sweep, // exposed for tests and for a manual "check now" admin action
  };
}

module.exports = { startScheduler };
