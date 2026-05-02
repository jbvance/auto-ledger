import {
  formatCostAmount,
  formatDisplayDate,
  formatOdometer,
  type RecordAttachment,
  serviceRecordCategoryLabels,
  type ServiceRecord,
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
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RecordAttachmentsSection } from "../../../../components/RecordAttachmentsSection";
import { listAttachmentsForServiceRecord } from "../../../../lib/recordAttachments";
import { getServiceRecord } from "../../../../lib/serviceRecords";
import { getVehicle } from "../../../../lib/vehicles";

export default function ServiceRecordDetailScreen() {
  const { id, recordId } = useLocalSearchParams<{
    id: string;
    recordId: string;
  }>();
  const [attachments, setAttachments] = useState<RecordAttachment[]>([]);
  const [attachmentLoadError, setAttachmentLoadError] = useState<string | null>(
    null,
  );
  const [record, setRecord] = useState<ServiceRecord | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAttachments = useCallback(async () => {
    if (!recordId) {
      return;
    }

    try {
      setAttachmentLoadError(null);
      setAttachments(await listAttachmentsForServiceRecord(recordId));
    } catch (error: unknown) {
      console.warn("Unable to load service record attachments.", error);
      setAttachments([]);
      setAttachmentLoadError(
        "Unable to load attachments right now. The record details are still available.",
      );
    }
  }, [recordId]);

  const loadRecord = useCallback(async () => {
    if (!id || !recordId) {
      return;
    }

    setIsLoading(true);
    const [nextVehicle, nextRecord] = await Promise.all([
      getVehicle(id),
      getServiceRecord(recordId),
    ]);
    setVehicle(nextVehicle);
    setRecord(nextRecord);
    await loadAttachments();
    setIsLoading(false);
  }, [id, loadAttachments, recordId]);

  useFocusEffect(
    useCallback(() => {
      void loadRecord();
    }, [loadRecord]),
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-ledger-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#136f63" />
        </View>
      </SafeAreaView>
    );
  }

  if (!record || !vehicle || record.vehicle_id !== vehicle.id) {
    return (
      <SafeAreaView className="flex-1 bg-ledger-background">
        <View className="flex-1 justify-center gap-2 px-6">
          <Text className="text-2xl font-bold text-ledger-ink">
            Service record not found
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            This local service record may have been deleted.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        <View className="gap-2 pt-4">
          <Text className="text-sm font-bold uppercase text-ledger-primary">
            Service record
          </Text>
          <Text className="text-3xl font-extrabold text-ledger-ink">
            {record.title}
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            {vehicle.nickname}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-2 rounded-card bg-ledger-primary px-4 py-3"
            onPress={() =>
              router.push(
                `/vehicles/${vehicle.id}/service/${record.id}/edit` as Href,
              )
            }
          >
            <Text className="text-center text-base font-bold text-white">
              Edit Service Record
            </Text>
          </Pressable>
        </View>

        <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <DetailRow
            label="Category"
            value={serviceRecordCategoryLabels[record.category]}
          />
          <DetailRow
            label="Service date"
            value={formatDisplayDate(record.service_date)}
          />
          <DetailRow
            label="Odometer"
            value={
              record.odometer_reading === null ||
              record.odometer_reading === undefined
                ? null
                : formatOdometer(record.odometer_reading, vehicle.odometer_unit)
            }
          />
          <DetailRow label="Vendor / shop" value={record.vendor_name} />
          <DetailRow
            label="Cost"
            value={formatCostAmount(record.cost_amount, record.cost_currency)}
          />
        </View>

        <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <DetailRow label="Description" value={record.description} />
          <DetailRow label="Notes" value={record.notes} />
        </View>

        {attachmentLoadError ? (
          <View className="rounded-card border border-red-200 bg-ledger-surface p-4">
            <Text className="text-sm leading-5 text-ledger-muted">
              {attachmentLoadError}
            </Text>
          </View>
        ) : null}

        <RecordAttachmentsSection
          attachments={attachments}
          onAttachmentsChanged={loadAttachments}
          recordId={record.id}
          recordType="service"
          vehicle={vehicle}
        />
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
