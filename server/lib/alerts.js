// Alert escalation ladder. Each entry fires once, at most, per task per
// assignee - the scheduler (lib/scheduler.js) sweeps every 5 minutes and
// uses sent_alerts to make sure a threshold never fires twice.
//
// Ordering matters: thresholds are checked from longest lead time to
// shortest, then the "overdue, hourly" tier kicks in once due_at has
// passed and every other threshold has already fired (or been skipped
// because the task was created with less lead time than that step).

const THRESHOLDS = [
  { key: "1d", label: "1 day", ms: 24 * 60 * 60 * 1000 },
  { key: "12h", label: "12 hours", ms: 12 * 60 * 60 * 1000 },
  { key: "6h", label: "6 hours", ms: 6 * 60 * 60 * 1000 },
  { key: "3h", label: "3 hours", ms: 3 * 60 * 60 * 1000 },
  { key: "1h", label: "1 hour", ms: 1 * 60 * 60 * 1000 },
  { key: "30m", label: "30 minutes", ms: 30 * 60 * 1000 },
  { key: "15m", label: "15 minutes", ms: 15 * 60 * 1000 },
];

const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // matches the chosen "every 5 minutes" check cadence
const OVERDUE_REPEAT_MS = 60 * 60 * 1000; // then every hour after due, indefinitely, until Done

// due_date (date string) + due_time (HH:MM or null) -> a real Date.
// No due_time means "treat as end of that day" for alert purposes,
// per the chosen fallback for date-only tasks.
function dueAt(task) {
  if (!task.due_date) return null;
  const time = task.due_time || "23:59";
  return new Date(`${task.due_date}T${time}:00`);
}

// Given "now", a task's due Date, and the set of threshold_keys already
// sent for this task+user, decide what should happen right now.
//
// Returns { toNotify, toMarkSent }:
//   - toNotify: threshold keys that should actually create a bell
//     notification right now (almost always 0 or 1).
//   - toMarkSent: threshold keys to record in sent_alerts regardless of
//     whether they notified, so they're never revisited.
//
// Upcoming lead-time thresholds (1d, 12h, ...) are rare enough to miss
// in one sweep that we still want to notify every one that's newly
// eligible. But the hourly overdue tier can accumulate a large backlog
// (e.g. a task overdue for 5 days before the server's first boot would
// otherwise fire 121 notifications at once) - for that tier we only
// ever notify the SINGLE most recent missed step, while still marking
// every earlier step as sent so the backlog doesn't just get delayed.
function thresholdsToFire(now, due, alreadySent) {
  if (!due) return { toNotify: [], toMarkSent: [] };
  const msUntilDue = due.getTime() - now.getTime();

  if (msUntilDue > 0) {
    const toNotify = [];
    for (const t of THRESHOLDS) {
      if (msUntilDue <= t.ms && !alreadySent.has(t.key)) toNotify.push(t.key);
    }
    return { toNotify, toMarkSent: toNotify };
  }

  // Overdue: 'overdue:0' fires immediately on crossing due time, then
  // 'overdue:1', 'overdue:2', ... once per hour after that, forever,
  // until the task is Done. Find every step not yet sent, notify only
  // the latest one, and mark the rest sent without notifying.
  const hoursOverdue = Math.floor(-msUntilDue / OVERDUE_REPEAT_MS);
  const missing = [];
  for (let h = 0; h <= hoursOverdue; h++) {
    const key = `overdue:${h}`;
    if (!alreadySent.has(key)) missing.push(key);
  }
  if (missing.length === 0) return { toNotify: [], toMarkSent: [] };
  const latest = missing[missing.length - 1];
  return { toNotify: [latest], toMarkSent: missing };
}

function messageFor(thresholdKey, task) {
  const labelMap = Object.fromEntries(THRESHOLDS.map(t => [t.key, t.label]));
  if (thresholdKey.startsWith("overdue:")) {
    const n = Number(thresholdKey.split(":")[1]);
    return n === 0
      ? `"${task.name}" is now overdue.`
      : `"${task.name}" is still overdue (${n} hour${n > 1 ? "s" : ""} past due).`;
  }
  return `"${task.name}" is due in ${labelMap[thresholdKey] || thresholdKey}.`;
}

module.exports = { THRESHOLDS, SWEEP_INTERVAL_MS, OVERDUE_REPEAT_MS, dueAt, thresholdsToFire, messageFor };
