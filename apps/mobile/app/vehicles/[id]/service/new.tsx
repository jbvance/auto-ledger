import type { ServiceRecordInput, Vehicle } from "@autoledger/shared";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  defaultServiceRecordFormValues,
  ServiceRecordForm,
} from "../../../../components/ServiceRecordForm";
import { createCloudServiceRecord } from "../../../../lib/cloudServiceRecords";
import { getCloudVehicle } from "../../../../lib/cloudVehicles";
import { useAuth } from "../../../../lib/auth";
import { createServiceRecord } from "../../../../lib/serviceRecords";
import { getVehicle } from "../../../../lib/vehicles";

export default function AddServiceRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isLoading: isAuthLoading, user } = useAuth();
  const isCloudMode = Boolean(user);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadVehicle = useCallback(async () => {
    if (!id || isAuthLoading) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const nextVehicle = isCloudMode
        ? await getCloudVehicle(id)
        : await getVehicle(id);

      setVehicle(nextVehicle);
    } catch (error: unknown) {
      setLoadError(
        isCloudMode
          ? error instanceof Error
            ? error.message
            : "Unable to load this cloud vehicle. Please try again."
          : "Unable to load this local vehicle. Please try again.",
      );
      setVehicle(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, isAuthLoading, isCloudMode]);

  useFocusEffect(
    useCallback(() => {
      void loadVehicle();
    }, [loadVehicle]),
  );

  const saveRecord = async (input: ServiceRecordInput) => {
    if (!vehicle) {
      return;
    }

    const record = isCloudMode
      ? await createCloudServiceRecord(input)
      : await createServiceRecord(input);

    router.replace(`/vehicles/${vehicle.id}/service/${record.id}` as Href);
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
        <View className="flex-1 justify-center gap-2 px-6">
          <Text className="text-2xl font-bold text-ledger-ink">
            Vehicle not found
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            {loadError ??
              (isCloudMode
                ? "This cloud vehicle may have been archived or is not available for this account."
                : "This vehicle may have been archived or removed from local storage.")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ServiceRecordForm
        defaultValues={defaultServiceRecordFormValues(vehicle)}
        description={
          isCloudMode
            ? "Log routine maintenance for this cloud vehicle. Photos and PDFs can be added from the saved cloud service record detail screen."
            : "Log routine maintenance for this vehicle. This stays local on your device."
        }
        onSubmit={saveRecord}
        submitLabel="Save Service Record"
        title="Add service"
        vehicle={vehicle}
      />
    </SafeAreaView>
  );
}
