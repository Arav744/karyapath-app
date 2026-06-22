import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { Avatar, Pill, stageColor } from "../components/UI";
import { colors, radius, spacing } from "../theme/tokens";

const STAGES = ["Ready to start", "In progress", "Waiting for review", "Done"];
const { width: SCREEN_WIDTH } = Dimensions.get("window");

function isOverdue(t) {
  if (!t.due_date || t.status === "Done") return false;
  const due = new Date(`${t.due_date}T${t.due_time || "23:59"}:00`);
  return due.getTime() < Date.now();
}

export default function BoardScreen({ route, navigation }) {
  const { workspaceId, workspaceName } = route.params;
  const { userById } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(STAGES[0]);

  const load = useCallback(async () => {
    try {
      const { tasks } = await api.tasks(workspaceId);
      setTasks(tasks);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  React.useEffect(() => { navigation.setOptions({ title: workspaceName }); }, [workspaceName]);

  async function moveTask(task, newStage) {
    try {
      await api.updateTask(task.id, { status: newStage });
      load();
    } catch (e) {
      // swallow - a toast library would be the real move here, kept
      // minimal since this is a scaffold
      console.warn(e.message);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;
  }

  const visibleTasks = tasks.filter(t => t.status === activeStage);

  return (
    <View style={styles.shell}>
      <View style={styles.tabs}>
        {STAGES.map(stage => (
          <TouchableOpacity
            key={stage}
            style={[styles.tab, activeStage === stage && { borderColor: stageColor(stage) }]}
            onPress={() => setActiveStage(stage)}
          >
            <Text style={[styles.tabText, activeStage === stage && { color: colors.ink, fontWeight: "700" }]}>
              {stage} ({tasks.filter(t => t.status === stage).length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={visibleTasks}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={{ padding: spacing[3] }}
        ListEmptyComponent={<Text style={styles.empty}>No tasks in this stage.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, isOverdue(item) && styles.cardOverdue]}
            onPress={() => navigation.navigate("TaskDetail", { task: item, workspaceId })}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <View style={styles.pillsRow}>
              {isOverdue(item) && <Pill tone="overdue" />}
              <Pill label={item.priority} tone={item.priority} />
            </View>
            <View style={styles.footRow}>
              <View style={styles.avatarStack}>
                {item.assignee_ids.map((id, i) => {
                  const u = userById(id);
                  return <View key={id} style={{ marginLeft: i === 0 ? 0 : -8 }}><Avatar userId={u.id} displayName={u.display_name} size={22} /></View>;
                })}
              </View>
              {item.due_date && <Text style={styles.dueText}>{item.due_date.slice(5)}{item.due_time ? ` ${item.due_time}` : ""}</Text>}
            </View>

            {/* Mobile stand-in for drag-and-drop: quick move buttons to
                adjacent stages, since dragging cards between columns
                doesn't translate well to a single-column phone layout. */}
            <View style={styles.moveRow}>
              {STAGES.filter(s => s !== item.status).map(s => (
                <TouchableOpacity key={s} style={styles.moveBtn} onPress={() => moveTask(item, s)}>
                  <Text style={styles.moveBtnText}>→ {s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate("TaskDetail", { workspaceId })}>
        <Text style={styles.fabText}>+ New task</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: spacing[3], borderBottomWidth: 1, borderColor: colors.border },
  tab: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  tabText: { fontSize: 11, color: colors.inkMuted, fontFamily: "monospace" },
  empty: { color: colors.inkFaint, textAlign: "center", marginTop: 30, fontFamily: "monospace" },
  card: { backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing[3], marginBottom: spacing[2] },
  cardOverdue: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.ink, marginBottom: 8, fontFamily: "monospace" },
  pillsRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  footRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  avatarStack: { flexDirection: "row" },
  dueText: { fontSize: 11, color: colors.inkFaint, fontFamily: "monospace" },
  moveRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border },
  moveBtn: { backgroundColor: colors.surfaceHover, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  moveBtnText: { fontSize: 10, color: colors.inkMuted, fontFamily: "monospace" },
  fab: { position: "absolute", bottom: spacing[5], right: spacing[4], left: spacing[4], backgroundColor: colors.brand, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center" },
  fabText: { color: "white", fontWeight: "700", fontFamily: "monospace" },
});
