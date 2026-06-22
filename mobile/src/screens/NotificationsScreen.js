import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, radius, spacing } from "../theme/tokens";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  return `${Math.floor(hrs / 24)} day(s) ago`;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { notifications } = await api.notifications();
      setNotifications(notifications);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function markRead(id) {
    await api.markNotificationRead(id);
    load();
  }
  async function markAllRead() {
    await api.markAllNotificationsRead();
    load();
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}><Text style={styles.markAll}>Mark all read</Text></TouchableOpacity>
        )}
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={{ padding: spacing[4] }}
        ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.row, !item.read_at && styles.rowUnread]} onPress={() => !item.read_at && markRead(item.id)}>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing[4] },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink, fontFamily: "monospace" },
  markAll: { color: colors.brand, fontSize: 12, fontFamily: "monospace" },
  empty: { color: colors.inkFaint, textAlign: "center", marginTop: 30, fontFamily: "monospace" },
  row: { backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing[3], marginBottom: spacing[2] },
  rowUnread: { borderLeftWidth: 3, borderLeftColor: colors.brand },
  message: { color: colors.ink, fontSize: 13, fontFamily: "monospace", marginBottom: 4 },
  time: { color: colors.inkFaint, fontSize: 11, fontFamily: "monospace" },
});
