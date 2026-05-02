import {
  buildVehicleHistoryItems,
  formatCostAmount,
  formatDisplayDate,
  formatMaintenanceReminderCategory,
  formatOdometer,
  getMaintenanceReminderStatus,
  maintenanceReminderStatusLabels,
  type MaintenanceReminder,
  type OdometerEntry,
  type RepairRecord,
  type ServiceRecord,
  type Vehicle,
  type VehicleHistoryItem,
} from "@autoledger/shared";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { VehicleSummaryCard } from "../components/VehicleSummaryCard";
import {
  listArchivedCloudVehicles,
  listCloudVehicles,
} from "../lib/cloudVehicles";
import { listCloudOdometerEntries } from "../lib/cloudOdometerEntries";
import { useAuth } from "../lib/auth";
import { hasAnyLocalGuestData } from "../lib/localGuestData";
import { listAllActiveMaintenanceReminders } from "../lib/maintenanceReminders";
import { listOdometerEntries } from "../lib/odometerEntries";
import { listRepairRecords } from "../lib/repairRecords";
import { listServiceRecords } from "../lib/serviceRecords";
import { listArchivedVehicles, listVehicles } from "../lib/vehicles";

type VehicleDashboardItem = {
  historyItems: VehicleHistoryItem[];
  odometerEntries: OdometerEntry[];
  repairRecords: RepairRecord[];
  serviceRecords: ServiceRecord[];
  vehicle: Vehicle;
};

type RecentActivityItem = VehicleHistoryItem & {
  vehicle: Vehicle;
};

type DashboardReminderItem = {
  reminder: MaintenanceReminder;
  vehicle: Vehicle;
};

type DashboardCounts = {
  archivedVehicles: number;
  reminders: number;
  odometerEntries: number;
  repairRecords: number;
  serviceRecords: number;
  vehicles: number;
};

type StorageMode = "cloud" | "local";

const emptyCounts: DashboardCounts = {
  archivedVehicles: 0,
  reminders: 0,
  odometerEntries: 0,
  repairRecords: 0,
  serviceRecords: 0,
  vehicles: 0,
};

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  count === 1 ? singular : plural;

export default function HomeScreen() {
  const { isLoading: isAuthLoading, user } = useAuth();
  const [counts, setCounts] = useState<DashboardCounts>(emptyCounts);
  const [dashboardItems, setDashboardItems] = useState<VehicleDashboardItem[]>(
    [],
  );
  const [hasLocalGuestRecords, setHasLocalGuestRecords] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>(
    [],
  );
  const [upcomingReminders, setUpcomingReminders] = useState<
    DashboardReminderItem[]
  >([]);
  const storageMode: StorageMode = user ? "cloud" : "local";

  const loadDashboard = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      if (storageMode === "cloud") {
        const [nextVehicles, nextHasLocalGuestRecords] = await Promise.all([
          listCloudVehicles(),
          hasAnyLocalGuestData(),
        ]);
        let archivedVehicleCount = 0;

        try {
          archivedVehicleCount = (await listArchivedCloudVehicles()).length;
        } catch (error: unknown) {
          console.warn("Unable to load archived cloud vehicle count.", error);
        }

        const nextDashboardItems = await Promise.all(
          nextVehicles.map(async (vehicle) => {
            const odometerEntries = await listCloudOdometerEntries(vehicle.id);

            return {
              historyItems: buildVehicleHistoryItems({
                odometerEntries,
                repairRecords: [],
                serviceRecords: [],
              }),
              odometerEntries,
              repairRecords: [],
              serviceRecords: [],
              vehicle,
            };
          }),
        );

        setDashboardItems(nextDashboardItems);
        setHasLocalGuestRecords(nextHasLocalGuestRecords);
        setRecentActivity([]);
        setUpcomingReminders([]);
        setCounts({
          archivedVehicles: archivedVehicleCount,
          reminders: 0,
          odometerEntries: nextDashboardItems.reduce(
            (total, item) => total + item.odometerEntries.length,
            0,
          ),
          repairRecords: 0,
          serviceRecords: 0,
          vehicles: nextVehicles.length,
        });
        return;
      }

      const [nextVehicles, nextArchivedVehicles, nextActiveReminders] =
        await Promise.all([
          listVehicles(),
          listArchivedVehicles(),
          listAllActiveMaintenanceReminders(),
        ]);
      const vehicleById = Object.fromEntries(
        nextVehicles.map((vehicle) => [vehicle.id, vehicle]),
      );
      const nextDashboardItems = await Promise.all(
        nextVehicles.map(async (vehicle) => {
          const [odometerEntries, serviceRecords, repairRecords] =
            await Promise.all([
              listOdometerEntries(vehicle.id),
              listServiceRecords(vehicle.id),
              listRepairRecords(vehicle.id),
            ]);

          return {
            historyItems: buildVehicleHistoryItems({
              odometerEntries,
              repairRecords,
              serviceRecords,
            }),
            odometerEntries,
            repairRecords,
            serviceRecords,
            vehicle,
          };
        }),
      );
      const allRecentActivity = nextDashboardItems
        .flatMap((item) =>
          item.historyItems.map(
            (historyItem): RecentActivityItem => ({
              ...historyItem,
              vehicle: item.vehicle,
            }),
          ),
        )
        .sort((first, second) => {
          const dateComparison = second.date.localeCompare(first.date);

          if (dateComparison !== 0) {
            return dateComparison;
          }

          return second.created_at.localeCompare(first.created_at);
        })
        .slice(0, 5);
      const nextUpcomingReminders = nextActiveReminders
        .map((reminder) => {
          const vehicle = vehicleById[reminder.vehicle_id];

          return vehicle ? { reminder, vehicle } : null;
        })
        .filter((item): item is DashboardReminderItem => item !== null)
        .slice(0, 5);

      setDashboardItems(nextDashboardItems);
      setRecentActivity(allRecentActivity);
      setUpcomingReminders(nextUpcomingReminders);
      setCounts({
        archivedVehicles: nextArchivedVehicles.length,
        reminders: nextActiveReminders.length,
        odometerEntries: nextDashboardItems.reduce(
          (total, item) => total + item.odometerEntries.length,
          0,
        ),
        repairRecords: nextDashboardItems.reduce(
          (total, item) => total + item.repairRecords.length,
          0,
        ),
        serviceRecords: nextDashboardItems.reduce(
          (total, item) => total + item.serviceRecords.length,
          0,
        ),
        vehicles: nextVehicles.length,
      });
      setHasLocalGuestRecords(false);
    } catch (error: unknown) {
      console.warn("Unable to load dashboard.", error);
      setLoadError(
        storageMode === "cloud"
          ? error instanceof Error
            ? error.message
            : "Unable to load your cloud vehicles. Please check your connection and try again."
          : "Unable to load your local dashboard. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthLoading, storageMode]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ScrollView contentContainerClassName="gap-6 px-6 py-6 pb-28">
        <View className="gap-3 pt-4">
          <Text className="text-sm font-bold uppercase text-ledger-primary">
            {storageMode === "cloud" ? "Account dashboard" : "Guest dashboard"}
          </Text>
          <Text className="text-4xl font-extrabold text-ledger-ink">
            AutoLedger
          </Text>
          <Text className="text-lg leading-7 text-ledger-muted">
            {storageMode === "cloud"
              ? "Vehicles and odometer readings are saved to your account. Full record sync is still coming soon."
              : "Your vehicle records stay local on this device. Cloud backup and sync remain optional later."}
          </Text>
          {storageMode === "cloud" && hasLocalGuestRecords ? (
            <View className="rounded-card border border-ledger-line bg-ledger-surface p-3">
              <Text className="text-sm leading-5 text-ledger-muted">
                Cloud sync for existing local records is coming soon. New cloud
                vehicles and odometer readings will be saved to your account.
              </Text>
            </View>
          ) : null}
          <View className="mt-2 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              className="flex-1 rounded-card bg-ledger-primary px-4 py-3"
              onPress={() => router.push("/vehicles/new" as Href)}
            >
              <Text className="text-center text-base font-bold text-white">
                Add Vehicle
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="rounded-card border border-ledger-line bg-ledger-surface px-4 py-3"
              onPress={() => router.push("/settings" as Href)}
            >
              <Text className="text-center text-base font-bold text-ledger-ink">
                Settings
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="rounded-card border border-ledger-line bg-ledger-surface px-4 py-3"
              onPress={() => router.push("/vehicles/archived" as Href)}
            >
              <Text className="text-center text-base font-bold text-ledger-ink">
                Archived
              </Text>
            </Pressable>
          </View>
        </View>

        {isLoading || isAuthLoading ? (
          <View className="rounded-card border border-ledger-line bg-ledger-surface p-6">
            <ActivityIndicator color="#136f63" />
          </View>
        ) : loadError ? (
          <View className="gap-3 rounded-card border border-red-200 bg-ledger-surface p-5">
            <Text className="text-xl font-bold text-ledger-ink">
              Dashboard unavailable
            </Text>
            <Text className="text-base leading-6 text-ledger-muted">
              {loadError}
            </Text>
            <Pressable
              accessibilityRole="button"
              className="rounded-card bg-ledger-primary px-4 py-3"
              onPress={() => {
                void loadDashboard();
              }}
            >
              <Text className="text-center text-base font-bold text-white">
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : dashboardItems.length === 0 ? (
          <EmptyDashboard
            archivedVehicleCount={counts.archivedVehicles}
            storageMode={storageMode}
          />
        ) : (
          <>
            <SummarySection counts={counts} storageMode={storageMode} />
            <VehiclesSection
              dashboardItems={dashboardItems}
              storageMode={storageMode}
            />
            {storageMode === "local" ? (
              <>
                <UpcomingRemindersSection reminders={upcomingReminders} />
                <RecentActivitySection recentActivity={recentActivity} />
              </>
            ) : (
              <CloudRecordsNotice />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EmptyDashboard({
  archivedVehicleCount,
  storageMode,
}: {
  archivedVehicleCount: number;
  storageMode: StorageMode;
}) {
  return (
    <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-5">
      <View className="gap-2">
        <Text className="text-2xl font-extrabold text-ledger-ink">
          Start your local garage
        </Text>
        <Text className="text-base leading-6 text-ledger-muted">
          {storageMode === "cloud"
            ? "Add a vehicle to your account. Vehicle details will be saved in Supabase under your signed-in user."
            : "Add a daily driver, family car, motorcycle, or any vehicle you want to track. You can log mileage, service, and repairs without creating an account."}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        className="rounded-card bg-ledger-primary px-4 py-4"
        onPress={() => router.push("/vehicles/new" as Href)}
      >
        <Text className="text-center text-base font-bold text-white">
          Add Your First Vehicle
        </Text>
      </Pressable>
      {archivedVehicleCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          className="rounded-card border border-ledger-line bg-ledger-background px-4 py-3"
          onPress={() => router.push("/vehicles/archived" as Href)}
        >
          <Text className="text-center text-base font-bold text-ledger-ink">
            View Archived Vehicles
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SummarySection({
  counts,
  storageMode,
}: {
  counts: DashboardCounts;
  storageMode: StorageMode;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <Text className="text-sm font-bold uppercase text-ledger-primary">
            Overview
          </Text>
          <Text className="mt-1 text-2xl font-extrabold text-ledger-ink">
            {storageMode === "cloud" ? "Cloud vehicles" : "Local records"}
          </Text>
        </View>
        <Text className="text-sm font-semibold text-ledger-muted">
          {storageMode === "cloud" ? "Account mode" : "Guest mode"}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-3">
        <StatCard
          label={pluralize(counts.vehicles, "vehicle")}
          value={counts.vehicles}
        />
        <StatCard
          label={pluralize(counts.archivedVehicles, "archived vehicle")}
          value={counts.archivedVehicles}
        />
        <StatCard
          label={pluralize(counts.serviceRecords, "service record")}
          value={counts.serviceRecords}
        />
        <StatCard
          label={pluralize(counts.repairRecords, "repair record")}
          value={counts.repairRecords}
        />
        <StatCard
          label={pluralize(
            counts.odometerEntries,
            "odometer entry",
            "odometer entries",
          )}
          value={counts.odometerEntries}
        />
        <StatCard
          label={pluralize(counts.reminders, "active reminder")}
          value={counts.reminders}
        />
      </View>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View className="min-w-[132px] flex-1 rounded-card border border-ledger-line bg-ledger-surface p-4">
      <Text className="text-3xl font-extrabold text-ledger-ink">{value}</Text>
      <Text className="mt-1 text-xs font-bold uppercase leading-4 text-ledger-muted">
        {label}
      </Text>
    </View>
  );
}

function VehiclesSection({
  dashboardItems,
  storageMode,
}: {
  dashboardItems: VehicleDashboardItem[];
  storageMode: StorageMode;
}) {
  return (
    <View className="gap-3">
      <View>
        <Text className="text-2xl font-extrabold text-ledger-ink">
          Vehicles
        </Text>
        <Text className="mt-1 text-sm leading-5 text-ledger-muted">
          {storageMode === "cloud"
            ? "Tap into a vehicle to review account-saved details."
            : "Tap into a vehicle to review details, history, and local records."}
        </Text>
      </View>
      <View className="gap-3">
        {dashboardItems.map((item) => (
          <DashboardVehicleCard
            item={item}
            key={item.vehicle.id}
            storageMode={storageMode}
          />
        ))}
      </View>
    </View>
  );
}

function DashboardVehicleCard({
  item,
  storageMode,
}: {
  item: VehicleDashboardItem;
  storageMode: StorageMode;
}) {
  const latestHistoryItem = item.historyItems[0];

  return (
    <VehicleSummaryCard
      footer={
        <View className="gap-3">
          <View className="gap-2 rounded-card bg-ledger-background p-3">
            <Text className="text-xs font-bold uppercase text-ledger-muted">
              Latest activity
            </Text>
            {latestHistoryItem ? (
              <>
                <Text className="text-sm font-bold text-ledger-ink">
                  {latestHistoryItem.typeLabel} - {latestHistoryItem.title}
                </Text>
                <Text className="text-sm leading-5 text-ledger-muted">
                  {formatDisplayDate(latestHistoryItem.date)}
                </Text>
              </>
            ) : (
              <Text className="text-sm leading-5 text-ledger-muted">
                {storageMode === "cloud"
                  ? "No cloud odometer history yet. Add a reading from the vehicle detail screen."
                  : "No local history yet. Add a reading, service record, or repair record from the vehicle detail screen."}
              </Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            className="rounded-card bg-ledger-primary px-4 py-3"
            onPress={() => router.push(`/vehicles/${item.vehicle.id}` as Href)}
          >
            <Text className="text-center text-sm font-bold text-white">
              View Vehicle
            </Text>
          </Pressable>
        </View>
      }
      vehicle={item.vehicle}
    />
  );
}

function CloudRecordsNotice() {
  return (
    <View className="gap-2 rounded-card border border-ledger-line bg-ledger-surface p-4">
      <Text className="text-base font-bold text-ledger-ink">
        Cloud record status
      </Text>
      <Text className="text-sm leading-5 text-ledger-muted">
        Account mode currently saves vehicle details and cloud odometer entries.
        Cloud service records, repair records, reminders, attachments, CSV
        export, and guest-to-account migration are intentionally deferred.
      </Text>
    </View>
  );
}

function UpcomingRemindersSection({
  reminders,
}: {
  reminders: DashboardReminderItem[];
}) {
  return (
    <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
      <View className="gap-1">
        <Text className="text-lg font-bold text-ledger-ink">
          Upcoming Reminders
        </Text>
        <Text className="text-sm leading-5 text-ledger-muted">
          The most urgent active date and mileage reminders across your local
          vehicles.
        </Text>
      </View>
      {reminders.length === 0 ? (
        <View className="rounded-card bg-ledger-background p-3">
          <Text className="text-sm leading-5 text-ledger-muted">
            No active reminders yet. Add one from a vehicle detail screen.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {reminders.map((item) => (
            <DashboardReminderCard item={item} key={item.reminder.id} />
          ))}
        </View>
      )}
    </View>
  );
}

function DashboardReminderCard({ item }: { item: DashboardReminderItem }) {
  const status = getMaintenanceReminderStatus({
    currentOdometer: item.vehicle.current_odometer,
    reminder: item.reminder,
  });

  return (
    <Pressable
      accessibilityRole="button"
      className="gap-2 rounded-card border border-ledger-line bg-ledger-background p-3"
      onPress={() =>
        router.push(
          `/vehicles/${item.vehicle.id}/reminders/${item.reminder.id}` as Href,
        )
      }
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-xs font-bold uppercase text-ledger-primary">
            {formatMaintenanceReminderCategory(item.reminder.category)}
          </Text>
          <Text className="text-base font-bold text-ledger-ink">
            {item.reminder.title}
          </Text>
          <Text className="text-sm text-ledger-muted">
            {item.vehicle.nickname}
          </Text>
        </View>
        <View className="rounded-card bg-ledger-surface px-2 py-1">
          <Text className="text-xs font-bold uppercase text-ledger-muted">
            {maintenanceReminderStatusLabels[status]}
          </Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {item.reminder.due_date ? (
          <View className="rounded-card bg-ledger-surface px-2 py-1">
            <Text className="text-xs font-bold uppercase text-ledger-muted">
              {formatDisplayDate(item.reminder.due_date)}
            </Text>
          </View>
        ) : null}
        {item.reminder.due_odometer === null ||
        item.reminder.due_odometer === undefined ? null : (
          <View className="rounded-card bg-ledger-surface px-2 py-1">
            <Text className="text-xs font-bold uppercase text-ledger-muted">
              Due{" "}
              {formatOdometer(
                item.reminder.due_odometer,
                item.vehicle.odometer_unit,
              )}
            </Text>
          </View>
        )}
        <View className="rounded-card bg-ledger-surface px-2 py-1">
          <Text className="text-xs font-bold uppercase text-ledger-muted">
            Current{" "}
            {formatOdometer(
              item.vehicle.current_odometer,
              item.vehicle.odometer_unit,
            )}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function RecentActivitySection({
  recentActivity,
}: {
  recentActivity: RecentActivityItem[];
}) {
  return (
    <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
      <View className="gap-1">
        <Text className="text-lg font-bold text-ledger-ink">
          Recent Activity
        </Text>
        <Text className="text-sm leading-5 text-ledger-muted">
          The latest local mileage, service, and repair records across active
          vehicles.
        </Text>
      </View>
      {recentActivity.length === 0 ? (
        <View className="rounded-card bg-ledger-background p-3">
          <Text className="text-sm leading-5 text-ledger-muted">
            No activity yet. Add an odometer reading, service record, or repair
            record to see it here.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {recentActivity.map((item) => (
            <RecentActivityCard item={item} key={`${item.type}-${item.id}`} />
          ))}
        </View>
      )}
    </View>
  );
}

function RecentActivityCard({ item }: { item: RecentActivityItem }) {
  const openItem = () => {
    if (item.type === "service") {
      router.push(`/vehicles/${item.vehicle_id}/service/${item.id}` as Href);
      return;
    }

    if (item.type === "repair") {
      router.push(`/vehicles/${item.vehicle_id}/repair/${item.id}` as Href);
      return;
    }

    router.push(
      `/vehicles/${item.vehicle_id}/odometer/${item.id}/edit` as Href,
    );
  };
  const odometerUnit =
    item.type === "odometer"
      ? item.source.odometer_unit
      : item.vehicle.odometer_unit;

  return (
    <Pressable
      accessibilityRole="button"
      className="gap-2 rounded-card border border-ledger-line bg-ledger-background p-3"
      onPress={openItem}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-xs font-bold uppercase text-ledger-primary">
            {item.typeLabel}
          </Text>
          <Text className="text-base font-bold text-ledger-ink">
            {item.title}
          </Text>
          <Text className="text-sm text-ledger-muted">
            {item.vehicle.nickname} - {formatDisplayDate(item.date)}
          </Text>
        </View>
        {item.categoryLabel ? (
          <View className="rounded-card bg-ledger-surface px-2 py-1">
            <Text className="text-xs font-bold uppercase text-ledger-muted">
              {item.categoryLabel}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {item.odometer_reading === null ||
        item.odometer_reading === undefined ? null : (
          <View className="rounded-card bg-ledger-surface px-2 py-1">
            <Text className="text-xs font-bold uppercase text-ledger-muted">
              {formatOdometer(item.odometer_reading, odometerUnit)}
            </Text>
          </View>
        )}
        {item.cost_amount === null || item.cost_amount === undefined ? null : (
          <View className="rounded-card bg-ledger-surface px-2 py-1">
            <Text className="text-xs font-bold uppercase text-ledger-muted">
              {formatCostAmount(item.cost_amount, item.cost_currency)}
            </Text>
          </View>
        )}
        {item.vendor_name ? (
          <View className="rounded-card bg-ledger-surface px-2 py-1">
            <Text className="text-xs font-bold uppercase text-ledger-muted">
              {item.vendor_name}
            </Text>
          </View>
        ) : null}
      </View>
      {item.summary ? (
        <Text className="text-sm leading-5 text-ledger-muted" numberOfLines={2}>
          {item.summary}
        </Text>
      ) : null}
    </Pressable>
  );
}
