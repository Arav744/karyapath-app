// Minimal session handling: on successful login we hand back an opaque
// token, the client sends it back as `Authorization: Bearer <token>` on
// every later request, and we look it up in this in-memory map.
//
// This is intentionally simple for a self-hosted single-server demo -
// tokens are lost on server restart (everyone just logs in again) and
// there's no expiry. If you deploy this for real, swap the Map below
// for a proper session store and add expiry.

const crypto = require("crypto");

const sessions = new Map(); // token -> userId

function createSession(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, userId);
  return token;
}

function userIdForToken(token) {
  return sessions.get(token) || null;
}

function destroySession(token) {
  sessions.delete(token);
}

// ---- password check ----
// NOTE: plain-text comparison, matching the plain-text storage noted in
// schema.sql. Before any real-world deployment, hash passwords with
// bcrypt at signup/seed time and compare with bcrypt.compare() here
// instead. Left as plain text for this demo so the seed data
// (id: password pairs from the spec) works without an extra hashing
// step getting in the way.
function checkPassword(user, candidate) {
  return !!user && user.password === candidate;
}

function authMiddleware(store) {
  return async (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    const userId = token ? userIdForToken(token) : null;
    if (!userId) return res.status(401).json({ error: "Not authenticated." });
    const user = await store.getUser(userId);
    if (!user) return res.status(401).json({ error: "Not authenticated." });
    req.user = user;
    next();
  };
}

module.exports = { createSession, userIdForToken, destroySession, checkPassword, authMiddleware };
