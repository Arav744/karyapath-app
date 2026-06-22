// Access control rules, kept identical to the original front-end-only
// demo's logic so behavior doesn't change when the real backend takes
// over:
//   - Admin can see every top-level workspace.
//   - A regular user can see a top-level workspace only if they're a
//     member of it.
//   - A private sub-workspace (parent_id set) is visible ONLY to its
//     own owner - not other members of the parent, not even admin.

async function myWorkspaces(store, user) {
  const all = await store.listWorkspaces();
  const topLevel = all.filter(w => !w.parent_id);
  if (user.is_admin) return topLevel;
  const memberships = await store.listAllMemberships();
  const myIds = new Set(memberships.filter(m => m.user_id === user.id).map(m => m.workspace_id));
  return topLevel.filter(w => myIds.has(w.id));
}

async function mySubWorkspaces(store, user, parentId) {
  const all = await store.listWorkspaces();
  return all.filter(w => w.parent_id === Number(parentId) && w.owner_id === user.id);
}

async function canAccessWorkspace(store, user, workspaceId) {
  const ws = await store.getWorkspace(workspaceId);
  if (!ws) return false;
  if (ws.parent_id) return ws.owner_id === user.id; // private: creator only, no exceptions
  if (user.is_admin) return true;
  const members = await store.listMemberships(ws.id);
  return members.includes(user.id);
}

module.exports = { myWorkspaces, mySubWorkspaces, canAccessWorkspace };
