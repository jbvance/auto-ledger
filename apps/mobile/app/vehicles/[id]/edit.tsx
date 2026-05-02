import type { Vehicle, VehicleInput } from "@autoledger/shared";
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
  VehicleForm,
  vehicleToFormValues,
} from "../../../components/VehicleForm";
import {
  getCloudVehicle,
  updateCloudVehicle,
} from "../../../lib/cloudVehicles";
import { useAuth } from "../../../lib/auth";
import { getVehicle, updateVehicle } from "../../../lib/vehicles";

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isLoading: isAuthLoading, user } = useAuth();
  const isCloudMode = Boolean(user);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    } catch {
      setLoadError(
        isCloudMode
          ? "Unable to load this cloud vehicle. Please try again."
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

  const saveVehicle = async (input: VehicleInput) => {
    if (!vehicle) {
      return;
    }

    if (isCloudMode) {
      await updateCloudVehicle(vehicle.id, input);
    } else {
      await updateVehicle(vehicle.id, input);
    }

    router.replace(`/vehicles/${vehicle.id}` as Href);
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
                ? "This vehicle may have been archived or is not available for this account."
                : "This vehicle may have been archived or removed from local storage.")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <VehicleForm
        defaultValues={vehicleToFormValues(vehicle)}
        description={
          isCloudMode
            ? "Update the account-saved vehicle details. Current odometer is stored on the cloud vehicle row for now."
            : "Update the local details for this vehicle. Changes stay on this device."
        }
        eyebrow={isCloudMode ? "Edit cloud vehicle" : "Edit vehicle"}
        onSubmit={saveVehicle}
        submitLabel="Save Changes"
        title={vehicle.nickname}
      />
    </SafeAreaView>
  );
}
