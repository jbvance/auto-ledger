import {
  buildVehicleHistoryItems,
  compareMaintenanceRemindersByUrgency,
  formatCostAmount,
  formatDisplayDate,
  formatMaintenanceReminderCategory,
  formatOdometer,
  formatVehicleSubtitle,
  formatVehicleTitle,
  getMaintenanceReminderStatus,
  type MaintenanceReminder,
  odometerUnitLabels,
  type OdometerEntry,
  type RepairRecord,
  type ServiceRecord,
  type VehicleHistoryItem,
  vehicleTypeLabels,
  type Vehicle,
} from "@autoledger/shared";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ReminderStatusPill } from "../../components/ReminderStatusPill";
import { archiveCloudVehicle, getCloudVehicle } from "../../lib/cloudVehicles";
import { listCloudMaintenanceReminders } from "../../lib/cloudMaintenanceReminders";
import { listCloudOdometerEntries } from "../../lib/cloudOdometerEntries";
import { listCloudRepairRecords } from "../../lib/cloudRepairRecords";
import { listCloudServiceRecords } from "../../lib/cloudServiceRecords";
import { useAuth } from "../../lib/auth";
import { listOdometerEntries } from "../../lib/odometerEntries";
import { listMaintenanceReminders } from "../../lib/maintenanceReminders";
import { listRepairRecords } from "../../lib/repairRecords";
import { listServiceRecords } from "../../lib/serviceRecords";
import { archiveVehicle, getVehicle } from "../../lib/vehicles";

type VehicleDetailSection = "overview" | "history" | "reminders";

const vehicleDetailSections: { label: string; value: VehicleDetailSection }[] =
  [
    { label: "Overview", value: "overview" },
    { label: "History", value: "history" },
    { label: "Reminders", value: "reminders" },
  ];

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isLoading: isAuthLoading, user } = useAuth();
  const isCloudMode = Boolean(user);
  const [activeSection, setActiveSection] =
    useState<VehicleDetailSection>("overview");
  const [maintenanceReminders, setMaintenanceReminders] = useState<
    MaintenanceReminder[]
  >([]);
  const [odometerEntries, setOdometerEntries] = useState<OdometerEntry[]>([]);
  const [repairRecords, setRepairRecords] = useState<RepairRecord[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isArchiving, setIsArchiving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadVehicle = useCallback(async () => {
    if (!id || isAuthLoading) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      if (isCloudMode) {
        const [
          nextVehicle,
          nextOdometerEntries,
          nextServiceRecords,
          nextRepairRecords,
          nextMaintenanceReminders,
        ] = await Promise.all([
          getCloudVehicle(id),
          listCloudOdometerEntries(id),
          listCloudServiceRecords(id),
          listCloudRepairRecords(id),
          listCloudMaintenanceReminders(id),
        ]);

        setVehicle(nextVehicle);
        setOdometerEntries(nextOdometerEntries);
        setServiceRecords(nextServiceRecords);
        setRepairRecords(nextRepairRecords);
        setMaintenanceReminders(nextMaintenanceReminders);
        return;
      }

      const [
        nextVehicle,
        nextOdometerEntries,
        nextServiceRecords,
        nextRepairRecords,
        nextMaintenanceReminders,
      ] = await Promise.all([
        getVehicle(id),
        listOdometerEntries(id),
        listServiceRecords(id),
        listRepairRecords(id),
        listMaintenanceReminders(id),
      ]);
      setVehicle(nextVehicle);
      setOdometerEntries(nextOdometerEntries);
      setServiceRecords(nextServiceRecords);
      setRepairRecords(nextRepairRecords);
      setMaintenanceReminders(nextMaintenanceReminders);
    } catch (error: unknown) {
      setLoadError(
        isCloudMode
          ? error instanceof Error
            ? error.message
            : "Unable to load this cloud vehicle. Please check your connection and try again."
          : "Unable to load this local vehicle. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [id, isAuthLoading, isCloudMode]);

  useFocusEffect(
    useCallback(() => {
      void loadVehicle();
    }, [loadVehicle]),
  );

  const confirmArchive = () => {
    if (!vehicle) {
      return;
    }

    Alert.alert(
      "Archive vehicle?",
      `${vehicle.nickname} will be hidden from your active vehicle list.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Archive",
          style: "destructive",
          onPress: () => {
            void archiveCurrentVehicle();
          },
        },
      ],
    );
  };

  const openAddMenu = () => {
    if (!vehicle) {
      return;
    }

    Alert.alert("Add record", "Choose what you want to add.", [
      {
        text: "Odometer",
        onPress: () =>
          router.push(`/vehicles/${vehicle.id}/odometer/new` as Href),
      },
      {
        text: "Service",
        onPress: () =>
          router.push(`/vehicles/${vehicle.id}/service/new` as Href),
      },
      {
        text: "Repair",
        onPress: () =>
          router.push(`/vehicles/${vehicle.id}/repair/new` as Href),
      },
      {
        text: "Reminder",
        onPress: () =>
          router.push(`/vehicles/${vehicle.id}/reminders/new` as Href),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const openVehicleMenu = () => {
    if (!vehicle) {
      return;
    }

    Alert.alert(formatVehicleTitle(vehicle), "Vehicle options", [
      {
        text: "Edit Vehicle",
        onPress: () => router.push(`/vehicles/${vehicle.id}/edit` as Href),
      },
      {
        text: "Archive",
        style: "destructive",
        onPress: confirmArchive,
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const archiveCurrentVehicle = async () => {
    if (!vehicle) {
      return;
    }

    setActionError(null);
    setIsArchiving(true);
    try {
      if (isCloudMode) {
        await archiveCloudVehicle(vehicle.id);
      } else {
        await archiveVehicle(vehicle.id);
      }

      router.replace("/");
    } catch {
      setActionError(
        isCloudMode
          ? "Unable to archive this cloud vehicle. Please check your connection and try again."
          : "Unable to archive this local vehicle. Please try again.",
      );
    } finally {
      setIsArchiving(false);
    }
  };

  if (isLoading || isAuthLoading) {
    return (
      <SafeAreaView className="flex-1 bg-ledger-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#136f63" />
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView className="flex-1 bg-ledger-background">
        <View className="flex-1 justify-center gap-4 px-6">
          <Text className="text-2xl font-bold text-ledger-ink">
            Vehicle not found
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            {loadError ??
              (isCloudMode
                ? "This vehicle may have been archived or is not available for this account."
                : "This vehicle may have been archived or removed from local storage.")}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="rounded-card bg-ledger-primary px-4 py-3"
            onPress={() => router.replace("/")}
          >
            <Text className="text-center text-base font-bold text-white">
              Back to Vehicles
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const historyItems = buildVehicleHistoryItems({
    odometerEntries,
    repairRecords,
    serviceRecords,
  });
  const sortedReminders = [...maintenanceReminders].sort((first, second) =>
    compareMaintenanceRemindersByUrgency(first, second, {
      [vehicle.id]: vehicle.current_odometer,
    }),
  );
  const activeReminders = sortedReminders.filter(
    (reminder) => !reminder.is_completed,
  );
  const completedReminders = sortedReminders.filter(
    (reminder) => reminder.is_completed,
  );

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        <View className="gap-2 pt-4">
          <Text className="text-sm font-bold uppercase text-ledger-primary">
            {isCloudMode ? "Cloud vehicle" : "Vehicle detail"}
          </Text>
          <Text className="text-4xl font-extrabold text-ledger-ink">
            {formatVehicleTitle(vehicle)}
          </Text>
          <Text className="text-lg leading-7 text-ledger-muted">
            {formatVehicleSubtitle(vehicle)}
          </Text>
          <View className="mt-2 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              className="flex-1 rounded-card bg-ledger-primary px-4 py-3"
              onPress={openAddMenu}
            >
              <Text className="text-center text-base font-bold text-white">
                Add Record
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="rounded-card border border-ledger-line bg-ledger-surface px-4 py-3"
              disabled={isArchiving}
              onPress={openVehicleMenu}
            >
              <Text className="text-center text-base font-bold text-ledger-ink">
                {isArchiving ? "..." : "More"}
              </Text>
            </Pressable>
          </View>
          {actionError ? (
            <View className="rounded-card border border-red-200 bg-ledger-surface p-3">
              <Text className="text-sm leading-5 text-ledger-muted">
                {actionError}
              </Text>
            </View>
          ) : null}
        </View>

        <VehicleSectionTabs
          activeSection={activeSection}
          onChange={setActiveSection}
        />

        {activeSection === "overview" ? (
          <>
            <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
              <Text className="text-lg font-bold text-ledger-ink">
                Overview
              </Text>
              <DetailRow
                label="Current odometer"
                value={formatOdometer(
                  vehicle.current_odometer,
                  vehicle.odometer_unit,
                )}
              />
              <DetailRow
                label="Vehicle type"
                value={vehicleTypeLabels[vehicle.vehicle_type]}
              />
              <DetailRow
                label="Odometer unit"
                value={odometerUnitLabels[vehicle.odometer_unit]}
              />
              <DetailRow label="Color" value={vehicle.color} />
              <DetailRow label="VIN" value={vehicle.vin} />
              <DetailRow label="License plate" value={vehicle.license_plate} />
              <DetailRow label="License state" value={vehicle.license_state} />
            </View>

            <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
              <Text className="text-lg font-bold text-ledger-ink">
                Ownership
              </Text>
              <DetailRow label="Purchase date" value={vehicle.purchase_date} />
              <DetailRow
                label="Purchase odometer"
                value={
                  vehicle.purchase_odometer === null ||
                  vehicle.purchase_odometer === undefined
                    ? null
                    : formatOdometer(
                        vehicle.purchase_odometer,
                        vehicle.odometer_unit,
                      )
                }
              />
              <DetailRow label="Notes" value={vehicle.notes} />
            </View>
          </>
        ) : null}

        {activeSection === "history" ? (
          <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
            <View className="gap-1">
              <Text className="text-lg font-bold text-ledger-ink">History</Text>
              <Text className="text-sm leading-5 text-ledger-muted">
                {isCloudMode
                  ? "Cloud odometer readings, service records, and repair records appear here newest first."
                  : "Odometer entries, service records, and repair records appear here newest first."}
              </Text>
            </View>
            {historyItems.length === 0 ? (
              <View className="gap-2 rounded-card border border-ledger-line bg-ledger-background p-4">
                <Text className="text-base font-bold text-ledger-ink">
                  No history yet
                </Text>
                <Text className="text-sm leading-5 text-ledger-muted">
                  {isCloudMode
                    ? "Add an odometer reading, service record, or repair record to build this vehicle's cloud history."
                    : "Add an odometer reading, service record, or repair record to build this vehicle's local timeline."}
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {historyItems.map((item) => (
                  <HistoryItemCard
                    item={item}
                    key={`${item.type}-${item.id}`}
                    vehicle={vehicle}
                  />
                ))}
              </View>
            )}
          </View>
        ) : null}

        {activeSection === "reminders" ? (
          <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-lg font-bold text-ledger-ink">
                  Reminders
                </Text>
                <Text className="text-sm leading-5 text-ledger-muted">
                  {isCloudMode
                    ? "Date and mileage reminders are saved to your account for this cloud vehicle. Cloud push notifications are not implemented yet."
                    : "Date and mileage reminders stay local on this device."}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                className="rounded-card bg-ledger-primary px-3 py-2"
                onPress={() =>
                  router.push(`/vehicles/${vehicle.id}/reminders/new` as Href)
                }
              >
                <Text className="text-sm font-bold text-white">Add</Text>
              </Pressable>
            </View>
            {activeReminders.length === 0 && completedReminders.length === 0 ? (
              <View className="gap-2 rounded-card border border-ledger-line bg-ledger-background p-4">
                <Text className="text-base font-bold text-ledger-ink">
                  No reminders yet
                </Text>
                <Text className="text-sm leading-5 text-ledger-muted">
                  Add a date, mileage, or date-or-mileage reminder for upcoming
                  maintenance.
                </Text>
              </View>
            ) : (
              <View className="gap-4">
                {activeReminders.length > 0 ? (
                  <View className="gap-3">
                    <Text className="text-xs font-bold uppercase text-ledger-muted">
                      Active
                    </Text>
                    {activeReminders.map((reminder) => (
                      <ReminderCard
                        key={reminder.id}
                        reminder={reminder}
                        vehicle={vehicle}
                      />
                    ))}
                  </View>
                ) : null}
                {completedReminders.length > 0 ? (
                  <View className="gap-3">
                    <Text className="text-xs font-bold uppercase text-ledger-muted">
                      Completed
                    </Text>
                    {completedReminders.map((reminder) => (
                      <ReminderCard
                        key={reminder.id}
                        reminder={reminder}
                        vehicle={vehicle}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {activeSection === "overview" && isCloudMode ? (
          <CloudVehicleRecordsNotice />
        ) : null}

        {activeSection === "overview" ? (
          <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
            <Text className="text-base font-bold text-ledger-ink">
              {isCloudMode ? "Cloud storage" : "Local storage"}
            </Text>
            <Text className="text-sm leading-5 text-ledger-muted">
              {isCloudMode
                ? "This vehicle, its records, reminders, and service/repair attachments are saved to your account through Supabase RLS and private Storage."
                : "This vehicle is saved locally on this device. Cloud backup and sync are optional later."}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CloudVehicleRecordsNotice() {
  return (
    <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
      <Text className="text-lg font-bold text-ledger-ink">
        Cloud record status
      </Text>
      <Text className="text-sm leading-5 text-ledger-muted">
        Cloud odometer entries, service records, repair records, and reminders
        are available for this vehicle. Cloud service and repair attachments are
        available from record detail screens. CSV export, push notifications,
        and later guest-to-account migration slices are still deferred.
      </Text>
    </View>
  );
}

function VehicleSectionTabs({
  activeSection,
  onChange,
}: {
  activeSection: VehicleDetailSection;
  onChange: (section: VehicleDetailSection) => void;
}) {
  return (
    <View className="flex-row rounded-card border border-ledger-line bg-ledger-surface p-1">
      {vehicleDetailSections.map((section) => {
        const isActive = activeSection === section.value;

        return (
          <Pressable
            accessibilityRole="button"
            className={`flex-1 rounded-card px-3 py-2 ${
              isActive ? "bg-ledger-primary" : "bg-ledger-surface"
            }`}
            key={section.value}
            onPress={() => onChange(section.value)}
          >
            <Text
              className={`text-center text-sm font-bold ${
                isActive ? "text-white" : "text-ledger-muted"
              }`}
            >
              {section.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ReminderCard({
  reminder,
  vehicle,
}: {
  reminder: MaintenanceReminder;
  vehicle: Vehicle;
}) {
  const status = getMaintenanceReminderStatus({
    currentOdometer: vehicle.current_odometer,
    reminder,
  });

  return (
    <Pressable
      accessibilityRole="button"
      className="gap-2 rounded-card border border-ledger-line bg-ledger-background p-3"
      onPress={() =>
        router.push(`/vehicles/${vehicle.id}/reminders/${reminder.id}` as Href)
      }
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-xs font-bold uppercase text-ledger-primary">
            {formatMaintenanceReminderCategory(reminder.category)}
          </Text>
          <Text className="text-base font-bold text-ledger-ink">
            {reminder.title}
          </Text>
        </View>
        <ReminderStatusPill status={status} />
      </View>
      <View className="flex-row flex-wrap gap-2">
        {reminder.due_date ? (
          <View className="rounded-card bg-ledger-surface px-2 py-1">
            <Text className="text-xs font-bold uppercase text-ledger-muted">
              {formatDisplayDate(reminder.due_date)}
            </Text>
          </View>
        ) : null}
        {reminder.due_odometer === null ||
        reminder.due_odometer === undefined ? null : (
          <View className="rounded-card bg-ledger-surface px-2 py-1">
            <Text className="text-xs font-bold uppercase text-ledger-muted">
              {formatOdometer(reminder.due_odometer, vehicle.odometer_unit)}
            </Text>
          </View>
        )}
      </View>
      {reminder.notes ? (
        <Text className="text-sm leading-5 text-ledger-muted" numberOfLines={2}>
          {reminder.notes}
        </Text>
      ) : null}
    </Pressable>
  );
}

function HistoryItemCard({
  item,
  vehicle,
}: {
  item: VehicleHistoryItem;
  vehicle: Vehicle;
}) {
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
      : vehicle.odometer_unit;

  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View className="h-3 w-3 rounded-full bg-ledger-primary" />
        <View className="mt-1 flex-1 border-l border-ledger-line" />
      </View>
      <Pressable
        accessibilityRole="button"
        className="flex-1 gap-2 rounded-card border border-ledger-line bg-ledger-background p-3"
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
              {formatDisplayDate(item.date)}
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
          {item.cost_amount === null ||
          item.cost_amount === undefined ? null : (
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
          <Text
            className="text-sm leading-5 text-ledger-muted"
            numberOfLines={2}
          >
            {item.summary}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: number | string | null;
}) {
  return (
    <View className="gap-1 border-b border-ledger-line pb-3 last:border-b-0 last:pb-0">
      <Text className="text-xs font-bold uppercase text-ledger-muted">
        {label}
      </Text>
      <Text className="text-base font-semibold text-ledger-ink">
        {value === null || value === undefined || value === ""
          ? "Not set"
          : value}
      </Text>
    </View>
  );
}
