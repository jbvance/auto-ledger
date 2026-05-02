import {
  buildVehicleHistoryItems,
  formatCostAmount,
  formatDisplayDate,
  formatOdometer,
  formatVehicleSubtitle,
  formatVehicleTitle,
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
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth";
import { listCloudOdometerEntries } from "../../lib/cloudOdometerEntries";
import { listCloudRepairRecords } from "../../lib/cloudRepairRecords";
import { listCloudServiceRecords } from "../../lib/cloudServiceRecords";
import { listCloudVehicles } from "../../lib/cloudVehicles";
import { listOdometerEntries } from "../../lib/odometerEntries";
import { listRepairRecords } from "../../lib/repairRecords";
import { listServiceRecords } from "../../lib/serviceRecords";
import { listVehicles } from "../../lib/vehicles";

type StorageMode = "cloud" | "local";

type VehicleRecordSet = {
  odometerEntries: OdometerEntry[];
  repairRecords: RepairRecord[];
  serviceRecords: ServiceRecord[];
  vehicle: Vehicle;
};

type ActivityItem = VehicleHistoryItem & {
  vehicle: Vehicle;
};

type ActivityRecordType = "odometer" | "service" | "repair";

const activityRecordTypeOptions: {
  description: string;
  label: string;
  value: ActivityRecordType;
}[] = [
  {
    description: "Mileage reading",
    label: "Odometer",
    value: "odometer",
  },
  {
    description: "Routine maintenance",
    label: "Service",
    value: "service",
  },
  {
    description: "Unexpected fix",
    label: "Repair",
    value: "repair",
  },
];

const sortActivityItems = (items: ActivityItem[]) =>
  [...items].sort((first, second) => {
    const dateComparison = second.date.localeCompare(first.date);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return second.created_at.localeCompare(first.created_at);
  });

export default function ActivityScreen() {
  const { isLoading: isAuthLoading, user } = useAuth();
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [activeVehicles, setActiveVehicles] = useState<Vehicle[]>([]);
  const [isAddMenuVisible, setIsAddMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRecordType, setSelectedRecordType] =
    useState<ActivityRecordType | null>(null);
  const storageMode: StorageMode = user ? "cloud" : "local";

  const loadActivity = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const recordSets =
        storageMode === "cloud"
          ? await loadCloudRecordSets()
          : await loadLocalRecordSets();
      const nextVehicles = recordSets.map((recordSet) => recordSet.vehicle);
      const nextItems = sortActivityItems(
        recordSets.flatMap((recordSet) =>
          buildVehicleHistoryItems({
            odometerEntries: recordSet.odometerEntries,
            repairRecords: recordSet.repairRecords,
            serviceRecords: recordSet.serviceRecords,
          }).map(
            (historyItem): ActivityItem => ({
              ...historyItem,
              vehicle: recordSet.vehicle,
            }),
          ),
        ),
      );

      setActiveVehicles(nextVehicles);
      setActivityItems(nextItems);
    } catch (error: unknown) {
      console.warn("Unable to load activity.", error);
      setLoadError(
        storageMode === "cloud"
          ? error instanceof Error
            ? error.message
            : "Unable to load cloud activity. Please check your connection and try again."
          : "Unable to load local activity. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthLoading, storageMode]);

  useFocusEffect(
    useCallback(() => {
      void loadActivity();
    }, [loadActivity]),
  );

  const closeAddMenu = () => {
    setIsAddMenuVisible(false);
    setSelectedRecordType(null);
  };

  const routeToNewActivity = (
    recordType: ActivityRecordType,
    vehicleId: string,
  ) => {
    closeAddMenu();

    if (recordType === "odometer") {
      router.push(`/vehicles/${vehicleId}/odometer/new` as Href);
      return;
    }

    if (recordType === "service") {
      router.push(`/vehicles/${vehicleId}/service/new` as Href);
      return;
    }

    router.push(`/vehicles/${vehicleId}/repair/new` as Href);
  };

  const chooseRecordType = (recordType: ActivityRecordType) => {
    if (activeVehicles.length === 1) {
      routeToNewActivity(recordType, activeVehicles[0].id);
      return;
    }

    setSelectedRecordType(recordType);
  };

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ScrollView contentContainerClassName="gap-5 px-6 py-6 pb-28">
        <View className="gap-2 pt-4">
          <Text className="text-sm font-bold uppercase text-ledger-primary">
            {storageMode === "cloud" ? "Cloud timeline" : "Local timeline"}
          </Text>
          <Text className="text-4xl font-extrabold text-ledger-ink">
            Activity
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            Mileage, service, and repair records across your active vehicles,
            newest first.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-2 rounded-card bg-ledger-primary px-4 py-3"
            disabled={isLoading || isAuthLoading}
            onPress={() => setIsAddMenuVisible(true)}
          >
            <Text className="text-center text-base font-bold text-white">
              Add Activity
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
              Activity unavailable
            </Text>
            <Text className="text-base leading-6 text-ledger-muted">
              {loadError}
            </Text>
            <Pressable
              accessibilityRole="button"
              className="rounded-card bg-ledger-primary px-4 py-3"
              onPress={() => {
                void loadActivity();
              }}
            >
              <Text className="text-center text-base font-bold text-white">
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : activityItems.length === 0 ? (
          <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-5">
            <Text className="text-xl font-bold text-ledger-ink">
              No activity yet
            </Text>
            <Text className="text-base leading-6 text-ledger-muted">
              Add an odometer reading, service record, or repair record from a
              vehicle to build this timeline.
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
          <View className="gap-3">
            {activityItems.map((item) => (
              <ActivityCard item={item} key={`${item.type}-${item.id}`} />
            ))}
          </View>
        )}
      </ScrollView>
      <AddActivityMenu
        isVisible={isAddMenuVisible}
        onAddVehicle={() => {
          closeAddMenu();
          router.push("/vehicles/new" as Href);
        }}
        onChooseRecordType={chooseRecordType}
        onChooseVehicle={(vehicleId) => {
          if (!selectedRecordType) {
            return;
          }

          routeToNewActivity(selectedRecordType, vehicleId);
        }}
        onClose={closeAddMenu}
        onSelectRecordType={setSelectedRecordType}
        selectedRecordType={selectedRecordType}
        vehicles={activeVehicles}
      />
    </SafeAreaView>
  );
}

function AddActivityMenu({
  isVisible,
  onAddVehicle,
  onChooseRecordType,
  onChooseVehicle,
  onClose,
  onSelectRecordType,
  selectedRecordType,
  vehicles,
}: {
  isVisible: boolean;
  onAddVehicle: () => void;
  onChooseRecordType: (recordType: ActivityRecordType) => void;
  onChooseVehicle: (vehicleId: string) => void;
  onClose: () => void;
  onSelectRecordType: (recordType: ActivityRecordType | null) => void;
  selectedRecordType: ActivityRecordType | null;
  vehicles: Vehicle[];
}) {
  const selectedOption = activityRecordTypeOptions.find(
    (option) => option.value === selectedRecordType,
  );

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
                Add activity
              </Text>
              <Text className="text-2xl font-extrabold text-ledger-ink">
                {selectedOption ? `Choose vehicle` : "What are you logging?"}
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

          {selectedOption ? (
            <View className="gap-3">
              <Pressable
                accessibilityRole="button"
                className="self-start rounded-card border border-ledger-line bg-ledger-surface px-3 py-2"
                onPress={() => onSelectRecordType(null)}
              >
                <Text className="text-sm font-bold text-ledger-ink">
                  Change type
                </Text>
              </Pressable>
              {vehicles.length === 0 ? (
                <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
                  <Text className="text-base font-bold text-ledger-ink">
                    No active vehicles
                  </Text>
                  <Text className="text-sm leading-5 text-ledger-muted">
                    Add a vehicle before logging odometer, service, or repair
                    activity.
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
                <ScrollView
                  className="max-h-96"
                  contentContainerClassName="gap-3"
                >
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
          ) : (
            <View className="gap-3">
              {activityRecordTypeOptions.map((option) => (
                <Pressable
                  accessibilityRole="button"
                  className="gap-1 rounded-card border border-ledger-line bg-ledger-surface p-4"
                  key={option.value}
                  onPress={() => onChooseRecordType(option.value)}
                >
                  <Text className="text-base font-bold text-ledger-ink">
                    {option.label}
                  </Text>
                  <Text className="text-sm leading-5 text-ledger-muted">
                    {option.description}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

async function loadCloudRecordSets(): Promise<VehicleRecordSet[]> {
  const vehicles = await listCloudVehicles();

  return Promise.all(
    vehicles.map(async (vehicle) => {
      const [odometerEntries, serviceRecords, repairRecords] =
        await Promise.all([
          listCloudOdometerEntries(vehicle.id),
          listCloudServiceRecords(vehicle.id),
          listCloudRepairRecords(vehicle.id),
        ]);

      return {
        odometerEntries,
        repairRecords,
        serviceRecords,
        vehicle,
      };
    }),
  );
}

async function loadLocalRecordSets(): Promise<VehicleRecordSet[]> {
  const vehicles = await listVehicles();

  return Promise.all(
    vehicles.map(async (vehicle) => {
      const [odometerEntries, serviceRecords, repairRecords] =
        await Promise.all([
          listOdometerEntries(vehicle.id),
          listServiceRecords(vehicle.id),
          listRepairRecords(vehicle.id),
        ]);

      return {
        odometerEntries,
        repairRecords,
        serviceRecords,
        vehicle,
      };
    }),
  );
}

function ActivityCard({ item }: { item: ActivityItem }) {
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
    <View className="flex-row gap-3">
      <View className="items-center">
        <View className="h-3 w-3 rounded-full bg-ledger-primary" />
        <View className="mt-1 flex-1 border-l border-ledger-line" />
      </View>
      <Pressable
        accessibilityRole="button"
        className="flex-1 gap-2 rounded-card border border-ledger-line bg-ledger-surface p-3"
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
            <View className="rounded-card bg-ledger-background px-2 py-1">
              <Text className="text-xs font-bold uppercase text-ledger-muted">
                {item.categoryLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="flex-row flex-wrap gap-2">
          {item.odometer_reading === null ||
          item.odometer_reading === undefined ? null : (
            <View className="rounded-card bg-ledger-background px-2 py-1">
              <Text className="text-xs font-bold uppercase text-ledger-muted">
                {formatOdometer(item.odometer_reading, odometerUnit)}
              </Text>
            </View>
          )}
          {item.cost_amount === null ||
          item.cost_amount === undefined ? null : (
            <View className="rounded-card bg-ledger-background px-2 py-1">
              <Text className="text-xs font-bold uppercase text-ledger-muted">
                {formatCostAmount(item.cost_amount, item.cost_currency)}
              </Text>
            </View>
          )}
          {item.vendor_name ? (
            <View className="rounded-card bg-ledger-background px-2 py-1">
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
