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
} from "../../lib/maintenanceReminders";
import { useAuth } from "../../lib/auth";
import {
  getGuestMigrationSummary,
  getVehicleMigrationMappings,
  getOrCreateInitialMigrationRun,
  type GuestMigrationSummary,
  type MigrationRun,
} from "../../lib/guestMigration";
import {
  migrateGuestOdometerEntriesToCloud,
  type GuestOdometerMigrationResult,
} from "../../lib/guestOdometerMigration";
import {
  getRepairRecordMigrationMappings,
  migrateGuestRepairRecordsToCloud,
  type GuestRepairRecordMigrationResult,
} from "../../lib/guestRepairRecordMigration";
import {
  getServiceRecordMigrationMappings,
  migrateGuestServiceRecordsToCloud,
  type GuestServiceRecordMigrationResult,
} from "../../lib/guestServiceRecordMigration";
import {
  migrateGuestVehiclesToCloud,
  type GuestVehicleMigrationResult,
} from "../../lib/guestVehicleMigration";
import {
  getReminderNotificationSettings,
  updateReminderNotificationSettings,
  type ReminderNotificationSettings,
} from "../../lib/notificationSettings";
import {
  getLocalNotificationRuntimeMessage,
  getLocalNotificationPermissionState,
  isLocalNotificationRuntimeSupported,
  requestLocalNotificationPermission,
  type LocalNotificationPermissionState,
} from "../../lib/notifications";

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
  const [guestMigrationSummary, setGuestMigrationSummary] =
    useState<GuestMigrationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMigratingOdometerEntries, setIsMigratingOdometerEntries] =
    useState(false);
  const [isMigratingRepairRecords, setIsMigratingRepairRecords] =
    useState(false);
  const [isMigratingServiceRecords, setIsMigratingServiceRecords] =
    useState(false);
  const [isMigratingVehicles, setIsMigratingVehicles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [migrationRun, setMigrationRun] = useState<MigrationRun | null>(null);
  const [odometerMigrationResult, setOdometerMigrationResult] =
    useState<GuestOdometerMigrationResult | null>(null);
  const [repairRecordMigrationResult, setRepairRecordMigrationResult] =
    useState<GuestRepairRecordMigrationResult | null>(null);
  const [serviceRecordMigrationResult, setServiceRecordMigrationResult] =
    useState<GuestServiceRecordMigrationResult | null>(null);
  const [vehicleMigrationResult, setVehicleMigrationResult] =
    useState<GuestVehicleMigrationResult | null>(null);
  const [
    serviceRecordMigrationMappingCount,
    setServiceRecordMigrationMappingCount,
  ] = useState(0);
  const [
    repairRecordMigrationMappingCount,
    setRepairRecordMigrationMappingCount,
  ] = useState(0);
  const [vehicleMigrationMappingCount, setVehicleMigrationMappingCount] =
    useState(0);
  const [permissionState, setPermissionState] =
    useState<LocalNotificationPermissionState>(emptyPermissionState);
  const [settings, setSettings] = useState<ReminderNotificationSettings | null>(
    null,
  );
  const notificationsUnavailable = !isLocalNotificationRuntimeSupported();
  const runtimeMessage = getLocalNotificationRuntimeMessage();

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    const accountId = user?.id ?? null;
    const [nextSettings, nextPermissionState, nextMigrationSummary] =
      await Promise.all([
        getReminderNotificationSettings(),
        getLocalNotificationPermissionState(),
        getGuestMigrationSummary(accountId),
      ]);

    const nextMigrationRun =
      accountId && nextMigrationSummary.hasGuestData
        ? await getOrCreateInitialMigrationRun(accountId)
        : null;
    const nextVehicleMigrationMappings =
      accountId && nextMigrationSummary.hasGuestData
        ? await getVehicleMigrationMappings(accountId)
        : [];
    const nextServiceRecordMigrationMappings =
      accountId && nextMigrationSummary.hasGuestData
        ? await getServiceRecordMigrationMappings(accountId)
        : [];
    const nextRepairRecordMigrationMappings =
      accountId && nextMigrationSummary.hasGuestData
        ? await getRepairRecordMigrationMappings(accountId)
        : [];

    setSettings(nextSettings);
    setGuestMigrationSummary(nextMigrationSummary);
    setMigrationRun(nextMigrationRun);
    setServiceRecordMigrationMappingCount(
      nextServiceRecordMigrationMappings.length,
    );
    setRepairRecordMigrationMappingCount(
      nextRepairRecordMigrationMappings.length,
    );
    setVehicleMigrationMappingCount(nextVehicleMigrationMappings.length);
    setPermissionState(nextPermissionState);
    setIsLoading(false);
  }, [user?.id]);

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

  const migrateVehiclesToCurrentAccount = async () => {
    if (!user) {
      return;
    }

    setAccountFeedback(null);
    setIsMigratingVehicles(true);

    try {
      const result = await migrateGuestVehiclesToCloud(user.id);

      setVehicleMigrationResult(result);
      setMigrationRun(result.run);
      setVehicleMigrationMappingCount(
        result.results.filter((item) => item.cloudId).length,
      );
      setAccountFeedback(
        result.failedCount > 0
          ? `Vehicle migration finished with ${result.failedCount} issue${result.failedCount === 1 ? "" : "s"}. Local guest data was not changed.`
          : "Vehicle migration finished. Local guest data remains on this device.",
      );
      await loadSettings();
    } catch (error: unknown) {
      setAccountFeedback(
        error instanceof Error
          ? error.message
          : "Unable to migrate vehicles. Local guest data was not changed.",
      );
    } finally {
      setIsMigratingVehicles(false);
    }
  };

  const migrateOdometerEntriesToCurrentAccount = async () => {
    if (!user) {
      return;
    }

    setAccountFeedback(null);
    setIsMigratingOdometerEntries(true);

    try {
      const result = await migrateGuestOdometerEntriesToCloud(user.id);

      setOdometerMigrationResult(result);
      setMigrationRun(result.run);
      setAccountFeedback(
        result.failedCount > 0 || result.skippedMissingVehicleMappingCount > 0
          ? `Odometer migration finished with ${result.failedCount + result.skippedMissingVehicleMappingCount} issue${result.failedCount + result.skippedMissingVehicleMappingCount === 1 ? "" : "s"}. Local guest data was not changed.`
          : "Odometer migration finished. Local guest data remains on this device.",
      );
      await loadSettings();
    } catch (error: unknown) {
      setAccountFeedback(
        error instanceof Error
          ? error.message
          : "Unable to migrate odometer entries. Local guest data was not changed.",
      );
    } finally {
      setIsMigratingOdometerEntries(false);
    }
  };

  const migrateServiceRecordsToCurrentAccount = async () => {
    if (!user) {
      return;
    }

    setAccountFeedback(null);
    setIsMigratingServiceRecords(true);

    try {
      const result = await migrateGuestServiceRecordsToCloud(user.id);

      setServiceRecordMigrationResult(result);
      setMigrationRun(result.run);
      setServiceRecordMigrationMappingCount(
        result.results.filter((item) => item.cloudId).length,
      );
      setAccountFeedback(
        result.failedCount > 0 || result.skippedMissingVehicleMappingCount > 0
          ? `Service record migration finished with ${result.failedCount + result.skippedMissingVehicleMappingCount} issue${result.failedCount + result.skippedMissingVehicleMappingCount === 1 ? "" : "s"}. Local guest data was not changed.`
          : "Service record migration finished. Local guest data remains on this device.",
      );
      await loadSettings();
    } catch (error: unknown) {
      setAccountFeedback(
        error instanceof Error
          ? error.message
          : "Unable to migrate service records. Local guest data was not changed.",
      );
    } finally {
      setIsMigratingServiceRecords(false);
    }
  };

  const migrateRepairRecordsToCurrentAccount = async () => {
    if (!user) {
      return;
    }

    setAccountFeedback(null);
    setIsMigratingRepairRecords(true);

    try {
      const result = await migrateGuestRepairRecordsToCloud(user.id);

      setRepairRecordMigrationResult(result);
      setMigrationRun(result.run);
      setRepairRecordMigrationMappingCount(
        result.results.filter((item) => item.cloudId).length,
      );
      setAccountFeedback(
        result.failedCount > 0 || result.skippedMissingVehicleMappingCount > 0
          ? `Repair record migration finished with ${result.failedCount + result.skippedMissingVehicleMappingCount} issue${result.failedCount + result.skippedMissingVehicleMappingCount === 1 ? "" : "s"}. Local guest data was not changed.`
          : "Repair record migration finished. Local guest data remains on this device.",
      );
      await loadSettings();
    } catch (error: unknown) {
      setAccountFeedback(
        error instanceof Error
          ? error.message
          : "Unable to migrate repair records. Local guest data was not changed.",
      );
    } finally {
      setIsMigratingRepairRecords(false);
    }
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
                  available for cloud vehicles. Existing local records migrate
                  in focused slices, and local data stays on this device.
                </Text>
              </View>
              {guestMigrationSummary?.hasGuestData ? (
                <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
                  <Text className="text-sm leading-5 text-ledger-muted">
                    Local records are still on this device. Vehicle, odometer,
                    service record, and repair record migration are available as
                    separate steps without deleting local data.
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

        {user && guestMigrationSummary?.hasGuestData ? (
          <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-4">
            <View className="gap-1">
              <Text className="text-lg font-bold text-ledger-ink">
                Local Data / Migration Readiness
              </Text>
              <Text className="text-sm leading-5 text-ledger-muted">
                Local records found on this device. Migration is available in
                focused steps; it does not delete guest data or complete full
                cloud sync.
              </Text>
            </View>

            <SettingsRow
              label="Status"
              value="Vehicle, odometer, service, and repair migration available"
            />
            <SettingsRow
              label="Readiness"
              value={
                migrationRun
                  ? formatMigrationRunStatus(migrationRun.status)
                  : "Ready to review later"
              }
            />
            {migrationRun?.migration_scope === "vehicles" ? (
              <SettingsRow
                label="Vehicle run"
                value={`${migrationRun.migrated_vehicles} copied, ${migrationRun.skipped_vehicles} already present, ${migrationRun.failed_vehicles} failed`}
              />
            ) : null}
            {migrationRun?.migration_scope === "odometer_entries" ? (
              <SettingsRow
                label="Odometer run"
                value={`${migrationRun.migrated_odometer_entries} copied, ${migrationRun.skipped_odometer_entries} already present, ${migrationRun.skipped_odometer_entries_missing_vehicle_mapping} missing vehicle mapping, ${migrationRun.failed_odometer_entries} failed`}
              />
            ) : null}
            {migrationRun?.migration_scope === "service_records" ? (
              <SettingsRow
                label="Service run"
                value={`${migrationRun.migrated_service_records} copied, ${migrationRun.skipped_service_records} already present, ${migrationRun.skipped_service_records_missing_vehicle_mapping} missing vehicle mapping, ${migrationRun.failed_service_records} failed`}
              />
            ) : null}
            {migrationRun?.migration_scope === "repair_records" ? (
              <SettingsRow
                label="Repair run"
                value={`${migrationRun.migrated_repair_records} copied, ${migrationRun.skipped_repair_records} already present, ${migrationRun.skipped_repair_records_missing_vehicle_mapping} missing vehicle mapping, ${migrationRun.failed_repair_records} failed`}
              />
            ) : null}
            <SettingsRow
              label="Vehicle mappings"
              value={`${vehicleMigrationMappingCount}`}
            />
            <SettingsRow
              label="Service mappings"
              value={`${serviceRecordMigrationMappingCount}`}
            />
            <SettingsRow
              label="Repair mappings"
              value={`${repairRecordMigrationMappingCount}`}
            />
            <SettingsRow
              label="Vehicles"
              value={`${guestMigrationSummary.counts.activeVehicles} active, ${guestMigrationSummary.counts.archivedVehicles} archived`}
            />
            <SettingsRow
              label="Odometer entries"
              value={`${guestMigrationSummary.counts.odometerEntries}`}
            />
            <SettingsRow
              label="Service records"
              value={`${guestMigrationSummary.counts.serviceRecords}`}
            />
            <SettingsRow
              label="Repair records"
              value={`${guestMigrationSummary.counts.repairRecords}`}
            />
            <SettingsRow
              label="Reminders"
              value={`${guestMigrationSummary.counts.maintenanceReminders} total, ${guestMigrationSummary.counts.completedReminders} completed`}
            />
            <SettingsRow
              label="Attachments"
              value={`${guestMigrationSummary.counts.attachments}`}
            />

            <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
              <Text className="text-sm leading-5 text-ledger-muted">
                Before running migration, review
                packages/db/sql/004_verify_local_id_unique_constraints.sql in
                your live Supabase project. Vehicle, odometer, and service
                record migration, plus repair record migration, rely on `user_id
                + local_id` unique constraints to prevent duplicates.
              </Text>
            </View>

            <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
              <Text className="text-sm leading-5 text-ledger-muted">
                Run vehicle migration first. The odometer step copies odometer
                entries only and uses vehicle mappings to attach each reading to
                the right cloud vehicle. Service record migration can run after
                vehicle mappings exist. Repair record migration can also run
                after vehicle mappings exist. Reminders and attachments stay
                local until later migration slices.
              </Text>
            </View>

            {guestMigrationSummary.warnings.map((warning) => (
              <View
                className="rounded-card border border-ledger-line bg-ledger-background p-3"
                key={warning.code}
              >
                <Text className="text-sm leading-5 text-ledger-muted">
                  {warning.message}
                </Text>
              </View>
            ))}

            <Pressable
              accessibilityRole="button"
              className={`rounded-card px-4 py-3 ${
                isMigratingVehicles ||
                guestMigrationSummary.counts.totalVehicles === 0
                  ? "bg-ledger-primary opacity-60"
                  : "bg-ledger-primary"
              }`}
              disabled={
                isMigratingVehicles ||
                guestMigrationSummary.counts.totalVehicles === 0
              }
              onPress={() => {
                void migrateVehiclesToCurrentAccount();
              }}
            >
              <Text className="text-center text-base font-bold text-white">
                {isMigratingVehicles
                  ? "Migrating vehicles..."
                  : "Migrate vehicles to account"}
              </Text>
            </Pressable>

            {vehicleMigrationResult ? (
              <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
                <Text className="text-sm leading-5 text-ledger-muted">
                  Vehicle-only migration: {vehicleMigrationResult.migratedCount}{" "}
                  copied, {vehicleMigrationResult.skippedCount} already present,{" "}
                  {vehicleMigrationResult.failedCount} failed. No child records
                  were migrated, and local guest data was not deleted.
                </Text>
              </View>
            ) : null}

            {vehicleMigrationMappingCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                className={`rounded-card px-4 py-3 ${
                  isMigratingOdometerEntries ||
                  guestMigrationSummary.counts.odometerEntries === 0
                    ? "bg-ledger-primary opacity-60"
                    : "bg-ledger-primary"
                }`}
                disabled={
                  isMigratingOdometerEntries ||
                  guestMigrationSummary.counts.odometerEntries === 0
                }
                onPress={() => {
                  void migrateOdometerEntriesToCurrentAccount();
                }}
              >
                <Text className="text-center text-base font-bold text-white">
                  {isMigratingOdometerEntries
                    ? "Migrating odometer entries..."
                    : "Migrate odometer entries to account"}
                </Text>
              </Pressable>
            ) : (
              <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
                <Text className="text-sm leading-5 text-ledger-muted">
                  Odometer migration becomes available after vehicle migration
                  creates vehicle mappings for this account.
                </Text>
              </View>
            )}

            {odometerMigrationResult ? (
              <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
                <Text className="text-sm leading-5 text-ledger-muted">
                  Odometer-only migration:{" "}
                  {odometerMigrationResult.migratedCount} copied,{" "}
                  {odometerMigrationResult.skippedCount} already present,{" "}
                  {odometerMigrationResult.skippedMissingVehicleMappingCount}{" "}
                  skipped for missing vehicle mapping,{" "}
                  {odometerMigrationResult.failedCount} failed. No service,
                  repair, reminder, or attachment records were migrated, and
                  local guest data was not deleted.
                </Text>
              </View>
            ) : null}

            {vehicleMigrationMappingCount > 0 ? (
              <View className="gap-3">
                <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
                  <Text className="text-sm leading-5 text-ledger-muted">
                    This step copies service records only and uses vehicle
                    mappings to attach them to cloud vehicles. Repair records,
                    reminders, and attachments stay local until later migration
                    slices.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  className={`rounded-card px-4 py-3 ${
                    isMigratingServiceRecords ||
                    guestMigrationSummary.counts.serviceRecords === 0
                      ? "bg-ledger-primary opacity-60"
                      : "bg-ledger-primary"
                  }`}
                  disabled={
                    isMigratingServiceRecords ||
                    guestMigrationSummary.counts.serviceRecords === 0
                  }
                  onPress={() => {
                    void migrateServiceRecordsToCurrentAccount();
                  }}
                >
                  <Text className="text-center text-base font-bold text-white">
                    {isMigratingServiceRecords
                      ? "Migrating service records..."
                      : "Migrate service records to account"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {serviceRecordMigrationResult ? (
              <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
                <Text className="text-sm leading-5 text-ledger-muted">
                  Service-record-only migration:{" "}
                  {serviceRecordMigrationResult.migratedCount} copied,{" "}
                  {serviceRecordMigrationResult.skippedCount} already present,{" "}
                  {
                    serviceRecordMigrationResult.skippedMissingVehicleMappingCount
                  }{" "}
                  skipped for missing vehicle mapping,{" "}
                  {serviceRecordMigrationResult.failedCount} failed. No repair,
                  reminder, or attachment records were migrated, and local guest
                  data was not deleted.
                </Text>
              </View>
            ) : null}

            {vehicleMigrationMappingCount > 0 ? (
              <View className="gap-3">
                <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
                  <Text className="text-sm leading-5 text-ledger-muted">
                    This step copies repair records only and uses vehicle
                    mappings to attach them to cloud vehicles. Reminders and
                    attachments stay local until later migration slices.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  className={`rounded-card px-4 py-3 ${
                    isMigratingRepairRecords ||
                    guestMigrationSummary.counts.repairRecords === 0
                      ? "bg-ledger-primary opacity-60"
                      : "bg-ledger-primary"
                  }`}
                  disabled={
                    isMigratingRepairRecords ||
                    guestMigrationSummary.counts.repairRecords === 0
                  }
                  onPress={() => {
                    void migrateRepairRecordsToCurrentAccount();
                  }}
                >
                  <Text className="text-center text-base font-bold text-white">
                    {isMigratingRepairRecords
                      ? "Migrating repair records..."
                      : "Migrate repair records to account"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {repairRecordMigrationResult ? (
              <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
                <Text className="text-sm leading-5 text-ledger-muted">
                  Repair-record-only migration:{" "}
                  {repairRecordMigrationResult.migratedCount} copied,{" "}
                  {repairRecordMigrationResult.skippedCount} already present,{" "}
                  {
                    repairRecordMigrationResult.skippedMissingVehicleMappingCount
                  }{" "}
                  skipped for missing vehicle mapping,{" "}
                  {repairRecordMigrationResult.failedCount} failed. No reminder
                  or attachment records were migrated, and local guest data was
                  not deleted.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

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

function formatMigrationRunStatus(status: MigrationRun["status"]) {
  const labels: Record<MigrationRun["status"], string> = {
    completed: "Migration completed",
    completed_with_errors: "Migration completed with issues",
    failed: "Migration failed",
    not_started: "Not started",
    pending: "Pending",
    running: "Migration running",
    skipped: "Skipped",
    synced: "Synced",
  };

  return labels[status];
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
