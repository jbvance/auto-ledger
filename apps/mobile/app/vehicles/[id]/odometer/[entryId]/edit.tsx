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
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  odometerEntryToFormValues,
  OdometerEntryForm,
} from "../../../../../components/OdometerEntryForm";
import {
  deleteCloudOdometerEntry,
  getCloudOdometerEntry,
  updateCloudOdometerEntry,
} from "../../../../../lib/cloudOdometerEntries";
import { getCloudVehicle } from "../../../../../lib/cloudVehicles";
import { useAuth } from "../../../../../lib/auth";
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
  const { isLoading: isAuthLoading, user } = useAuth();
  const isCloudMode = Boolean(user);
  const [entry, setEntry] = useState<OdometerEntry | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadEntry = useCallback(async () => {
    if (!entryId || !id || isAuthLoading) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [nextVehicle, nextEntry] = await Promise.all([
        isCloudMode ? getCloudVehicle(id) : getVehicle(id),
        isCloudMode
          ? getCloudOdometerEntry(entryId)
          : getOdometerEntry(entryId),
      ]);

      setVehicle(nextVehicle);
      setEntry(nextEntry);
    } catch (error: unknown) {
      setLoadError(
        isCloudMode
          ? error instanceof Error
            ? error.message
            : "Unable to load this cloud odometer entry. Please try again."
          : "Unable to load this local odometer entry. Please try again.",
      );
      setVehicle(null);
      setEntry(null);
    } finally {
      setIsLoading(false);
    }
  }, [entryId, id, isAuthLoading, isCloudMode]);

  useFocusEffect(
    useCallback(() => {
      void loadEntry();
    }, [loadEntry]),
  );

  const saveEntry = async (input: OdometerEntryInput) => {
    if (!entry || !vehicle || entry.vehicle_id !== vehicle.id) {
      return;
    }

    if (isCloudMode) {
      await updateCloudOdometerEntry(entry.id, input);
    } else {
      await updateOdometerEntry(entry.id, input);
    }

    router.replace(`/vehicles/${vehicle.id}` as Href);
  };

  const confirmDelete = () => {
    if (!entry || !vehicle || entry.vehicle_id !== vehicle.id) {
      return;
    }

    Alert.alert(
      "Delete odometer entry?",
      isCloudMode
        ? "This cloud reading will be removed and the vehicle odometer will be recalculated."
        : "This local reading will be removed and the vehicle odometer will be recalculated.",
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
    setActionError(null);

    try {
      if (isCloudMode) {
        await deleteCloudOdometerEntry(entry.id);
      } else {
        await deleteOdometerEntry(entry.id);
      }

      router.replace(`/vehicles/${vehicle.id}` as Href);
    } catch (error: unknown) {
      setActionError(
        isCloudMode
          ? error instanceof Error
            ? error.message
            : "Unable to delete this cloud odometer entry. Please try again."
          : "Unable to delete this local odometer entry. Please try again.",
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

  if (!entry || !vehicle || entry.vehicle_id !== vehicle.id) {
    return (
      <SafeAreaView className="flex-1 bg-ledger-background">
        <View className="flex-1 justify-center gap-2 px-6">
          <Text className="text-2xl font-bold text-ledger-ink">
            Reading not found
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            {loadError ??
              (isCloudMode
                ? "This cloud odometer entry may have been deleted or is not available for this account."
                : "This odometer entry may have been deleted.")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <OdometerEntryForm
        defaultValues={odometerEntryToFormValues(entry)}
        description={
          isCloudMode
            ? "Update this cloud odometer reading. The cloud vehicle's current odometer will be recalculated after saving."
            : "Update this local odometer reading. The vehicle's current odometer will be recalculated after saving."
        }
        onSubmit={saveEntry}
        submitLabel="Save Changes"
        title="Edit reading"
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
            {isDeleting ? "Deleting..." : "Delete Reading"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
