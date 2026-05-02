import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  cancelAllScheduledReminderNotifications,
  rescheduleActiveReminderNotifications,
} from "../lib/maintenanceReminders";
import { useAuth } from "../lib/auth";
import { hasAnyLocalGuestData } from "../lib/localGuestData";
import {
  getReminderNotificationSettings,
  updateReminderNotificationSettings,
  type ReminderNotificationSettings,
} from "../lib/notificationSettings";
import {
  getLocalNotificationRuntimeMessage,
  getLocalNotificationPermissionState,
  isLocalNotificationRuntimeSupported,
  requestLocalNotificationPermission,
  type LocalNotificationPermissionState,
} from "../lib/notifications";

const dayOptions = [0, 1, 3, 7, 14];
const mileOptions = [100, 250, 500, 1000];

const emptyPermissionState: LocalNotificationPermissionState = {
  canAskAgain: true,
  granted: false,
  status: "undetermined",
};

const permissionLabels: Record<
  LocalNotificationPermissionState["status"],
  string
> = {
  denied: "Denied",
  granted: "Allowed",
  unavailable: "Unavailable",
  undetermined: "Not requested",
};

export default function SettingsScreen() {
  const {
    isConfigured: isAuthConfigured,
    isLoading: isAuthLoading,
    signOut,
    user,
  } = useAuth();
  const [accountFeedback, setAccountFeedback] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hasLocalGuestRecords, setHasLocalGuestRecords] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionState, setPermissionState] =
    useState<LocalNotificationPermissionState>(emptyPermissionState);
  const [settings, setSettings] = useState<ReminderNotificationSettings | null>(
    null,
  );
  const notificationsUnavailable = !isLocalNotificationRuntimeSupported();
  const runtimeMessage = getLocalNotificationRuntimeMessage();

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    const [nextSettings, nextPermissionState, nextHasLocalGuestRecords] =
      await Promise.all([
        getReminderNotificationSettings(),
        getLocalNotificationPermissionState(),
        hasAnyLocalGuestData(),
      ]);

    setSettings(nextSettings);
    setHasLocalGuestRecords(nextHasLocalGuestRecords);
    setPermissionState(nextPermissionState);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
    }, [loadSettings]),
  );

  const safelyReschedule = async () => {
    try {
      await rescheduleActiveReminderNotifications();
      return true;
    } catch (error: unknown) {
      console.warn("Unable to reschedule local reminder notifications.", error);
      setFeedback(
        "Settings were saved, but some reminder notifications could not be rescheduled.",
      );
      return false;
    }
  };

  const toggleNotifications = async (enabled: boolean) => {
    if (!settings) {
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    if (!enabled) {
      const updated = await updateReminderNotificationSettings({
        reminder_notifications_enabled: false,
      });

      await cancelAllScheduledReminderNotifications();
      setSettings(updated);
      setFeedback(
        "Reminder notifications are off. Your reminders still work in the app.",
      );
      setIsSaving(false);
      return;
    }

    if (notificationsUnavailable) {
      setFeedback(
        "Notifications are unavailable in this runtime. Your reminders still work in the app.",
      );
      setIsSaving(false);
      return;
    }

    const nextPermissionState = await requestLocalNotificationPermission();
    setPermissionState(nextPermissionState);

    if (!nextPermissionState.granted) {
      const updated = await updateReminderNotificationSettings({
        reminder_notifications_enabled: false,
      });

      setSettings(updated);
      setFeedback(
        "Notifications were not enabled. You can keep using reminders in the app.",
      );
      setIsSaving(false);
      return;
    }

    const updated = await updateReminderNotificationSettings({
      reminder_notifications_enabled: true,
    });

    setSettings(updated);
    if (await safelyReschedule()) {
      setFeedback("Reminder notifications are on for date-based reminders.");
    }
    setIsSaving(false);
  };

  const updateDaysBefore = async (days: number) => {
    const updated = await updateReminderNotificationSettings({
      days_before_due_date: days,
    });

    setSettings(updated);

    if (updated.reminder_notifications_enabled) {
      await safelyReschedule();
    }
  };

  const updateMilesBefore = async (miles: number) => {
    const updated = await updateReminderNotificationSettings({
      miles_before_due_odometer: miles,
    });

    setSettings(updated);
  };

  const signOutCurrentAccount = async () => {
    setAccountFeedback(null);
    setIsSaving(true);

    const result = await signOut();

    setAccountFeedback(
      result.error ??
        "Signed out. Your local guest records remain on this device.",
    );
    setIsSaving(false);
  };

  if (isLoading || !settings) {
    return (
      <SafeAreaView className="flex-1 bg-ledger-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#136f63" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        <View className="gap-2 pt-4">
          <Text className="text-sm font-bold uppercase text-ledger-primary">
            Settings
          </Text>
          <Text className="text-4xl font-extrabold text-ledger-ink">
            Preferences
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            AutoLedger works without notifications. If you enable them, date
            reminder alerts are scheduled locally on this device.
          </Text>
        </View>

        <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <View className="gap-1">
            <Text className="text-lg font-bold text-ledger-ink">Account</Text>
            <Text className="text-sm leading-5 text-ledger-muted">
              Accounts are optional. Signed-in users can save new cloud
              vehicles, while existing guest records stay local for now.
            </Text>
          </View>

          <SettingsRow
            label="Status"
            value={
              isAuthLoading ? "Checking..." : user ? "Signed in" : "Guest mode"
            }
          />

          {user ? (
            <>
              <SettingsRow label="Email" value={user.email ?? "Not set"} />
              <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
              <Text className="text-sm leading-5 text-ledger-muted">
                New vehicles, odometer readings, service records, and repair
                records are saved to your account. Cloud reminders are
                available for cloud vehicles. Cloud attachment and CSV sync are
                coming soon.
              </Text>
              </View>
              {hasLocalGuestRecords ? (
                <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
                  <Text className="text-sm leading-5 text-ledger-muted">
                    Cloud sync for existing local records is coming soon. New
                    cloud vehicles, odometer readings, service records, and
                    repair records, and reminders will be saved to your
                    account.
                  </Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                className="rounded-card border border-ledger-line bg-ledger-background px-4 py-3"
                disabled={isSaving}
                onPress={() => {
                  void signOutCurrentAccount();
                }}
              >
                <Text className="text-center text-base font-bold text-ledger-ink">
                  Sign Out
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              {!isAuthConfigured ? (
                <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
                  <Text className="text-sm leading-5 text-ledger-muted">
                    Supabase is not configured. Add the public Supabase URL and
                    anon key to enable optional accounts.
                  </Text>
                </View>
              ) : null}
              <View className="flex-row gap-2">
                <Pressable
                  accessibilityRole="button"
                  className="flex-1 rounded-card bg-ledger-primary px-4 py-3"
                  disabled={!isAuthConfigured}
                  onPress={() => router.push("/auth/sign-in" as Href)}
                >
                  <Text className="text-center text-base font-bold text-white">
                    Sign In
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  className="flex-1 rounded-card border border-ledger-line bg-ledger-background px-4 py-3"
                  disabled={!isAuthConfigured}
                  onPress={() => router.push("/auth/sign-up" as Href)}
                >
                  <Text className="text-center text-base font-bold text-ledger-ink">
                    Create Account
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {accountFeedback ? (
            <View className="rounded-card bg-ledger-background p-3">
              <Text className="text-sm leading-5 text-ledger-muted">
                {accountFeedback}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1 gap-1">
              <Text className="text-lg font-bold text-ledger-ink">
                Reminder Notifications
              </Text>
              <Text className="text-sm leading-5 text-ledger-muted">
                Optional local alerts for reminders that have a due date.
              </Text>
            </View>
            <Switch
              disabled={isSaving}
              onValueChange={(value) => {
                void toggleNotifications(value);
              }}
              thumbColor={
                settings.reminder_notifications_enabled ? "#136f63" : "#ffffff"
              }
              value={settings.reminder_notifications_enabled}
            />
          </View>

          <SettingsRow
            label="Permission"
            value={permissionLabels[permissionState.status]}
          />
          <SettingsRow
            label="Status"
            value={
              notificationsUnavailable
                ? "Unavailable in this runtime"
                : settings.reminder_notifications_enabled
                  ? "Enabled for date reminders"
                  : "Off"
            }
          />

          {permissionState.status === "denied" ? (
            <View className="rounded-card border border-red-200 bg-ledger-background p-3">
              <Text className="text-sm leading-5 text-ledger-muted">
                Notification permission is denied. You can still use reminders,
                and you can change permission later in device settings.
              </Text>
            </View>
          ) : null}

          {runtimeMessage ? (
            <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
              <Text className="text-sm leading-5 text-ledger-muted">
                {runtimeMessage}
              </Text>
            </View>
          ) : null}

          <OptionGroup
            description="Date reminders notify at 9:00 AM local time before the due date when there is enough time left to schedule."
            label="Days before due date"
            onSelect={(value) => {
              void updateDaysBefore(value);
            }}
            options={dayOptions}
            selectedValue={settings.days_before_due_date}
            suffix="days"
          />

          <OptionGroup
            description="Pure mileage reminders stay in-app only because AutoLedger does not track mileage in the background."
            label="Mileage due-soon preference"
            onSelect={(value) => {
              void updateMilesBefore(value);
            }}
            options={mileOptions}
            selectedValue={settings.miles_before_due_odometer}
            suffix="mi"
          />

          {feedback ? (
            <View className="rounded-card bg-ledger-background p-3">
              <Text className="text-sm leading-5 text-ledger-muted">
                {feedback}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="gap-2 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <Text className="text-base font-bold text-ledger-ink">
            What Is Not Included
          </Text>
          <Text className="text-sm leading-5 text-ledger-muted">
            This does not use cloud push notifications, push tokens, Supabase,
            or server-side notification delivery.
          </Text>
        </View>

        <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <View className="gap-1">
            <Text className="text-base font-bold text-ledger-ink">
              Export Data
            </Text>
            <Text className="text-sm leading-5 text-ledger-muted">
              Create a local CSV export from guest records on this device.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            className="rounded-card bg-ledger-primary px-4 py-3"
            onPress={() => router.push("/settings/export" as Href)}
          >
            <Text className="text-center text-base font-bold text-white">
              Export Local CSV
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-3 border-b border-ledger-line pb-3">
      <Text className="text-sm font-bold text-ledger-muted">{label}</Text>
      <Text className="flex-1 text-right text-sm font-bold text-ledger-ink">
        {value}
      </Text>
    </View>
  );
}

function OptionGroup({
  description,
  label,
  onSelect,
  options,
  selectedValue,
  suffix,
}: {
  description: string;
  label: string;
  onSelect: (value: number) => void;
  options: number[];
  selectedValue: number;
  suffix: string;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-ledger-ink">{label}</Text>
      <Text className="text-sm leading-5 text-ledger-muted">{description}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = option === selectedValue;

          return (
            <Pressable
              accessibilityRole="button"
              className={`rounded-card border px-3 py-2 ${
                isSelected
                  ? "border-ledger-primary bg-ledger-primary"
                  : "border-ledger-line bg-ledger-background"
              }`}
              key={option}
              onPress={() => onSelect(option)}
            >
              <Text
                className={`text-sm font-bold ${
                  isSelected ? "text-white" : "text-ledger-ink"
                }`}
              >
                {option} {suffix}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
