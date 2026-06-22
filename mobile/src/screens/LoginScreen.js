import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useAuth } from "../api/AuthContext";
import { colors, radius, spacing } from "../theme/tokens";

export default function LoginScreen() {
  const { login } = useAuth();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!id.trim() || !password) {
      setError("Enter both an ID and a password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(id.trim().toLowerCase(), password);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.shell} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.logo}>कार्यपथ</Text>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Enter the ID and password your admin gave you.</Text>

        <Text style={styles.label}>ID</Text>
        <TextInput
          style={styles.input}
          value={id}
          onChangeText={setId}
          placeholder="e.g. rajat"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.inkFaint}
          secureTextEntry
          onSubmitEditing={handleSubmit}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center", padding: spacing[4] },
  card: { width: "100%", maxWidth: 380, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing[6], borderWidth: 1, borderColor: colors.border },
  logo: { fontSize: 22, fontWeight: "800", color: colors.ink, textAlign: "center", marginBottom: spacing[4], fontFamily: "monospace" },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink, textAlign: "center", fontFamily: "monospace" },
  subtitle: { fontSize: 13, color: colors.inkMuted, textAlign: "center", marginTop: 4, marginBottom: spacing[5], fontFamily: "monospace" },
  label: { fontSize: 12, fontWeight: "600", color: colors.inkMuted, marginBottom: 6, fontFamily: "monospace" },
  input: {
    borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.sm,
    paddingHorizontal: spacing[3], paddingVertical: 10, color: colors.ink,
    marginBottom: spacing[4], fontFamily: "monospace", fontSize: 14,
  },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing[3], fontFamily: "monospace" },
  button: { backgroundColor: colors.brand, borderRadius: radius.sm, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "700", fontFamily: "monospace" },
});
