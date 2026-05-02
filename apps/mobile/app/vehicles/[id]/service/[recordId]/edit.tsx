import type {
  ServiceRecord,
  ServiceRecordInput,
  Vehicle,
} from "@autoledger/shared";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ServiceRecordForm,
  serviceRecordToFormValues,
} from "../../../../../components/ServiceRecordForm";
import {
  deleteCloudServiceRecord,
  getCloudServiceRecord,
  updateCloudServiceRecord,
} from "../../../../../lib/cloudServiceRecords";
import { getCloudVehicle } from "../../../../../lib/cloudVehicles";
import { useAuth } from "../../../../../lib/auth";
import {
  deleteServiceRecord,
  getServiceRecord,
  updateServiceRecord,
} from "../../../../../lib/serviceRecords";
import { getVehicle } from "../../../../../lib/vehicles";

export default function EditServiceRecordScreen() {
  const { id, recordId } = useLocalSearchParams<{
    id: string;
    recordId: string;
  }>();
  const { isLoading: isAuthLoading, user } = useAuth();
  const isCloudMode = Boolean(user);
  const [record, setRecord] = useState<ServiceRecord | null>(null);
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
          ? getCloudServiceRecord(recordId)
          : getServiceRecord(recordId),
      ]);

      setVehicle(nextVehicle);
      setRecord(nextRecord);
    } catch (error: unknown) {
      setLoadError(
        isCloudMode
          ? error instanceof Error
            ? error.message
            : "Unable to load this cloud service record. Please try again."
          : "Unable to load this local service record. Please try again.",
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

  const saveRecord = async (input: ServiceRecordInput) => {
    if (!record || !vehicle || record.vehicle_id !== vehicle.id) {
      return;
    }

    if (isCloudMode) {
      await updateCloudServiceRecord(record.id, input);
    } else {
      await updateServiceRecord(record.id, input);
    }

    router.replace(`/vehicles/${vehicle.id}/service/${record.id}` as Href);
  };

  const confirmDelete = () => {
    if (!record || !vehicle || record.vehicle_id !== vehicle.id) {
      return;
    }

    Alert.alert(
      "Delete service record?",
      isCloudMode
        ? "This cloud service record will be removed and the vehicle odometer will be recalculated."
        : "This local service record will be removed and the vehicle odometer will be recalculated.",
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
        await deleteCloudServiceRecord(record.id);
      } else {
        await deleteServiceRecord(record.id);
      }

      router.replace(`/vehicles/${vehicle.id}` as Href);
    } catch (error: unknown) {
      setActionError(
        isCloudMode
          ? error instanceof Error
            ? error.message
            : "Unable to delete this cloud service record. Please try again."
          : "Unable to delete this local service record. Please try again.",
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
            Service record not found
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            {loadError ??
              (isCloudMode
                ? "This cloud service record may have been deleted or is not available for this account."
                : "This local service record may have been deleted.")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ServiceRecordForm
        defaultValues={serviceRecordToFormValues(record)}
        description={
          isCloudMode
            ? "Update this cloud service record. Odometer changes will recalculate the cloud vehicle's current odometer."
            : "Update this local service record. Odometer changes will recalculate the vehicle's current odometer."
        }
        onSubmit={saveRecord}
        submitLabel="Save Changes"
        title="Edit service"
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
            {isDeleting ? "Deleting..." : "Delete Service Record"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
