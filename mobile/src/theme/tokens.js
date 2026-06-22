// Mirrors the color tokens in client/styles.css so the mobile app
// looks like the same product, not a different one.

export const colors = {
  brand: "#5b93ff",
  brandDark: "#3b7cee",
  brandSoft: "rgba(91, 147, 255, 0.16)",

  canvas: "#1b2040",
  surface: "#232a52",
  surfaceHover: "#2c3461",
  border: "#353d6b",
  borderStrong: "#4a5384",
  ink: "#eef1fb",
  inkMuted: "#aab1d6",
  inkFaint: "#7a82ab",

  success: "#3ecf8e",
  successSoft: "rgba(62, 207, 142, 0.16)",
  warning: "#e3a83c",
  warningSoft: "rgba(227, 168, 60, 0.16)",
  danger: "#f0695f",
  dangerSoft: "rgba(240, 105, 95, 0.16)",
  whatsapp: "#25d366",
  whatsappDark: "#3ee077",

  kanbanReady: "#8b6ce0",
  kanbanProgress: "#e3a83c",
  kanbanReview: "#f0695f",
  kanbanDone: "#3ecf8e",
};

// React Native's <Text> needs an actual installed monospace font name,
// not a CSS font-family fallback list. "Courier" / "monospace" are the
// built-in cross-platform monospace fonts (iOS / Android respectively);
// swap in a custom loaded font (e.g. JetBrains Mono via expo-font) if
// you want an exact match to the web client's typeface.
export const fontFamily = {
  regular: "monospace",
  // iOS ignores "monospace" and needs an explicit name - Platform-pick
  // this in components, or load a custom font for pixel-perfect parity.
};

export const radius = { sm: 8, md: 12, lg: 18, full: 999 };
export const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 };
