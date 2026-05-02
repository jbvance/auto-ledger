import type {
  OdometerEntry,
  OdometerEntryInput,
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
  odometerEntryToFormValues,
  OdometerEntryForm,
} from "../../../../../components/OdometerEntryForm";
import {
  deleteOdometerEntry,
  getOdometerEntry,
  updateOdometerEntry,
} from "../../../../../lib/odometerEntries";
import { getVehicle } from "../../../../../lib/vehicles";

export default function EditOdometerEntryScreen() {
  const { entryId, id } = useLocalSearchParams<{
    entryId: string;
    id: string;
  }>();
  const [entry, setEntry] = useState<OdometerEntry | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadEntry = useCallback(async () => {
    if (!entryId || !id) {
      return;
    }

    setIsLoading(true);
    const [nextVehicle, nextEntry] = await Promise.all([
      getVehicle(id),
      getOdometerEntry(entryId),
    ]);
    setVehicle(nextVehicle);
    setEntry(nextEntry);
    setIsLoading(false);
  }, [entryId, id]);

  useFocusEffect(
    useCallback(() => {
      void loadEntry();
    }, [loadEntry]),
  );

  const saveEntry = async (input: OdometerEntryInput) => {
    if (!entry || !vehicle || entry.vehicle_id !== vehicle.id) {
      return;
    }

    await updateOdometerEntry(entry.id, input);
    router.replace(`/vehicles/${vehicle.id}` as Href);
  };

  const confirmDelete = () => {
    if (!entry || !vehicle || entry.vehicle_id !== vehicle.id) {
      return;
    }

    Alert.alert(
      "Delete odometer entry?",
      "This local reading will be removed and the vehicle odometer will be recalculated.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteEntry();
          },
        },
      ],
    );
  };

  const deleteEntry = async () => {
    if (!entry || !vehicle || entry.vehicle_id !== vehicle.id) {
      return;
    }

    setIsDeleting(true);
    await deleteOdometerEntry(entry.id);
    setIsDeleting(false);
    router.replace(`/vehicles/${vehicle.id}` as Href);
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

  if (!entry || !vehicle || entry.vehicle_id !== vehicle.id) {
    return (
      <SafeAreaView className="flex-1 bg-ledger-background">
        <View className="flex-1 justify-center gap-2 px-6">
          <Text className="text-2xl font-bold text-ledger-ink">
            Reading not found
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            This odometer entry may have been deleted.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <OdometerEntryForm
        defaultValues={odometerEntryToFormValues(entry)}
        description="Update this local odometer reading. The vehicle's current odometer will be recalculated after saving."
        onSubmit={saveEntry}
        submitLabel="Save Changes"
        title="Edit reading"
        vehicle={vehicle}
      />
      <View className="px-6 pb-6">
        <Pressable
          accessibilityRole="button"
          className="rounded-card border border-red-200 bg-ledger-surface px-4 py-3"
          disabled={isDeleting}
          onPress={confirmDelete}
        >
          <Text className="text-center text-base font-bold text-red-700">
            {isDeleting ? "Deleting..." : "Delete Reading"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
