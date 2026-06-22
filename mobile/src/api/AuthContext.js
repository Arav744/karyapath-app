import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [booting, setBooting] = useState(true);

  // Try to resume a session from a stored token on app launch.
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) { setBooting(false); return; }
      try {
        const { user } = await api.me();
        setUser(user);
        const { users } = await api.users();
        setAllUsers(users);
      } catch (e) {
        await setToken(null);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const login = useCallback(async (id, password) => {
    const { token, user } = await api.login(id, password);
    await setToken(token);
    setUser(user);
    const { users } = await api.users();
    setAllUsers(users);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch (e) { /* logging out regardless */ }
    await setToken(null);
    setUser(null);
    setAllUsers([]);
  }, []);

  const userById = useCallback((id) => {
    return allUsers.find(u => u.id === id) || { id, display_name: id, is_admin: false };
  }, [allUsers]);

  return (
    <AuthContext.Provider value={{ user, allUsers, booting, login, logout, userById }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}
