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

# --- admin login ---
ADMIN_TOKEN=$(curl -s -X POST $BASE/login -H "Content-Type: application/json" -d '{"id":"admin","password":"admin"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
check "Admin login returns a token" "$([ -n "$ADMIN_TOKEN" ] && echo true || echo false)"

# --- admin sees all 3 workspaces ---
WS_JSON=$(curl -s $BASE/workspaces -H "Authorization: Bearer $ADMIN_TOKEN")
WS_COUNT=$(echo "$WS_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['workspaces']))")
check "Admin sees exactly 3 workspaces" "$([ "$WS_COUNT" = "3" ] && echo true || echo false)"
WS_NAMES=$(echo "$WS_JSON" | python3 -c "import sys,json; print(sorted(w['name'] for w in json.load(sys.stdin)['workspaces']))")
check "Admin's workspaces are PSIPL, SEPL, Gaurav" "$([ "$WS_NAMES" = "['Gaurav', 'PSIPL', 'SEPL']" ] && echo true || echo false)"

# --- wrong password rejected ---
WRONG=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/login -H "Content-Type: application/json" -d '{"id":"admin","password":"wrong"}')
check "Wrong password returns 401" "$([ "$WRONG" = "401" ] && echo true || echo false)"

# --- rajat login, sees only PSIPL ---
RAJAT_TOKEN=$(curl -s -X POST $BASE/login -H "Content-Type: application/json" -d '{"id":"rajat","password":"rajat"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
RAJAT_WS=$(curl -s $BASE/workspaces -H "Authorization: Bearer $RAJAT_TOKEN" | python3 -c "import sys,json; print([w['name'] for w in json.load(sys.stdin)['workspaces']])")
check "Rajat sees only PSIPL" "$([ "$RAJAT_WS" = "['PSIPL']" ] && echo true || echo false)"

# --- rajat cannot access SEPL (workspace id 2) directly ---
RAJAT_SEPL_TASKS=$(curl -s -o /dev/null -w "%{http_code}" $BASE/workspaces/2/tasks -H "Authorization: Bearer $RAJAT_TOKEN")
check "Rajat gets 403 trying to access SEPL tasks directly" "$([ "$RAJAT_SEPL_TASKS" = "403" ] && echo true || echo false)"

# --- kanu (SEPL member) sees SEPL tasks ---
KANU_TOKEN=$(curl -s -X POST $BASE/login -H "Content-Type: application/json" -d '{"id":"kanu","password":"kanu"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
KANU_TASKS=$(curl -s $BASE/workspaces/2/tasks -H "Authorization: Bearer $KANU_TOKEN")
KANU_TASK_COUNT=$(echo "$KANU_TASKS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['tasks']))")
check "Kanu sees SEPL tasks (6 active seeded, incl. demo alert task)" "$([ "$KANU_TASK_COUNT" = "6" ] && echo true || echo false)"

# --- create a new task in SEPL as kanu ---
NEW_TASK=$(curl -s -X POST $BASE/workspaces/2/tasks -H "Authorization: Bearer $KANU_TOKEN" -H "Content-Type: application/json" -d '{"name":"Test task from script","priority":"High","assignee_ids":["praveen"]}')
NEW_TASK_ID=$(echo "$NEW_TASK" | python3 -c "import sys,json; print(json.load(sys.stdin)['task']['id'])")
check "New task created with an id" "$([ -n "$NEW_TASK_ID" ] && echo true || echo false)"

# --- move task to Done via PATCH ---
PATCHED=$(curl -s -X PATCH $BASE/tasks/$NEW_TASK_ID -H "Authorization: Bearer $KANU_TOKEN" -H "Content-Type: application/json" -d '{"status":"Done"}')
PATCHED_STATUS=$(echo "$PATCHED" | python3 -c "import sys,json; print(json.load(sys.stdin)['task']['status'])")
check "Task status updates to Done" "$([ "$PATCHED_STATUS" = "Done" ] && echo true || echo false)"

# --- poke praveen (assigned) about the task ---
POKE=$(curl -s -X POST $BASE/tasks/$NEW_TASK_ID/pokes -H "Authorization: Bearer $KANU_TOKEN" -H "Content-Type: application/json" -d '{"to_user_id":"praveen"}')
POKE_URL=$(echo "$POKE" | python3 -c "import sys,json; print(json.load(sys.stdin)['whatsapp_url'])")
check "Poke returns a wa.me URL with praveen's number" "$(echo "$POKE_URL" | grep -q "wa.me/919820055555" && echo true || echo false)"

# --- poke someone NOT assigned should fail ---
POKE_BAD=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/tasks/$NEW_TASK_ID/pokes -H "Authorization: Bearer $KANU_TOKEN" -H "Content-Type: application/json" -d '{"to_user_id":"sales"}')
check "Poking a non-assignee returns 400" "$([ "$POKE_BAD" = "400" ] && echo true || echo false)"

# --- archive the task, then restore it ---
curl -s -X POST $BASE/tasks/$NEW_TASK_ID/archive -H "Authorization: Bearer $KANU_TOKEN" > /dev/null
ARCHIVED_TASKS=$(curl -s "$BASE/workspaces/2/tasks?archived=true" -H "Authorization: Bearer $KANU_TOKEN")
IS_IN_ARCHIVE=$(echo "$ARCHIVED_TASKS" | python3 -c "import sys,json; print(any(t['id']==$NEW_TASK_ID for t in json.load(sys.stdin)['tasks']))")
check "Archived task appears in archive list" "$([ "$IS_IN_ARCHIVE" = "True" ] && echo true || echo false)"

curl -s -X POST $BASE/tasks/$NEW_TASK_ID/restore -H "Authorization: Bearer $KANU_TOKEN" > /dev/null
ACTIVE_AFTER_RESTORE=$(curl -s "$BASE/workspaces/2/tasks" -H "Authorization: Bearer $KANU_TOKEN")
IS_ACTIVE_AGAIN=$(echo "$ACTIVE_AFTER_RESTORE" | python3 -c "import sys,json; print(any(t['id']==$NEW_TASK_ID for t in json.load(sys.stdin)['tasks']))")
check "Restored task reappears in active list" "$([ "$IS_ACTIVE_AGAIN" = "True" ] && echo true || echo false)"

# --- gaurav creates a private sub-workspace under his own Gaurav workspace ---
GAURAV_TOKEN=$(curl -s -X POST $BASE/login -H "Content-Type: application/json" -d '{"id":"gaurav","password":"gaurav"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
GAURAV_WS=$(curl -s $BASE/workspaces -H "Authorization: Bearer $GAURAV_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['workspaces'][0]['id'])")
SUB_WS=$(curl -s -X POST $BASE/workspaces -H "Authorization: Bearer $GAURAV_TOKEN" -H "Content-Type: application/json" -d "{\"name\":\"Gaurav Secret\",\"parent_id\":$GAURAV_WS}")
SUB_WS_ID=$(echo "$SUB_WS" | python3 -c "import sys,json; print(json.load(sys.stdin)['workspace']['id'])")
check "Private sub-workspace created" "$([ -n "$SUB_WS_ID" ] && echo true || echo false)"

# --- admin should NOT be able to access gaurav's private sub-workspace ---
ADMIN_SUB_ACCESS=$(curl -s -o /dev/null -w "%{http_code}" $BASE/workspaces/$SUB_WS_ID/tasks -H "Authorization: Bearer $ADMIN_TOKEN")
check "Admin gets 403 on Gaurav's private sub-workspace" "$([ "$ADMIN_SUB_ACCESS" = "403" ] && echo true || echo false)"

# --- gaurav himself CAN access it ---
GAURAV_SUB_ACCESS=$(curl -s -o /dev/null -w "%{http_code}" $BASE/workspaces/$SUB_WS_ID/tasks -H "Authorization: Bearer $GAURAV_TOKEN")
check "Gaurav gets 200 on his own private sub-workspace" "$([ "$GAURAV_SUB_ACCESS" = "200" ] && echo true || echo false)"

# --- no token at all -> 401 ---
NO_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" $BASE/workspaces)
check "No token returns 401" "$([ "$NO_TOKEN" = "401" ] && echo true || echo false)"

echo
echo "Results: $pass passed, $fail failed"
[ $fail -eq 0 ]
