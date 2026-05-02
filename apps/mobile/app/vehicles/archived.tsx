import type { Vehicle } from "@autoledger/shared";
import { router, useFocusEffect } from "expo-router";
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

import { VehicleSummaryCard } from "../../components/VehicleSummaryCard";
import {
  listArchivedCloudVehicles,
  restoreCloudVehicle,
} from "../../lib/cloudVehicles";
import { useAuth } from "../../lib/auth";
import { listArchivedVehicles, restoreVehicle } from "../../lib/vehicles";

export default function ArchivedVehiclesScreen() {
  const { isLoading: isAuthLoading, user } = useAuth();
  const isCloudMode = Boolean(user);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const nextVehicles = isCloudMode
        ? await listArchivedCloudVehicles()
        : await listArchivedVehicles();

      setVehicles(nextVehicles);
    } catch {
      setLoadError(
        isCloudMode
          ? "Unable to load archived cloud vehicles. Please try again."
          : "Unable to load archived local vehicles. Please try again.",
      );
      setVehicles([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthLoading, isCloudMode]);

  useFocusEffect(
    useCallback(() => {
      void loadVehicles();
    }, [loadVehicles]),
  );

  const confirmRestore = (vehicle: Vehicle) => {
    Alert.alert(
      "Restore vehicle?",
      `${vehicle.nickname} will return to your active vehicle list.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Restore",
          onPress: () => {
            void restoreArchivedVehicle(vehicle.id);
          },
        },
      ],
    );
  };

  const restoreArchivedVehicle = async (id: string) => {
    setFeedback(null);
    setRestoringId(id);
    try {
      if (isCloudMode) {
        await restoreCloudVehicle(id);
      } else {
        await restoreVehicle(id);
      }

      await loadVehicles();
    } catch {
      setFeedback(
        isCloudMode
          ? "Unable to restore this cloud vehicle. Please check your connection and try again."
          : "Unable to restore this local vehicle. Please try again.",
      );
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        <View className="gap-2 pt-4">
          <Text className="text-sm font-bold uppercase text-ledger-primary">
            Archived
          </Text>
          <Text className="text-3xl font-extrabold text-ledger-ink">
            Archived vehicles
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            {isCloudMode
              ? "Vehicles hidden from your account list are kept here so they can be restored later."
              : "Vehicles hidden from your main list are kept here so their local records can be restored later."}
          </Text>
        </View>

        {isLoading || isAuthLoading ? (
          <View className="rounded-card border border-ledger-line bg-ledger-surface p-6">
            <ActivityIndicator color="#136f63" />
          </View>
        ) : loadError ? (
          <View className="gap-3 rounded-card border border-red-200 bg-ledger-surface p-5">
            <Text className="text-xl font-bold text-ledger-ink">
              Archived vehicles unavailable
            </Text>
            <Text className="text-base leading-6 text-ledger-muted">
              {loadError}
            </Text>
            <Pressable
              accessibilityRole="button"
              className="rounded-card bg-ledger-primary px-4 py-3"
              onPress={() => {
                void loadVehicles();
              }}
            >
              <Text className="text-center text-base font-bold text-white">
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : vehicles.length === 0 ? (
          <View className="gap-2 rounded-card border border-ledger-line bg-ledger-surface p-5">
            <Text className="text-xl font-bold text-ledger-ink">
              No archived vehicles
            </Text>
            <Text className="text-base leading-6 text-ledger-muted">
              Archived vehicles will appear here after you hide them from the
              active list.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {feedback ? (
              <View className="rounded-card border border-red-200 bg-ledger-surface p-3">
                <Text className="text-sm leading-5 text-ledger-muted">
                  {feedback}
                </Text>
              </View>
            ) : null}
            {vehicles.map((vehicle) => (
              <VehicleSummaryCard
                footer={
                  <Pressable
                    accessibilityRole="button"
                    className="rounded-card border border-ledger-primary px-4 py-3"
                    disabled={restoringId === vehicle.id}
                    onPress={() => confirmRestore(vehicle)}
                  >
                    <Text className="text-center text-base font-bold text-ledger-primary">
                      {restoringId === vehicle.id ? "Restoring..." : "Restore"}
                    </Text>
                  </Pressable>
                }
                key={vehicle.id}
                vehicle={vehicle}
              />
            ))}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          className="rounded-card bg-ledger-primary px-4 py-3"
          onPress={() => router.replace("/")}
        >
          <Text className="text-center text-base font-bold text-white">
            Back to Vehicles
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
