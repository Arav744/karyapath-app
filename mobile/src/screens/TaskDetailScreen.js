import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { Avatar } from "../components/UI";
import { colors, radius, spacing } from "../theme/tokens";

const STAGES = ["Ready to start", "In progress", "Waiting for review", "Done"];
const PRIORITIES = ["High", "Medium", "Low"];

export default function TaskDetailScreen({ route, navigation }) {
  const { task, workspaceId } = route.params;
  const isEditing = !!task;
  const { user } = useAuth();

  const [name, setName] = useState(task?.name || "");
  const [priority, setPriority] = useState(task?.priority || "Medium");
  const [status, setStatus] = useState(task?.status || "Ready to start");
  const [dueDate, setDueDate] = useState(task?.due_date || "");
  const [dueTime, setDueTime] = useState(task?.due_time || "");
  const [notes, setNotes] = useState(task?.notes || "");
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState(new Set(task?.assignee_ids || []));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.members(workspaceId).then(({ members }) => setMembers(members)).catch(() => {});
  }, [workspaceId]);

  function toggleAssignee(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert("Task name is required."); return; }
    setSaving(true);
    const payload = {
      name: name.trim(), priority, status,
      due_date: dueDate || null, due_time: dueTime || null,
      notes, assignee_ids: [...selected],
    };
    try {
      if (isEditing) await api.updateTask(task.id, payload);
      else await api.createTask(workspaceId, payload);
      navigation.goBack();
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    Alert.alert("Move to archive?", "You can restore it any time.", [
      { text: "Cancel", style: "cancel" },
      { text: "Archive", style: "destructive", onPress: async () => {
        await api.archiveTask(task.id);
        navigation.goBack();
      }},
    ]);
  }

  async function handlePoke(toUserId) {
    try {
      const result = await api.createPoke(task.id, toUserId);
      Linking.openURL(result.whatsapp_url);
    } catch (e) {
      Alert.alert("Couldn't send poke", e.message);
    }
  }

  return (
    <ScrollView style={styles.shell} contentContainerStyle={{ padding: spacing[4] }}>
      <Text style={styles.label}>Task name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="What needs to get done?" placeholderTextColor={colors.inkFaint} />

      <Text style={styles.label}>Assign to</Text>
      <View style={styles.chipsRow}>
        {members.map(m => (
          <TouchableOpacity key={m.id} style={[styles.chip, selected.has(m.id) && styles.chipActive]} onPress={() => toggleAssignee(m.id)}>
            <Avatar userId={m.id} displayName={m.display_name} size={20} />
            <Text style={styles.chipText}>{m.display_name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Priority</Text>
      <View style={styles.chipsRow}>
        {PRIORITIES.map(p => (
          <TouchableOpacity key={p} style={[styles.chip, priority === p && styles.chipActive]} onPress={() => setPriority(p)}>
            <Text style={styles.chipText}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Stage</Text>
      <View style={styles.chipsRow}>
        {STAGES.map(s => (
          <TouchableOpacity key={s} style={[styles.chip, status === s && styles.chipActive]} onPress={() => setStatus(s)}>
            <Text style={styles.chipText}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Due date (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="2026-07-01" placeholderTextColor={colors.inkFaint} />

      <Text style={styles.label}>Due time (HH:MM, 24h) — used for alert thresholds</Text>
      <TextInput style={styles.input} value={dueTime} onChangeText={setDueTime} placeholder="17:00" placeholderTextColor={colors.inkFaint} />

      <Text style={styles.label}>Notes</Text>
      <TextInput style={[styles.input, { height: 80 }]} value={notes} onChangeText={setNotes} multiline placeholder="Any extra detail…" placeholderTextColor={colors.inkFaint} />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? "Saving…" : isEditing ? "Save changes" : "Create task"}</Text>
      </TouchableOpacity>

      {isEditing && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Poke on WhatsApp</Text>
          {task.assignee_ids.length === 0 ? (
            <Text style={styles.mutedText}>No one is assigned yet.</Text>
          ) : task.assignee_ids.map(id => (
            <TouchableOpacity key={id} style={styles.pokeBtn} onPress={() => handlePoke(id)}>
              <Text style={styles.pokeBtnText}>Poke {id}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.archiveBtn} onPress={handleArchive}>
            <Text style={styles.archiveBtnText}>Move to archive</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.canvas },
  label: { fontSize: 12, fontWeight: "600", color: colors.inkMuted, marginTop: spacing[4], marginBottom: 6, fontFamily: "monospace" },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: spacing[2], fontFamily: "monospace" },
  mutedText: { color: colors.inkFaint, fontFamily: "monospace", fontSize: 12 },
  input: {
    borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.sm,
    paddingHorizontal: spacing[3], paddingVertical: 10, color: colors.ink, fontFamily: "monospace", fontSize: 14,
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  chipText: { fontSize: 12, color: colors.ink, fontFamily: "monospace" },
  saveBtn: { backgroundColor: colors.brand, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center", marginTop: spacing[6] },
  saveBtnText: { color: "white", fontWeight: "700", fontFamily: "monospace" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing[5] },
  pokeBtn: { backgroundColor: colors.whatsapp, borderRadius: radius.sm, paddingVertical: 10, alignItems: "center", marginBottom: 8 },
  pokeBtnText: { color: "white", fontWeight: "700", fontFamily: "monospace", fontSize: 13 },
  archiveBtn: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.sm, paddingVertical: 10, alignItems: "center", marginTop: spacing[3] },
  archiveBtnText: { color: colors.danger, fontWeight: "700", fontFamily: "monospace", fontSize: 13 },
});
