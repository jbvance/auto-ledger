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
  const [reminder, setReminder] = useState<MaintenanceReminder | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadReminder = useCallback(async () => {
    if (!id || !reminderId) {
      return;
    }

    setIsLoading(true);
    const [nextVehicle, nextReminder] = await Promise.all([
      getVehicle(id),
      getMaintenanceReminder(reminderId),
    ]);
    setVehicle(nextVehicle);
    setReminder(nextReminder);
    setIsLoading(false);
  }, [id, reminderId]);

  useFocusEffect(
    useCallback(() => {
      void loadReminder();
    }, [loadReminder]),
  );

  const saveReminder = async (input: MaintenanceReminderInput) => {
    if (!reminder || !vehicle) {
      return;
    }

    await updateMaintenanceReminder(reminder.id, input);
    router.replace(`/vehicles/${vehicle.id}/reminders/${reminder.id}` as Href);
  };

  const confirmDelete = () => {
    if (!reminder) {
      return;
    }

    Alert.alert(
      "Delete reminder?",
      "This local reminder will be permanently removed.",
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
    await deleteMaintenanceReminder(reminder.id);
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

  if (!reminder || !vehicle || reminder.vehicle_id !== vehicle.id) {
    return (
      <SafeAreaView className="flex-1 bg-ledger-background">
        <View className="flex-1 justify-center gap-2 px-6">
          <Text className="text-2xl font-bold text-ledger-ink">
            Reminder not found
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            This local reminder may have been deleted.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <MaintenanceReminderForm
        defaultValues={maintenanceReminderToFormValues(reminder)}
        description="Update this local reminder. Completed reminders stay visible until deleted."
        onSubmit={saveReminder}
        submitLabel="Save Changes"
        title="Edit reminder"
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
            {isDeleting ? "Deleting..." : "Delete Reminder"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
