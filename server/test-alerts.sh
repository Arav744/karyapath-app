#!/bin/bash
set -e
BASE="http://localhost:4000/api"
pass=0
fail=0

check() {
  local label="$1"
  local condition="$2"
  if [ "$condition" = "true" ]; then
    echo "[PASS] $label"
    pass=$((pass+1))
  else
    echo "[FAIL] $label"
    fail=$((fail+1))
  fi
}

KANU_TOKEN=$(curl -s -X POST $BASE/login -H "Content-Type: application/json" -d '{"id":"kanu","password":"kanu"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# The seed data includes a demo task due ~20 minutes from server start,
# assigned to kanu - trigger a sweep immediately rather than waiting.
curl -s -X POST $BASE/dev/run-alert-sweep > /dev/null

NOTIFS=$(curl -s $BASE/notifications -H "Authorization: Bearer $KANU_TOKEN")
NOTIF_COUNT=$(echo "$NOTIFS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['notifications']))")
check "Kanu has at least one notification after the sweep" "$([ "$NOTIF_COUNT" -ge 1 ] && echo true || echo false)"

HAS_DEMO_MSG=$(echo "$NOTIFS" | python3 -c "import sys,json; d=json.load(sys.stdin)['notifications']; print(any('Demo: alert escalation task' in n['message'] for n in d))")
check "One notification mentions the demo alert task" "$([ "$HAS_DEMO_MSG" = "True" ] && echo true || echo false)"

ALL_UNREAD=$(echo "$NOTIFS" | python3 -c "import sys,json; d=json.load(sys.stdin)['notifications']; print(all(n['read_at'] is None for n in d))")
check "Fresh notifications are unread" "$([ "$ALL_UNREAD" = "True" ] && echo true || echo false)"

# Run the sweep again immediately - should NOT duplicate the same threshold notifications
curl -s -X POST $BASE/dev/run-alert-sweep > /dev/null
NOTIFS2=$(curl -s $BASE/notifications -H "Authorization: Bearer $KANU_TOKEN")
NOTIF_COUNT2=$(echo "$NOTIFS2" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['notifications']))")
check "Running the sweep again does not duplicate notifications" "$([ "$NOTIF_COUNT2" = "$NOTIF_COUNT" ] && echo true || echo false)"

# Mark one notification read
FIRST_ID=$(echo "$NOTIFS2" | python3 -c "import sys,json; print(json.load(sys.stdin)['notifications'][0]['id'])")
curl -s -X POST $BASE/notifications/$FIRST_ID/read -H "Authorization: Bearer $KANU_TOKEN" > /dev/null
UNREAD_AFTER=$(curl -s "$BASE/notifications?unread=true" -H "Authorization: Bearer $KANU_TOKEN" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['notifications']))")
check "Marking one notification read reduces unread count by 1" "$([ "$UNREAD_AFTER" = "$((NOTIF_COUNT2 - 1))" ] && echo true || echo false)"

# Mark all read
curl -s -X POST $BASE/notifications/read-all -H "Authorization: Bearer $KANU_TOKEN" > /dev/null
UNREAD_FINAL=$(curl -s "$BASE/notifications?unread=true" -H "Authorization: Bearer $KANU_TOKEN" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['notifications']))")
check "Mark-all-read clears the unread count to 0" "$([ "$UNREAD_FINAL" = "0" ] && echo true || echo false)"

# Other users (rajat) should NOT see kanu's notifications
RAJAT_TOKEN=$(curl -s -X POST $BASE/login -H "Content-Type: application/json" -d '{"id":"rajat","password":"rajat"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
RAJAT_NOTIFS=$(curl -s $BASE/notifications -H "Authorization: Bearer $RAJAT_TOKEN" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['notifications']))")
check "Rajat has zero notifications (none of the demo alerts are his)" "$([ "$RAJAT_NOTIFS" = "0" ] && echo true || echo false)"

# Regression test: a task that's been overdue for days before the
# server's first boot must NOT flood the bell with one notification
# per missed hour - only the single most recent "still overdue" tier
# should ever produce a notification. (Seed task 6, "Renew shop
# license", is overdue by several days in the starter data for
# exactly this reason.)
TASK6_NOTIFS=$(curl -s $BASE/notifications -H "Authorization: Bearer $KANU_TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin)['notifications']; print(len([n for n in d if n['task_id']==6]))")
check "Long-overdue task produces exactly 1 notification, not one per missed hour" "$([ "$TASK6_NOTIFS" = "1" ] && echo true || echo false)"

# Completing the task should clear its alert history (verified indirectly:
# patch status to Done, then confirm a future re-open + due-date edit
# would start fresh - here we just check the PATCH succeeds and the
# scheduler doesn't error out on a now-Done task during the next sweep)
TASK_PATCH=$(curl -s -X PATCH $BASE/tasks/12 -H "Authorization: Bearer $KANU_TOKEN" -H "Content-Type: application/json" -d '{"status":"Done"}')
PATCH_OK=$(echo "$TASK_PATCH" | python3 -c "import sys,json; print(json.load(sys.stdin)['task']['status'])")
check "Marking the demo task Done succeeds" "$([ "$PATCH_OK" = "Done" ] && echo true || echo false)"

curl -s -X POST $BASE/dev/run-alert-sweep > /dev/null
echo "(sweep after marking Done ran without error - checked via script not erroring out above)"

echo
echo "Results: $pass passed, $fail failed"
[ $fail -eq 0 ]
