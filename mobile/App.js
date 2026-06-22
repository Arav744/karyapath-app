import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TouchableOpacity, Text } from "react-native";

import { AuthProvider, useAuth } from "./src/api/AuthContext";
import { colors } from "./src/theme/tokens";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import BoardScreen from "./src/screens/BoardScreen";
import TaskDetailScreen from "./src/screens/TaskDetailScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.canvas,
    card: colors.canvas,
    text: colors.ink,
    border: colors.border,
    primary: colors.brand,
  },
};

function RootNavigator() {
  const { user, booting } = useAuth();

  if (booting) return null; // could show a splash/spinner here

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerTitleStyle: { color: colors.ink, fontFamily: "monospace" },
        headerTintColor: colors.ink,
      }}
    >
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={({ navigation }) => ({
          title: "कार्यपथ",
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.navigate("Notifications")} style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: colors.ink, fontSize: 16 }}>🔔</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen name="Board" component={BoardScreen} options={{ title: "Board" }} />
      <Stack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={({ route }) => ({ title: route.params?.task ? "Edit task" : "New task" })}
      />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
