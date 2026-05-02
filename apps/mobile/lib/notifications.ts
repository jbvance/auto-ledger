import {
  formatDisplayDate,
  formatOdometer,
  type MaintenanceReminder,
  type Vehicle,
} from "@autoledger/shared";
import cancelScheduledNotificationAsync from "expo-notifications/build/cancelScheduledNotificationAsync";
import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from "expo-notifications/build/NotificationPermissions";
import {
  IosAuthorizationStatus,
  type NotificationPermissionsStatus,
} from "expo-notifications/build/NotificationPermissions.types";
import { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
import scheduleNotificationAsync from "expo-notifications/build/scheduleNotificationAsync";
import setNotificationChannelAsync from "expo-notifications/build/setNotificationChannelAsync";
import { setNotificationHandler } from "expo-notifications/build/NotificationsHandler";
import {
  PermissionStatus,
  SchedulableTriggerInputTypes,
} from "expo-notifications/build/Notifications.types";
import { Platform } from "react-native";

export type LocalNotificationPermissionStatus =
  | "denied"
  | "granted"
  | "undetermined"
  | "unavailable";

export type LocalNotificationPermissionState = {
  canAskAgain: boolean;
  granted: boolean;
  status: LocalNotificationPermissionStatus;
};

export type ReminderNotificationScheduleResult =
  | {
      notificationId: string;
      scheduledFor: string;
      status: "scheduled";
    }
  | {
      reason:
        | "completed"
        | "missing_due_date"
        | "notifications_disabled"
        | "permission_not_granted"
        | "trigger_not_future"
        | "unavailable";
      status: "skipped";
    };

const reminderNotificationChannelId = "maintenance-reminders";
const reminderNotificationHour = 9;

const toPermissionState = (
  permission: NotificationPermissionsStatus,
): LocalNotificationPermissionState => {
  const granted =
    permission.granted ||
    permission.ios?.status === IosAuthorizationStatus.PROVISIONAL;

  return {
    canAskAgain: permission.canAskAgain,
    granted,
    status: granted
      ? "granted"
      : permission.status === PermissionStatus.DENIED
        ? "denied"
        : "undetermined",
  };
};

export const isLocalNotificationRuntimeSupported = () =>
  Platform.OS === "android" || Platform.OS === "ios";

export const getLocalNotificationRuntimeMessage = () =>
  isLocalNotificationRuntimeSupported()
    ? null
    : "Local reminder notifications are only available on iOS and Android. Reminders still work in the app.";

const configureAndroidReminderNotificationChannel = async () => {
  if (Platform.OS !== "android") {
    return;
  }

  await setNotificationChannelAsync(reminderNotificationChannelId, {
    importance: AndroidImportance.DEFAULT,
    name: "Maintenance reminders",
  });
};

export const configureLocalNotifications = () => {
  if (!isLocalNotificationRuntimeSupported()) {
    return;
  }

  setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  void configureAndroidReminderNotificationChannel().catch(
    (error: unknown) => {
      console.warn("Unable to configure local notification channel.", error);
    },
  );
};

export const getLocalNotificationPermissionState =
  async (): Promise<LocalNotificationPermissionState> => {
    if (!isLocalNotificationRuntimeSupported()) {
      return {
        canAskAgain: false,
        granted: false,
        status: "unavailable",
      };
    }

    try {
      return toPermissionState(await getPermissionsAsync());
    } catch (error: unknown) {
      console.warn("Unable to read local notification permission.", error);

      return {
        canAskAgain: false,
        granted: false,
        status: "unavailable",
      };
    }
  };

export const requestLocalNotificationPermission =
  async (): Promise<LocalNotificationPermissionState> => {
    if (!isLocalNotificationRuntimeSupported()) {
      return {
        canAskAgain: false,
        granted: false,
        status: "unavailable",
      };
    }

    try {
      await configureAndroidReminderNotificationChannel();
      return toPermissionState(await requestPermissionsAsync());
    } catch (error: unknown) {
      console.warn("Unable to request local notification permission.", error);

      return {
        canAskAgain: false,
        granted: false,
        status: "unavailable",
      };
    }
  };

const parseDateOnly = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, reminderNotificationHour);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getReminderNotificationDate = (
  dueDate: string,
  daysBeforeDueDate: number,
) => {
  const parsed = parseDateOnly(dueDate);

  if (!parsed) {
    return null;
  }

  parsed.setDate(parsed.getDate() - daysBeforeDueDate);

  return parsed;
};

export const scheduleLocalReminderNotification = async ({
  daysBeforeDueDate,
  notificationsEnabled,
  reminder,
  vehicle,
}: {
  daysBeforeDueDate: number;
  notificationsEnabled: boolean;
  reminder: MaintenanceReminder;
  vehicle: Vehicle;
}): Promise<ReminderNotificationScheduleResult> => {
  if (!notificationsEnabled) {
    return { reason: "notifications_disabled", status: "skipped" };
  }

  if (!isLocalNotificationRuntimeSupported()) {
    return { reason: "unavailable", status: "skipped" };
  }

  if (reminder.is_completed) {
    return { reason: "completed", status: "skipped" };
  }

  if (!reminder.due_date) {
    return { reason: "missing_due_date", status: "skipped" };
  }

  const permission = await getLocalNotificationPermissionState();

  if (!permission.granted) {
    return { reason: "permission_not_granted", status: "skipped" };
  }

  const scheduledDate = getReminderNotificationDate(
    reminder.due_date,
    daysBeforeDueDate,
  );

  if (!scheduledDate || scheduledDate.getTime() <= Date.now()) {
    return { reason: "trigger_not_future", status: "skipped" };
  }

  const dueParts = [
    `Due ${formatDisplayDate(reminder.due_date)}`,
    reminder.due_odometer === null || reminder.due_odometer === undefined
      ? null
      : formatOdometer(reminder.due_odometer, vehicle.odometer_unit),
  ].filter((part): part is string => part !== null);

  await configureAndroidReminderNotificationChannel();

  const notificationId = await scheduleNotificationAsync({
    content: {
      body: `${vehicle.nickname}: ${dueParts.join(" or ")}`,
      data: {
        reminderId: reminder.id,
        vehicleId: vehicle.id,
      },
      title: reminder.title,
    },
    trigger: {
      channelId:
        Platform.OS === "android" ? reminderNotificationChannelId : undefined,
      date: scheduledDate,
      type: SchedulableTriggerInputTypes.DATE,
    },
  });

  return {
    notificationId,
    scheduledFor: scheduledDate.toISOString(),
    status: "scheduled",
  };
};

export const cancelLocalNotification = async (
  notificationId: string | null | undefined,
) => {
  if (!notificationId) {
    return;
  }

  try {
    if (!isLocalNotificationRuntimeSupported()) {
      return;
    }

    await cancelScheduledNotificationAsync(notificationId);
  } catch (error: unknown) {
    console.warn("Unable to cancel local reminder notification.", error);
  }
};
