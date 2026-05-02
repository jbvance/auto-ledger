import {
  maintenanceReminderStatusLabels,
  type MaintenanceReminderStatus,
} from "@autoledger/shared";
import { Text, View } from "react-native";

const statusPillStyles: Record<MaintenanceReminderStatus, string> = {
  completed: "border-slate-200 bg-slate-100",
  due_soon: "border-amber-300 bg-amber-100",
  overdue: "border-red-300 bg-red-100",
  upcoming: "border-emerald-200 bg-emerald-50",
};

const statusTextStyles: Record<MaintenanceReminderStatus, string> = {
  completed: "text-slate-600",
  due_soon: "text-amber-900",
  overdue: "text-red-800",
  upcoming: "text-emerald-800",
};

export function ReminderStatusPill({
  status,
}: {
  status: MaintenanceReminderStatus;
}) {
  return (
    <View
      className={`rounded-card border px-2 py-1 ${statusPillStyles[status]}`}
    >
      <Text
        className={`text-xs font-extrabold uppercase ${statusTextStyles[status]}`}
      >
        {maintenanceReminderStatusLabels[status]}
      </Text>
    </View>
  );
}
