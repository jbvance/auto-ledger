import {
  formatDisplayDate,
  formatOdometer,
  getMaintenanceReminderStatus,
  maintenanceReminderCategoryLabels,
  maintenanceReminderStatusLabels,
  maintenanceReminderTypeLabels,
  type MaintenanceReminder,
  type Vehicle,
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
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  completeMaintenanceReminder,
  getMaintenanceReminder,
} from "../../../../lib/maintenanceReminders";
import { getVehicle } from "../../../../lib/vehicles";

export default function MaintenanceReminderDetailScreen() {
  const { id, reminderId } = useLocalSearchParams<{
    id: string;
    reminderId: string;
  }>();
  const [reminder, setReminder] = useState<MaintenanceReminder | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
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

  const confirmComplete = () => {
    if (!reminder) {
      return;
    }

    Alert.alert(
      "Complete reminder?",
      "This reminder will be marked completed and kept in local history.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Complete",
          onPress: () => {
            void completeReminder();
          },
        },
      ],
    );
  };

  const completeReminder = async () => {
    if (!reminder || !vehicle) {
      return;
    }

    setIsCompleting(true);
    await completeMaintenanceReminder(reminder.id);
    setIsCompleting(false);
    await loadReminder();
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

  const status = getMaintenanceReminderStatus({
    currentOdometer: vehicle.current_odometer,
    reminder,
  });

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        <View className="gap-2 pt-4">
          <Text className="text-sm font-bold uppercase text-ledger-primary">
            Reminder
          </Text>
          <Text className="text-3xl font-extrabold text-ledger-ink">
            {reminder.title}
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            {vehicle.nickname}
          </Text>
          <View className="mt-2 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              className="flex-1 rounded-card bg-ledger-primary px-4 py-3"
              onPress={() =>
                router.push(
                  `/vehicles/${vehicle.id}/reminders/${reminder.id}/edit` as Href,
                )
              }
            >
              <Text className="text-center text-base font-bold text-white">
                Edit Reminder
              </Text>
            </Pressable>
            {reminder.is_completed ? null : (
              <Pressable
                accessibilityRole="button"
                className="flex-1 rounded-card border border-ledger-primary bg-ledger-surface px-4 py-3"
                disabled={isCompleting}
                onPress={confirmComplete}
              >
                <Text className="text-center text-base font-bold text-ledger-primary">
                  {isCompleting ? "Completing..." : "Complete"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <DetailRow
            label="Status"
            value={maintenanceReminderStatusLabels[status]}
          />
          <DetailRow
            label="Category"
            value={maintenanceReminderCategoryLabels[reminder.category]}
          />
          <DetailRow
            label="Type"
            value={maintenanceReminderTypeLabels[reminder.reminder_type]}
          />
          <DetailRow
            label="Due date"
            value={
              reminder.due_date ? formatDisplayDate(reminder.due_date) : null
            }
          />
          <DetailRow
            label="Due odometer"
            value={
              reminder.due_odometer === null ||
              reminder.due_odometer === undefined
                ? null
                : formatOdometer(reminder.due_odometer, vehicle.odometer_unit)
            }
          />
          <DetailRow
            label="Current odometer"
            value={formatOdometer(
              vehicle.current_odometer,
              vehicle.odometer_unit,
            )}
          />
          <DetailRow
            label="Notification"
            value={
              reminder.scheduled_notification_id
                ? "Scheduled locally"
                : "Not scheduled"
            }
          />
        </View>

        <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <Text className="text-lg font-bold text-ledger-ink">Repeat</Text>
          <DetailRow label="Months" value={reminder.repeat_interval_months} />
          <DetailRow
            label={vehicle.odometer_unit}
            value={reminder.repeat_interval_miles}
          />
        </View>

        <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <DetailRow label="Completed at" value={reminder.completed_at} />
          <DetailRow label="Notes" value={reminder.notes} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: number | string | null;
}) {
  return (
    <View className="gap-1 border-b border-ledger-line pb-3 last:border-b-0 last:pb-0">
      <Text className="text-xs font-bold uppercase text-ledger-muted">
        {label}
      </Text>
      <Text className="text-base font-semibold text-ledger-ink">
        {value === null || value === undefined || value === ""
          ? "Not set"
          : value}
      </Text>
    </View>
  );
}
