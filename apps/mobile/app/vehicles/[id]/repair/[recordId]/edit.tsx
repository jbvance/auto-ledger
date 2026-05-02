import type {
  RepairRecord,
  RepairRecordInput,
  Vehicle,
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
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  RepairRecordForm,
  repairRecordToFormValues,
} from "../../../../../components/RepairRecordForm";
import {
  deleteCloudRepairRecord,
  getCloudRepairRecord,
  updateCloudRepairRecord,
} from "../../../../../lib/cloudRepairRecords";
import { getCloudVehicle } from "../../../../../lib/cloudVehicles";
import { useAuth } from "../../../../../lib/auth";
import {
  deleteRepairRecord,
  getRepairRecord,
  updateRepairRecord,
} from "../../../../../lib/repairRecords";
import { getVehicle } from "../../../../../lib/vehicles";

export default function EditRepairRecordScreen() {
  const { id, recordId } = useLocalSearchParams<{
    id: string;
    recordId: string;
  }>();
  const { isLoading: isAuthLoading, user } = useAuth();
  const isCloudMode = Boolean(user);
  const [record, setRecord] = useState<RepairRecord | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRecord = useCallback(async () => {
    if (!id || !recordId || isAuthLoading) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [nextVehicle, nextRecord] = await Promise.all([
        isCloudMode ? getCloudVehicle(id) : getVehicle(id),
        isCloudMode
          ? getCloudRepairRecord(recordId)
          : getRepairRecord(recordId),
      ]);

      setVehicle(nextVehicle);
      setRecord(nextRecord);
    } catch (error: unknown) {
      setLoadError(
        isCloudMode
          ? error instanceof Error
            ? error.message
            : "Unable to load this cloud repair record. Please try again."
          : "Unable to load this local repair record. Please try again.",
      );
      setVehicle(null);
      setRecord(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, isAuthLoading, isCloudMode, recordId]);

  useFocusEffect(
    useCallback(() => {
      void loadRecord();
    }, [loadRecord]),
  );

  const saveRecord = async (input: RepairRecordInput) => {
    if (!record || !vehicle || record.vehicle_id !== vehicle.id) {
      return;
    }

    if (isCloudMode) {
      await updateCloudRepairRecord(record.id, input);
    } else {
      await updateRepairRecord(record.id, input);
    }

    router.replace(`/vehicles/${vehicle.id}/repair/${record.id}` as Href);
  };

  const confirmDelete = () => {
    if (!record || !vehicle || record.vehicle_id !== vehicle.id) {
      return;
    }

    Alert.alert(
      "Delete repair record?",
      isCloudMode
        ? "This cloud repair record will be removed and the vehicle odometer will be recalculated."
        : "This local repair record will be removed and the vehicle odometer will be recalculated.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteRecord();
          },
        },
      ],
    );
  };

  const deleteRecord = async () => {
    if (!record || !vehicle || record.vehicle_id !== vehicle.id) {
      return;
    }

    setIsDeleting(true);
    setActionError(null);

    try {
      if (isCloudMode) {
        await deleteCloudRepairRecord(record.id);
      } else {
        await deleteRepairRecord(record.id);
      }

      router.replace(`/vehicles/${vehicle.id}` as Href);
    } catch (error: unknown) {
      setActionError(
        isCloudMode
          ? error instanceof Error
            ? error.message
            : "Unable to delete this cloud repair record. Please try again."
          : "Unable to delete this local repair record. Please try again.",
      );
    } finally {
      setIsDeleting(false);
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

  if (!record || !vehicle || record.vehicle_id !== vehicle.id) {
    return (
      <SafeAreaView className="flex-1 bg-ledger-background">
        <View className="flex-1 justify-center gap-2 px-6">
          <Text className="text-2xl font-bold text-ledger-ink">
            Repair record not found
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            {loadError ??
              (isCloudMode
                ? "This cloud repair record may have been deleted or is not available for this account."
                : "This local repair record may have been deleted.")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <RepairRecordForm
        defaultValues={repairRecordToFormValues(record)}
        description={
          isCloudMode
            ? "Update this cloud repair record. Odometer changes will recalculate the cloud vehicle's current odometer."
            : "Update this local repair record. Odometer changes will recalculate the vehicle's current odometer."
        }
        onSubmit={saveRecord}
        submitLabel="Save Changes"
        title="Edit repair"
        vehicle={vehicle}
      />
      <View className="px-6 pb-6">
        {actionError ? (
          <View className="mb-3 rounded-card border border-red-200 bg-ledger-surface p-3">
            <Text className="text-sm leading-5 text-ledger-muted">
              {actionError}
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          className="rounded-card border border-red-200 bg-ledger-surface px-4 py-3"
          disabled={isDeleting}
          onPress={confirmDelete}
        >
          <Text className="text-center text-base font-bold text-red-700">
            {isDeleting ? "Deleting..." : "Delete Repair Record"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
