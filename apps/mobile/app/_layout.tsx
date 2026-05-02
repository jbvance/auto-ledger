import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@autoledger/ui-tokens";

import { AuthProvider } from "../lib/auth";
import { configureLocalNotifications } from "../lib/notifications";
import "../global.css";

export default function RootLayout() {
  useEffect(() => {
    configureLocalNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack
          screenOptions={{
            contentStyle: {
              backgroundColor: colors.background,
            },
            headerStyle: {
              backgroundColor: colors.surface,
            },
            headerShadowVisible: false,
            headerTintColor: colors.ink,
            headerTitleStyle: {
              fontWeight: "700",
            },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: "Vehicles",
            }}
          />
          <Stack.Screen
            name="vehicles/new"
            options={{
              title: "Add Vehicle",
            }}
          />
          <Stack.Screen
            name="vehicles/archived"
            options={{
              title: "Archived Vehicles",
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              title: "Settings",
            }}
          />
          <Stack.Screen
            name="settings/export"
            options={{
              title: "Export CSV",
            }}
          />
          <Stack.Screen
            name="auth/sign-in"
            options={{
              title: "Sign In",
            }}
          />
          <Stack.Screen
            name="auth/sign-up"
            options={{
              title: "Create Account",
            }}
          />
          <Stack.Screen
            name="attachments/[id]"
            options={{
              title: "Attachment",
            }}
          />
          <Stack.Screen
            name="vehicles/[id]"
            options={{
              title: "Vehicle Detail",
            }}
          />
          <Stack.Screen
            name="vehicles/[id]/edit"
            options={{
              title: "Edit Vehicle",
            }}
          />
          <Stack.Screen
            name="vehicles/[id]/odometer/new"
            options={{
              title: "Add Odometer Entry",
            }}
          />
          <Stack.Screen
            name="vehicles/[id]/odometer/[entryId]/edit"
            options={{
              title: "Edit Odometer Entry",
            }}
          />
          <Stack.Screen
            name="vehicles/[id]/service/new"
            options={{
              title: "Add Service Record",
            }}
          />
          <Stack.Screen
            name="vehicles/[id]/service/[recordId]"
            options={{
              title: "Service Record",
            }}
          />
          <Stack.Screen
            name="vehicles/[id]/service/[recordId]/edit"
            options={{
              title: "Edit Service Record",
            }}
          />
          <Stack.Screen
            name="vehicles/[id]/repair/new"
            options={{
              title: "Add Repair Record",
            }}
          />
          <Stack.Screen
            name="vehicles/[id]/repair/[recordId]"
            options={{
              title: "Repair Record",
            }}
          />
          <Stack.Screen
            name="vehicles/[id]/repair/[recordId]/edit"
            options={{
              title: "Edit Repair Record",
            }}
          />
          <Stack.Screen
            name="vehicles/[id]/reminders/new"
            options={{
              title: "Add Reminder",
            }}
          />
          <Stack.Screen
            name="vehicles/[id]/reminders/[reminderId]"
            options={{
              title: "Reminder",
            }}
          />
          <Stack.Screen
            name="vehicles/[id]/reminders/[reminderId]/edit"
            options={{
              title: "Edit Reminder",
            }}
          />
        </Stack>
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
