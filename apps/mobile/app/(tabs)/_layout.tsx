import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { colors } from "@autoledger/ui-tokens";

type TabIconName = keyof typeof Ionicons.glyphMap;

const tabBarIcon =
  (name: TabIconName, focusedName: TabIconName) =>
  ({
    color,
    focused,
    size,
  }: {
    color: string;
    focused: boolean;
    size: number;
  }) => (
    <Ionicons color={color} name={focused ? focusedName : name} size={size} />
  );

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: tabBarIcon("car-outline", "car"),
          title: "Garage",
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          tabBarIcon: tabBarIcon("time-outline", "time"),
          title: "Activity",
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          tabBarIcon: tabBarIcon("notifications-outline", "notifications"),
          title: "Reminders",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: tabBarIcon("settings-outline", "settings"),
          title: "Settings",
        }}
      />
    </Tabs>
  );
}
