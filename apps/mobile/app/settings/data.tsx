import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth";
import {
  deleteAllLocalGuestData,
  getLocalGuestDataControlSummary,
  localGuestDataDeleteConfirmationPhrase,
  type LocalGuestDataControlSummary,
} from "../../lib/localDataControls";

export default function AccountDataControlsScreen() {
  const { isConfigured, isLoading: isAuthLoading, user } = useAuth();
  const [confirmationText, setConfirmationText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<LocalGuestDataControlSummary | null>(
    null,
  );

  const loadSummary = useCallback(async () => {
    setIsLoading(true);

    try {
      setSummary(await getLocalGuestDataControlSummary(user?.id ?? null));
    } catch (error: unknown) {
      console.warn("Unable to load local data controls.", error);
      setFeedback("Unable to load local data details right now.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary]),
  );

  const deleteLocalData = async () => {
    if (confirmationText !== localGuestDataDeleteConfirmationPhrase) {
      return;
    }

    setFeedback(null);
    setIsDeleting(true);

    try {
      const result = await deleteAllLocalGuestData();

      setConfirmationText("");
      setFeedback(
        result.failedAttachmentFileDeletes > 0
          ? `${result.deletedRecordCount} local records were deleted from this device. ${result.failedAttachmentFileDeletes} local attachment file${result.failedAttachmentFileDeletes === 1 ? "" : "s"} could not be removed automatically.`
          : `${result.deletedRecordCount} local records were deleted from this device. Cloud account data was not changed.`,
      );
      await loadSummary();
    } catch (error: unknown) {
      console.warn("Unable to delete local guest data.", error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "Unable to delete local guest data right now.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading || isAuthLoading || !summary) {
    return (
      <SafeAreaView className="flex-1 bg-ledger-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#136f63" />
        </View>
      </SafeAreaView>
    );
  }

  const counts = summary.migrationSummary.counts;
  const canDeleteLocalData =
    summary.hasLocalGuestData &&
    confirmationText === localGuestDataDeleteConfirmationPhrase &&
    !isDeleting;

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        <View className="gap-2 pt-4">
          <Text className="text-sm font-bold uppercase text-ledger-primary">
            Account
          </Text>
          <Text className="text-4xl font-extrabold text-ledger-ink">
            Data Controls
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            Local guest records are stored on this device. Cloud account
            records are stored in your AutoLedger account. Moving local records
            to your account is optional.
          </Text>
        </View>

        <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <Text className="text-lg font-bold text-ledger-ink">
            Account Status
          </Text>
          <SettingsRow
            label="Mode"
            value={user ? "Signed in" : "Guest mode"}
          />
          <SettingsRow label="Email" value={user?.email ?? "Not signed in"} />
          <Text className="text-sm leading-5 text-ledger-muted">
            Signing in saves new cloud records to your account. It does not
            automatically upload or delete local guest records.
          </Text>
          {!user && isConfigured ? (
            <Pressable
              accessibilityRole="button"
              className="rounded-card bg-ledger-primary px-4 py-3"
              onPress={() => router.push("/auth/sign-in" as Href)}
            >
              <Text className="text-center text-base font-bold text-white">
                Sign In
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <View className="gap-1">
            <Text className="text-lg font-bold text-ledger-ink">
              Local Guest Data
            </Text>
            <Text className="text-sm leading-5 text-ledger-muted">
              This affects only records stored on this device. It does not
              delete cloud account data.
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Metric label="Vehicles" value={counts.totalVehicles} />
            <Metric label="Records" value={counts.totalRecords} />
            <Metric label="Attachments" value={counts.attachments} />
          </View>
          <Pressable
            accessibilityRole="button"
            className="rounded-card bg-ledger-primary px-4 py-3"
            onPress={() => router.push("/settings/export" as Href)}
          >
            <Text className="text-center text-base font-bold text-white">
              Export Local CSV
            </Text>
          </Pressable>
          {summary.hasLocalGuestData ? (
            <View className="gap-3 rounded-card border border-red-200 bg-ledger-background p-3">
              <Text className="text-sm font-bold text-ledger-ink">
                Delete local guest data
              </Text>
              <Text className="text-sm leading-5 text-ledger-muted">
                Export first if you want a copy. To delete only local guest
                records on this device, type{" "}
                {localGuestDataDeleteConfirmationPhrase}.
              </Text>
              <TextInput
                autoCapitalize="characters"
                className="rounded-card border border-ledger-line bg-ledger-surface px-4 py-3 text-base text-ledger-ink"
                onChangeText={setConfirmationText}
                placeholder={localGuestDataDeleteConfirmationPhrase}
                placeholderTextColor="#667277"
                value={confirmationText}
              />
              <Pressable
                accessibilityRole="button"
                className={`rounded-card px-4 py-3 ${
                  canDeleteLocalData
                    ? "bg-red-700"
                    : "bg-red-700 opacity-50"
                }`}
                disabled={!canDeleteLocalData}
                onPress={() => {
                  void deleteLocalData();
                }}
              >
                <Text className="text-center text-base font-bold text-white">
                  {isDeleting ? "Deleting..." : "Delete Local Guest Data"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
              <Text className="text-sm leading-5 text-ledger-muted">
                No local guest records were found on this device.
              </Text>
            </View>
          )}
        </View>

        <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <View className="gap-1">
            <Text className="text-lg font-bold text-ledger-ink">
              Cloud Account Data
            </Text>
            <Text className="text-sm leading-5 text-ledger-muted">
              Cloud account records are stored in Supabase under your signed-in
              AutoLedger account. Web export is available from the web app.
            </Text>
          </View>
          {user ? (
            <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
              <Text className="text-sm leading-5 text-ledger-muted">
                Account deletion and full cloud data deletion require a
                server-only flow so private service role keys never reach this
                app. This destructive control is planned and not active yet.
              </Text>
            </View>
          ) : (
            <Text className="text-sm leading-5 text-ledger-muted">
              Sign in to create and manage cloud account records. Guest mode
              remains available without an account.
            </Text>
          )}
        </View>

        {feedback ? (
          <View className="rounded-card border border-ledger-line bg-ledger-surface p-4">
            <Text className="text-sm leading-5 text-ledger-muted">
              {feedback}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-3 border-b border-ledger-line pb-3">
      <Text className="text-sm font-bold text-ledger-muted">{label}</Text>
      <Text className="flex-1 text-right text-sm font-bold text-ledger-ink">
        {value}
      </Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View className="min-w-[96px] flex-1 rounded-card border border-ledger-line bg-ledger-background p-3">
      <Text className="text-xs font-bold uppercase text-ledger-muted">
        {label}
      </Text>
      <Text className="mt-1 text-xl font-extrabold text-ledger-ink">
        {value}
      </Text>
    </View>
  );
}
