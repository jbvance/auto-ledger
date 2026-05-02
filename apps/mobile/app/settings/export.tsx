import * as Sharing from "expo-sharing";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createLocalCsvExportFile,
  getLocalCsvExportSummary,
  type LocalCsvExportSummary,
} from "../../lib/localCsvExport";

type ExportStatus = "idle" | "success" | "error";

type ExportSummary = Awaited<ReturnType<typeof getLocalCsvExportSummary>>;

const emptySummary: ExportSummary = {
  hasData: false,
  recordCounts: {
    attachments: 0,
    maintenanceReminders: 0,
    odometerEntries: 0,
    repairRecords: 0,
    serviceRecords: 0,
    vehicles: 0,
  },
};

export default function ExportDataScreen() {
  const [exportResult, setExportResult] =
    useState<LocalCsvExportSummary | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [summary, setSummary] = useState<ExportSummary>(emptySummary);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);

    try {
      setSummary(await getLocalCsvExportSummary());
    } catch (error: unknown) {
      console.warn("Unable to load local export summary.", error);
      setFeedback("Unable to check local export data right now.");
      setStatus("error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary]),
  );

  const exportCsv = async () => {
    setIsExporting(true);
    setFeedback(null);
    setStatus("idle");
    setExportResult(null);

    try {
      const result = await createLocalCsvExportFile();
      const sharingAvailable = await Sharing.isAvailableAsync();

      setExportResult(result);
      setSummary({
        hasData: result.hasData,
        recordCounts: result.recordCounts,
      });

      if (!sharingAvailable) {
        setStatus("success");
        setFeedback(
          "CSV export was created locally, but sharing is not available on this device.",
        );
        return;
      }

      await Sharing.shareAsync(result.fileUri, {
        dialogTitle: "Export AutoLedger CSV",
        mimeType: "text/csv",
        UTI: "public.comma-separated-values-text",
      });
      setStatus("success");
      setFeedback("CSV export is ready. Choose where to save or share it.");
    } catch (error: unknown) {
      console.warn("Unable to export local CSV data.", error);
      setStatus("error");
      setFeedback("Unable to create the CSV export. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        <View className="gap-2 pt-4">
          <Text className="text-sm font-bold uppercase text-ledger-primary">
            Export
          </Text>
          <Text className="text-4xl font-extrabold text-ledger-ink">
            Local CSV
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            Create a CSV file from guest records stored on this device. Nothing
            is uploaded, and no account is required.
          </Text>
        </View>

        <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <View className="gap-1">
            <Text className="text-lg font-bold text-ledger-ink">
              Export Contents
            </Text>
            <Text className="text-sm leading-5 text-ledger-muted">
              The CSV includes vehicles, odometer entries, service records,
              repair records, reminders, and attachment metadata.
            </Text>
          </View>

          {isLoading ? (
            <View className="py-4">
              <ActivityIndicator color="#136f63" />
            </View>
          ) : (
            <View className="gap-2">
              <CountRow
                label="Vehicles"
                value={summary.recordCounts.vehicles}
              />
              <CountRow
                label="Odometer entries"
                value={summary.recordCounts.odometerEntries}
              />
              <CountRow
                label="Service records"
                value={summary.recordCounts.serviceRecords}
              />
              <CountRow
                label="Repair records"
                value={summary.recordCounts.repairRecords}
              />
              <CountRow
                label="Reminders"
                value={summary.recordCounts.maintenanceReminders}
              />
              <CountRow
                label="Attachment metadata"
                value={summary.recordCounts.attachments}
              />
            </View>
          )}

          {!isLoading && !summary.hasData ? (
            <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
              <Text className="text-sm leading-5 text-ledger-muted">
                No local records were found yet. You can still export an empty
                CSV with headers if you want a template.
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            className="rounded-card bg-ledger-primary px-4 py-4"
            disabled={isExporting || isLoading}
            onPress={() => {
              void exportCsv();
            }}
          >
            {isExporting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-center text-base font-bold text-white">
                Export CSV
              </Text>
            )}
          </Pressable>
        </View>

        <View className="gap-2 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <Text className="text-base font-bold text-ledger-ink">
            Privacy Note
          </Text>
          <Text className="text-sm leading-5 text-ledger-muted">
            Export creates a local CSV file and opens your device share sheet.
            AutoLedger does not upload this export anywhere.
          </Text>
        </View>

        {feedback ? (
          <View
            className={`rounded-card border p-4 ${
              status === "error"
                ? "border-red-200 bg-ledger-surface"
                : "border-ledger-line bg-ledger-surface"
            }`}
          >
            <Text className="text-sm leading-5 text-ledger-muted">
              {feedback}
            </Text>
            {exportResult?.fileUri ? (
              <Text className="mt-2 text-xs leading-5 text-ledger-muted">
                File: {exportResult.fileUri}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View className="gap-2 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <Text className="text-base font-bold text-ledger-ink">
            Not Included
          </Text>
          <Text className="text-sm leading-5 text-ledger-muted">
            PDF export, cloud backup, Supabase sync, and cloud file storage are
            intentionally not part of this local CSV export.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-row justify-between gap-3 border-b border-ledger-line pb-2 last:border-b-0 last:pb-0">
      <Text className="text-sm font-bold text-ledger-muted">{label}</Text>
      <Text className="text-sm font-bold text-ledger-ink">{value}</Text>
    </View>
  );
}
