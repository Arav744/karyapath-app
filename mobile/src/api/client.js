// Talks to the exact same Express API as client/app.js on the web. No
// server changes were needed for mobile - it's the same backend either
// way.
//
// IMPORTANT: update SERVER_URL below before running on a real device.
// "localhost" from a phone means the phone itself, not your computer -
// use your computer's LAN IP (e.g. http://192.168.1.42:4000) when
// testing on a physical device via Expo Go. The iOS Simulator and
// Android Emulator have their own special-cased loopback addresses;
// see the comment below.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Android emulator maps the host machine to 10.0.2.2; iOS simulator
// can use localhost directly; a physical device needs your computer's
// real LAN IP address (run `ipconfig` / `ifconfig` to find it).
const DEFAULT_DEV_URL = Platform.select({
  android: "http://10.0.2.2:4000",
  ios: "http://localhost:4000",
  default: "http://localhost:4000",
});

export let SERVER_URL = DEFAULT_DEV_URL;
export function setServerUrl(url) {
  SERVER_URL = url.replace(/\/$/, "");
}

const TOKEN_KEY = "karyapath_token";

let cachedToken = null;
export async function getToken() {
  if (cachedToken) return cachedToken;
  cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
  return cachedToken;
}
export async function setToken(token) {
  cachedToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

async function apiCall(method, path, body) {
  const token = await getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(SERVER_URL + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // Same failure mode as the web client's "Failed to fetch" - surface
    // a mobile-relevant explanation instead of the raw network error.
    throw new Error(
      `Could not reach the server at ${SERVER_URL}. Make sure the server is running and ` +
      `reachable from this device (check SERVER_URL in src/api/client.js — "localhost" ` +
      `means different things on a simulator vs. a physical phone).`
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  login: (id, password) => apiCall("POST", "/api/login", { id, password }),
  logout: () => apiCall("POST", "/api/logout"),
  me: () => apiCall("GET", "/api/me"),
  health: () => apiCall("GET", "/api/health"),
  users: () => apiCall("GET", "/api/users"),

  workspaces: () => apiCall("GET", "/api/workspaces"),
  subWorkspaces: (id) => apiCall("GET", `/api/workspaces/${id}/subworkspaces`),
  createWorkspace: (data) => apiCall("POST", "/api/workspaces", data),
  members: (id) => apiCall("GET", `/api/workspaces/${id}/members`),

  tasks: (id, archived) => apiCall("GET", `/api/workspaces/${id}/tasks${archived ? "?archived=true" : ""}`),
  createTask: (wsId, data) => apiCall("POST", `/api/workspaces/${wsId}/tasks`, data),
  updateTask: (taskId, patch) => apiCall("PATCH", `/api/tasks/${taskId}`, patch),
  archiveTask: (taskId) => apiCall("POST", `/api/tasks/${taskId}/archive`),
  restoreTask: (taskId) => apiCall("POST", `/api/tasks/${taskId}/restore`),

  pokes: (taskId) => apiCall("GET", `/api/tasks/${taskId}/pokes`),
  createPoke: (taskId, toUserId) => apiCall("POST", `/api/tasks/${taskId}/pokes`, { to_user_id: toUserId }),

  notifications: (unreadOnly) => apiCall("GET", `/api/notifications${unreadOnly ? "?unread=true" : ""}`),
  markNotificationRead: (id) => apiCall("POST", `/api/notifications/${id}/read`),
  markAllNotificationsRead: () => apiCall("POST", "/api/notifications/read-all"),
};
