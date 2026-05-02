import {
  compareMaintenanceRemindersByUrgency,
  formatDisplayDate,
  formatMaintenanceReminderCategory,
  formatOdometer,
  formatVehicleSubtitle,
  formatVehicleTitle,
  getMaintenanceReminderStatus,
  type MaintenanceReminder,
  type Vehicle,
} from "@autoledger/shared";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ReminderStatusPill } from "../../components/ReminderStatusPill";
import { useAuth } from "../../lib/auth";
import { listCloudMaintenanceReminders } from "../../lib/cloudMaintenanceReminders";
import { listCloudVehicles } from "../../lib/cloudVehicles";
import { listMaintenanceReminders } from "../../lib/maintenanceReminders";
import { listVehicles } from "../../lib/vehicles";

type StorageMode = "cloud" | "local";

type ReminderItem = {
  reminder: MaintenanceReminder;
  vehicle: Vehicle;
};

const sortReminderItems = (items: ReminderItem[]) => {
  const vehicleOdometers = Object.fromEntries(
    items.map((item) => [item.vehicle.id, item.vehicle.current_odometer]),
  );

  return [...items].sort((first, second) =>
    compareMaintenanceRemindersByUrgency(
      first.reminder,
      second.reminder,
      vehicleOdometers,
    ),
  );
};

export default function RemindersScreen() {
  const { isLoading: isAuthLoading, user } = useAuth();
  const [activeVehicles, setActiveVehicles] = useState<Vehicle[]>([]);
  const [isAddMenuVisible, setIsAddMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reminderItems, setReminderItems] = useState<ReminderItem[]>([]);
  const storageMode: StorageMode = user ? "cloud" : "local";

  const loadReminders = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const nextVehicles =
        storageMode === "cloud"
          ? await listCloudVehicles()
          : await listVehicles();
      const nextReminderItems =
        storageMode === "cloud"
          ? await loadCloudReminderItems(nextVehicles)
          : await loadLocalReminderItems(nextVehicles);

      setActiveVehicles(nextVehicles);
      setReminderItems(sortReminderItems(nextReminderItems));
    } catch (error: unknown) {
      console.warn("Unable to load reminders.", error);
      setLoadError(
        storageMode === "cloud"
          ? error instanceof Error
            ? error.message
            : "Unable to load cloud reminders. Please check your connection and try again."
          : "Unable to load local reminders. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthLoading, storageMode]);

  useFocusEffect(
    useCallback(() => {
      void loadReminders();
    }, [loadReminders]),
  );

  const activeReminders = reminderItems.filter(
    (item) => !item.reminder.is_completed,
  );
  const completedReminders = reminderItems.filter(
    (item) => item.reminder.is_completed,
  );

  const closeAddMenu = () => {
    setIsAddMenuVisible(false);
  };

  const routeToNewReminder = (vehicleId: string) => {
    closeAddMenu();
    router.push(`/vehicles/${vehicleId}/reminders/new` as Href);
  };

  const addReminder = () => {
    if (activeVehicles.length === 1) {
      routeToNewReminder(activeVehicles[0].id);
      return;
    }

    setIsAddMenuVisible(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ScrollView contentContainerClassName="gap-5 px-6 py-6 pb-28">
        <View className="gap-2 pt-4">
          <Text className="text-sm font-bold uppercase text-ledger-primary">
            {storageMode === "cloud" ? "Cloud reminders" : "Local reminders"}
          </Text>
          <Text className="text-4xl font-extrabold text-ledger-ink">
            Reminders
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            Date and mileage reminders across your active vehicles, grouped by
            what still needs attention.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-2 rounded-card bg-ledger-primary px-4 py-3"
            disabled={isLoading || isAuthLoading}
            onPress={addReminder}
          >
            <Text className="text-center text-base font-bold text-white">
              Add Reminder
            </Text>
          </Pressable>
        </View>

        {isLoading || isAuthLoading ? (
          <View className="rounded-card border border-ledger-line bg-ledger-surface p-6">
            <ActivityIndicator color="#136f63" />
          </View>
        ) : loadError ? (
          <View className="gap-3 rounded-card border border-red-200 bg-ledger-surface p-5">
            <Text className="text-xl font-bold text-ledger-ink">
              Reminders unavailable
            </Text>
            <Text className="text-base leading-6 text-ledger-muted">
              {loadError}
            </Text>
            <Pressable
              accessibilityRole="button"
              className="rounded-card bg-ledger-primary px-4 py-3"
              onPress={() => {
                void loadReminders();
              }}
            >
              <Text className="text-center text-base font-bold text-white">
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : reminderItems.length === 0 ? (
          <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-5">
            <Text className="text-xl font-bold text-ledger-ink">
              No reminders yet
            </Text>
            <Text className="text-base leading-6 text-ledger-muted">
              Open a vehicle and add a date, mileage, or date-or-mileage
              reminder for upcoming maintenance.
            </Text>
            <Pressable
              accessibilityRole="button"
              className="rounded-card bg-ledger-primary px-4 py-3"
              onPress={() => router.push("/" as Href)}
            >
              <Text className="text-center text-base font-bold text-white">
                Go to Garage
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ReminderSection
              emptyMessage="No active reminders. Completed reminders stay below for reference."
              items={activeReminders}
              title="Active"
            />
            <ReminderSection
              emptyMessage="Completed reminders will appear here."
              items={completedReminders}
              title="Completed"
            />
          </>
        )}
      </ScrollView>
      <AddReminderMenu
        isVisible={isAddMenuVisible}
        onAddVehicle={() => {
          closeAddMenu();
          router.push("/vehicles/new" as Href);
        }}
        onChooseVehicle={routeToNewReminder}
        onClose={closeAddMenu}
        vehicles={activeVehicles}
      />
    </SafeAreaView>
  );
}

async function loadCloudReminderItems(
  vehicles: Vehicle[],
): Promise<ReminderItem[]> {
  return (
    await Promise.all(
      vehicles.map(async (vehicle) => {
        const reminders = await listCloudMaintenanceReminders(vehicle.id);

        return reminders.map(
          (reminder): ReminderItem => ({
            reminder,
            vehicle,
          }),
        );
      }),
    )
  ).flat();
}

async function loadLocalReminderItems(
  vehicles: Vehicle[],
): Promise<ReminderItem[]> {
  return (
    await Promise.all(
      vehicles.map(async (vehicle) => {
        const reminders = await listMaintenanceReminders(vehicle.id);

        return reminders.map(
          (reminder): ReminderItem => ({
            reminder,
            vehicle,
          }),
        );
      }),
    )
  ).flat();
}

function AddReminderMenu({
  isVisible,
  onAddVehicle,
  onChooseVehicle,
  onClose,
  vehicles,
}: {
  isVisible: boolean;
  onAddVehicle: () => void;
  onChooseVehicle: (vehicleId: string) => void;
  onClose: () => void;
  vehicles: Vehicle[];
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={isVisible}
    >
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="gap-4 rounded-t-3xl bg-ledger-background px-6 pb-8 pt-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-sm font-bold uppercase text-ledger-primary">
                Add reminder
              </Text>
              <Text className="text-2xl font-extrabold text-ledger-ink">
                Choose vehicle
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              className="rounded-card border border-ledger-line bg-ledger-surface px-3 py-2"
              onPress={onClose}
            >
              <Text className="text-sm font-bold text-ledger-ink">Close</Text>
            </Pressable>
          </View>

          {vehicles.length === 0 ? (
            <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
              <Text className="text-base font-bold text-ledger-ink">
                No active vehicles
              </Text>
              <Text className="text-sm leading-5 text-ledger-muted">
                Add a vehicle before creating date or mileage reminders.
              </Text>
              <Pressable
                accessibilityRole="button"
                className="rounded-card bg-ledger-primary px-4 py-3"
                onPress={onAddVehicle}
              >
                <Text className="text-center text-base font-bold text-white">
                  Add Vehicle
                </Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView className="max-h-96" contentContainerClassName="gap-3">
              {vehicles.map((vehicle) => (
                <Pressable
                  accessibilityRole="button"
                  className="gap-1 rounded-card border border-ledger-line bg-ledger-surface p-4"
                  key={vehicle.id}
                  onPress={() => onChooseVehicle(vehicle.id)}
                >
                  <Text className="text-base font-bold text-ledger-ink">
                    {formatVehicleTitle(vehicle)}
                  </Text>
                  <Text className="text-sm leading-5 text-ledger-muted">
                    {formatVehicleSubtitle(vehicle)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ReminderSection({
  emptyMessage,
  items,
  title,
}: {
  emptyMessage: string;
  items: ReminderItem[];
  title: string;
}) {
  return (
    <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
      <Text className="text-lg font-bold text-ledger-ink">{title}</Text>
      {items.length === 0 ? (
        <View className="rounded-card bg-ledger-background p-3">
          <Text className="text-sm leading-5 text-ledger-muted">
            {emptyMessage}
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {items.map((item) => (
            <ReminderCard item={item} key={item.reminder.id} />
          ))}
        </View>
      )}
    </View>
  );
}

function ReminderCard({ item }: { item: ReminderItem }) {
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
        <ReminderStatusPill status={status} />
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
      {item.reminder.notes ? (
        <Text className="text-sm leading-5 text-ledger-muted" numberOfLines={2}>
          {item.reminder.notes}
        </Text>
      ) : null}
    </Pressable>
  );
}
