import type { VehicleInput } from "@autoledger/shared";
import { router, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  emptyVehicleFormValues,
  VehicleForm,
} from "../../components/VehicleForm";
import { createCloudVehicle } from "../../lib/cloudVehicles";
import { useAuth } from "../../lib/auth";
import { createVehicle } from "../../lib/vehicles";

export default function AddVehicleScreen() {
  const { user } = useAuth();
  const isCloudMode = Boolean(user);

  const saveVehicle = async (input: VehicleInput) => {
    const vehicle = isCloudMode
      ? await createCloudVehicle(input)
      : await createVehicle(input);

    router.replace(`/vehicles/${vehicle.id}` as Href);
  };

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <VehicleForm
        defaultValues={emptyVehicleFormValues}
        description={
          isCloudMode
            ? "This vehicle will be saved to your account. Cloud records for service, repairs, reminders, and attachments are coming soon."
            : "These details stay on this device for now. You can add cloud sync later by creating an account."
        }
        eyebrow={isCloudMode ? "Cloud vehicle" : "Local guest record"}
        onSubmit={saveVehicle}
        submitLabel="Save Vehicle"
        title="Add a vehicle"
      />
    </SafeAreaView>
  );
}
