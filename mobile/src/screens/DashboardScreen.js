import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { colors, radius, spacing } from "../theme/tokens";

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { workspaces } = await api.workspaces();
      setWorkspaces(workspaces);
    } catch (e) {
      // Session probably expired - bounce to login by logging out.
      if (e.status === 401) await logout();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;
  }

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Overview</Text>
          <Text style={styles.title}>Your workspaces</Text>
        </View>
        <TouchableOpacity onPress={logout}><Text style={styles.logout}>Log out</Text></TouchableOpacity>
      </View>

      <FlatList
        data={workspaces}
        keyExtractor={(w) => String(w.id)}
        contentContainerStyle={{ padding: spacing[4] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
        ListEmptyComponent={<Text style={styles.empty}>No workspaces yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("Board", { workspaceId: item.id, workspaceName: item.name })}>
            <View style={styles.cardTop}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Text style={styles.cardTitle}>{item.name}</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{item.active_task_count}</Text>
                <Text style={styles.statLabel}>Active tasks</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{item.member_count}</Text>
                <Text style={styles.statLabel}>{item.member_count === 1 ? "Member" : "Members"}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", padding: spacing[4], paddingTop: spacing[6] },
  eyebrow: { fontSize: 11, color: colors.inkFaint, fontFamily: "monospace", marginBottom: 2 },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink, fontFamily: "monospace" },
  logout: { color: colors.danger, fontSize: 13, fontFamily: "monospace" },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing[4], marginBottom: spacing[3] },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing[3] },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.ink, fontFamily: "monospace" },
  statsRow: { flexDirection: "row", gap: spacing[5] },
  stat: {},
  statNum: { fontSize: 17, fontWeight: "800", color: colors.ink, fontFamily: "monospace" },
  statLabel: { fontSize: 11, color: colors.inkFaint, fontFamily: "monospace" },
  empty: { color: colors.inkFaint, textAlign: "center", marginTop: 40, fontFamily: "monospace" },
});
