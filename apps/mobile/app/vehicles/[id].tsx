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
  maintenanceReminderStatusLabels,
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

import { archiveCloudVehicle, getCloudVehicle } from "../../lib/cloudVehicles";
import { listCloudOdometerEntries } from "../../lib/cloudOdometerEntries";
import { listCloudRepairRecords } from "../../lib/cloudRepairRecords";
import { listCloudServiceRecords } from "../../lib/cloudServiceRecords";
import { useAuth } from "../../lib/auth";
import { listOdometerEntries } from "../../lib/odometerEntries";
import { listMaintenanceReminders } from "../../lib/maintenanceReminders";
import { listRepairRecords } from "../../lib/repairRecords";
import { listServiceRecords } from "../../lib/serviceRecords";
import { archiveVehicle, getVehicle } from "../../lib/vehicles";

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isLoading: isAuthLoading, user } = useAuth();
  const isCloudMode = Boolean(user);
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
        ] = await Promise.all([
          getCloudVehicle(id),
          listCloudOdometerEntries(id),
          listCloudServiceRecords(id),
          listCloudRepairRecords(id),
        ]);

        setVehicle(nextVehicle);
        setOdometerEntries(nextOdometerEntries);
        setServiceRecords(nextServiceRecords);
        setRepairRecords(nextRepairRecords);
        setMaintenanceReminders([]);
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
              onPress={() =>
                router.push(`/vehicles/${vehicle.id}/edit` as Href)
              }
            >
              <Text className="text-center text-base font-bold text-white">
                Edit Vehicle
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="flex-1 rounded-card border border-red-200 bg-ledger-surface px-4 py-3"
              disabled={isArchiving}
              onPress={confirmArchive}
            >
              <Text className="text-center text-base font-bold text-red-700">
                {isArchiving ? "Archiving..." : "Archive"}
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

        <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <Text className="text-lg font-bold text-ledger-ink">Overview</Text>
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
          <Text className="text-lg font-bold text-ledger-ink">Ownership</Text>
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

        <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <Text className="text-lg font-bold text-ledger-ink">Log records</Text>
          <Text className="text-sm leading-5 text-ledger-muted">
            {isCloudMode
              ? "Add cloud odometer readings, service records, or repair records for this account-saved vehicle. Reminder and attachment cloud sync are coming soon."
              : "Add local readings, routine service, or non-routine repairs for this vehicle."}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <RecordActionButton
              label="Odometer"
              onPress={() =>
                router.push(`/vehicles/${vehicle.id}/odometer/new` as Href)
              }
            />
            <RecordActionButton
              label="Service"
              onPress={() =>
                router.push(`/vehicles/${vehicle.id}/service/new` as Href)
              }
            />
            <RecordActionButton
              label="Repair"
              onPress={() =>
                router.push(`/vehicles/${vehicle.id}/repair/new` as Href)
              }
            />
          </View>
        </View>

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

        {isCloudMode ? (
          <CloudVehicleRecordsNotice />
        ) : (
          <>
            <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-lg font-bold text-ledger-ink">
                    Reminders
                  </Text>
                  <Text className="text-sm leading-5 text-ledger-muted">
                    Date and mileage reminders stay local on this device.
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
              {activeReminders.length === 0 &&
              completedReminders.length === 0 ? (
                <View className="gap-2 rounded-card border border-ledger-line bg-ledger-background p-4">
                  <Text className="text-base font-bold text-ledger-ink">
                    No reminders yet
                  </Text>
                  <Text className="text-sm leading-5 text-ledger-muted">
                    Add a date, mileage, or date-or-mileage reminder for
                    upcoming maintenance.
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
          </>
        )}

        <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <Text className="text-base font-bold text-ledger-ink">
            {isCloudMode ? "Cloud storage" : "Local storage"}
          </Text>
          <Text className="text-sm leading-5 text-ledger-muted">
            {isCloudMode
              ? "This vehicle, its odometer readings, service records, and repair records are saved to your account through Supabase RLS. Other cloud record types are not implemented yet."
              : "This vehicle is saved locally on this device. Cloud backup and sync are not implemented yet."}
          </Text>
        </View>
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
        Cloud odometer entries, service records, and repair records are
        available for this vehicle. Cloud reminders, attachments, CSV export, and
        guest-to-account migration are intentionally deferred.
      </Text>
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
        <View className="rounded-card bg-ledger-surface px-2 py-1">
          <Text className="text-xs font-bold uppercase text-ledger-muted">
            {maintenanceReminderStatusLabels[status]}
          </Text>
        </View>
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

function RecordActionButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="rounded-card bg-ledger-primary px-4 py-3"
      onPress={onPress}
    >
      <Text className="text-center text-sm font-bold text-white">{label}</Text>
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
