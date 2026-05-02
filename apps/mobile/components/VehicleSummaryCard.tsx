import {
  formatOdometer,
  formatVehicleSubtitle,
  formatVehicleTitle,
  vehicleTypeLabels,
  type Vehicle,
} from "@autoledger/shared";
import { Text, View } from "react-native";

type VehicleSummaryCardProps = {
  footer?: React.ReactNode;
  vehicle: Vehicle;
};

export function VehicleSummaryCard({
  footer,
  vehicle,
}: VehicleSummaryCardProps) {
  return (
    <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
      <View>
        <Text className="text-xl font-bold text-ledger-ink">
          {formatVehicleTitle(vehicle)}
        </Text>
        <Text className="mt-1 text-sm leading-5 text-ledger-muted">
          {formatVehicleSubtitle(vehicle)}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <View className="rounded-card bg-ledger-background px-3 py-2">
          <Text className="text-xs font-bold uppercase text-ledger-muted">
            {vehicleTypeLabels[vehicle.vehicle_type]}
          </Text>
        </View>
        <View className="rounded-card bg-ledger-background px-3 py-2">
          <Text className="text-xs font-bold uppercase text-ledger-muted">
            {formatOdometer(vehicle.current_odometer, vehicle.odometer_unit)}
          </Text>
        </View>
      </View>
      {footer}
    </View>
  );
}
