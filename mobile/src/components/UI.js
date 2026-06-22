import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/tokens";

const AVATAR_COLORS = [colors.brand, colors.success, colors.warning, colors.kanbanReady, colors.danger, "#3ab8c9"];
export function colorForUser(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}
export function initials(name) {
  const parts = String(name).trim().split(/\s+/);
  return (parts[0]?.[0] || "").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
}

export function Avatar({ userId, displayName, size = 26 }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colorForUser(userId) }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{initials(displayName)}</Text>
    </View>
  );
}

export function stageColor(stage) {
  if (stage === "Done") return colors.kanbanDone;
  if (stage === "Waiting for review") return colors.kanbanReview;
  if (stage === "In progress") return colors.kanbanProgress;
  return colors.kanbanReady;
}

export function Pill({ label, tone }) {
  // tone: "high" | "medium" | "low" | a stage name | "overdue"
  let bg = colors.surface, fg = colors.inkMuted;
  if (tone === "High" || tone === "overdue") { bg = colors.dangerSoft; fg = colors.danger; }
  else if (tone === "Medium") { bg = colors.warningSoft; fg = colors.warning; }
  else if (tone === "Low") { bg = colors.successSoft; fg = colors.success; }
  else if (tone === "Done") { bg = colors.successSoft; fg = colors.success; }
  else if (tone === "Waiting for review") { bg = "rgba(240,105,95,0.14)"; fg = colors.kanbanReview; }
  else if (tone === "In progress") { bg = colors.brandSoft; fg = colors.brandDark; }
  else if (tone === "Ready to start") { bg = colors.warningSoft; fg = colors.warning; }

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{tone === "overdue" ? "OVERDUE" : label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.canvas },
  avatarText: { color: "white", fontWeight: "700", fontFamily: "monospace" },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 10, fontWeight: "700", fontFamily: "monospace", letterSpacing: 0.3 },
});
