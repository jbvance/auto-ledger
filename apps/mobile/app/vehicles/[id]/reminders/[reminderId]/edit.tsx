import type {
  MaintenanceReminder,
  MaintenanceReminderInput,
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
  MaintenanceReminderForm,
  maintenanceReminderToFormValues,
} from "../../../../../components/MaintenanceReminderForm";
import {
  deleteCloudMaintenanceReminder,
  getCloudMaintenanceReminder,
  updateCloudMaintenanceReminder,
} from "../../../../../lib/cloudMaintenanceReminders";
import { getCloudVehicle } from "../../../../../lib/cloudVehicles";
import { useAuth } from "../../../../../lib/auth";
import {
  deleteMaintenanceReminder,
  getMaintenanceReminder,
  updateMaintenanceReminder,
} from "../../../../../lib/maintenanceReminders";
import { getVehicle } from "../../../../../lib/vehicles";

export default function EditMaintenanceReminderScreen() {
  const { id, reminderId } = useLocalSearchParams<{
    id: string;
    reminderId: string;
  }>();
  const { isLoading: isAuthLoading, user } = useAuth();
  const isCloudMode = Boolean(user);
  const [reminder, setReminder] = useState<MaintenanceReminder | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadReminder = useCallback(async () => {
    if (!id || !reminderId || isAuthLoading) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [nextVehicle, nextReminder] = await Promise.all([
        isCloudMode ? getCloudVehicle(id) : getVehicle(id),
        isCloudMode
          ? getCloudMaintenanceReminder(reminderId)
          : getMaintenanceReminder(reminderId),
      ]);

      setVehicle(nextVehicle);
      setReminder(nextReminder);
    } catch (error: unknown) {
      setLoadError(
        isCloudMode
          ? error instanceof Error
            ? error.message
            : "Unable to load this cloud reminder. Please try again."
          : "Unable to load this local reminder. Please try again.",
      );
      setVehicle(null);
      setReminder(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, isAuthLoading, isCloudMode, reminderId]);

  useFocusEffect(
    useCallback(() => {
      void loadReminder();
    }, [loadReminder]),
  );

  const saveReminder = async (input: MaintenanceReminderInput) => {
    if (!reminder || !vehicle) {
      return;
    }

    if (isCloudMode) {
      await updateCloudMaintenanceReminder(reminder.id, input);
    } else {
      await updateMaintenanceReminder(reminder.id, input);
    }

    router.replace(`/vehicles/${vehicle.id}/reminders/${reminder.id}` as Href);
  };

  const confirmDelete = () => {
    if (!reminder) {
      return;
    }

    Alert.alert(
      "Delete reminder?",
      isCloudMode
        ? "This cloud reminder will be permanently removed from your account."
        : "This local reminder will be permanently removed.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteReminder();
          },
        },
      ],
    );
  };

  const deleteReminder = async () => {
    if (!reminder || !vehicle) {
      return;
    }

    setIsDeleting(true);
    setActionError(null);

    try {
      if (isCloudMode) {
        await deleteCloudMaintenanceReminder(reminder.id);
      } else {
        await deleteMaintenanceReminder(reminder.id);
      }

      router.replace(`/vehicles/${vehicle.id}` as Href);
    } catch (error: unknown) {
      setActionError(
        isCloudMode
          ? error instanceof Error
            ? error.message
            : "Unable to delete this cloud reminder. Please try again."
          : "Unable to delete this local reminder. Please try again.",
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

  if (!reminder || !vehicle || reminder.vehicle_id !== vehicle.id) {
    return (
      <SafeAreaView className="flex-1 bg-ledger-background">
        <View className="flex-1 justify-center gap-2 px-6">
          <Text className="text-2xl font-bold text-ledger-ink">
            Reminder not found
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            {loadError ??
              (isCloudMode
                ? "This cloud reminder may have been deleted or is not available for this account."
                : "This local reminder may have been deleted.")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <MaintenanceReminderForm
        defaultValues={maintenanceReminderToFormValues(reminder)}
        description={
          isCloudMode
            ? "Update this account-saved reminder. Completed reminders stay visible until deleted. Cloud push notifications are not implemented yet."
            : "Update this local reminder. Completed reminders stay visible until deleted."
        }
        notificationDescription={
          isCloudMode
            ? "Cloud push notifications and server-side reminder delivery are not implemented yet. This reminder still works in the app."
            : undefined
        }
        onSubmit={saveReminder}
        submitLabel="Save Changes"
        title="Edit reminder"
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
            {isDeleting ? "Deleting..." : "Delete Reminder"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
