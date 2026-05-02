import type { RepairRecordInput, Vehicle } from "@autoledger/shared";
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
  defaultRepairRecordFormValues,
  RepairRecordForm,
} from "../../../../components/RepairRecordForm";
import { createRepairRecord } from "../../../../lib/repairRecords";
import { getVehicle } from "../../../../lib/vehicles";

export default function AddRepairRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadVehicle = useCallback(async () => {
    if (!id) {
      return;
    }

    setIsLoading(true);
    const nextVehicle = await getVehicle(id);
    setVehicle(nextVehicle);
    setIsLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadVehicle();
    }, [loadVehicle]),
  );

  const saveRecord = async (input: RepairRecordInput) => {
    if (!vehicle) {
      return;
    }

    const record = await createRepairRecord(input);
    router.replace(`/vehicles/${vehicle.id}/repair/${record.id}` as Href);
  };

  if (isLoading) {
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
            This vehicle may have been archived or removed from local storage.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <RepairRecordForm
        defaultValues={defaultRepairRecordFormValues(vehicle)}
        description="Log a non-routine repair for this vehicle. This stays local on your device."
        onSubmit={saveRecord}
        submitLabel="Save Repair Record"
        title="Add repair"
        vehicle={vehicle}
      />
    </SafeAreaView>
  );
}
