import {
  formatAttachmentFileSize,
  formatAttachmentTypeLabel,
  formatDisplayDate,
  getAttachmentDisplayName,
  type RecordAttachment,
} from "@autoledger/shared";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getAttachment } from "../../lib/recordAttachments";

export default function AttachmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [attachment, setAttachment] = useState<RecordAttachment | null>(null);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openError, setOpenError] = useState<string | null>(null);

  const loadAttachment = useCallback(async () => {
    if (!id) {
      return;
    }

    setIsLoading(true);
    setImageLoadError(null);
    setOpenError(null);
    setAttachment(await getAttachment(id));
    setIsLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadAttachment();
    }, [loadAttachment]),
  );

  const openExternally = async () => {
    if (!attachment) {
      return;
    }

    try {
      setOpenError(null);

      if (attachment.file_type === "pdf") {
        const isSharingAvailable = await Sharing.isAvailableAsync();

        if (!isSharingAvailable) {
          setOpenError("PDF sharing is not available on this device.");
          return;
        }

        await Sharing.shareAsync(attachment.local_uri, {
          dialogTitle: getAttachmentDisplayName(attachment),
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
        });
        return;
      }

      const uri =
        Platform.OS === "android" && attachment.local_uri.startsWith("file://")
          ? await FileSystem.getContentUriAsync(attachment.local_uri)
          : attachment.local_uri;

      await Linking.openURL(uri);
    } catch (error: unknown) {
      console.warn("Unable to open attachment externally.", error);
      setOpenError("Unable to open this attachment with another app.");
    }
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

  if (!attachment) {
    return (
      <SafeAreaView className="flex-1 bg-ledger-background">
        <View className="flex-1 justify-center gap-4 px-6">
          <Text className="text-2xl font-bold text-ledger-ink">
            Attachment not found
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            This local attachment may have been deleted.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="rounded-card bg-ledger-primary px-4 py-3"
            onPress={() => router.back()}
          >
            <Text className="text-center text-base font-bold text-white">
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = getAttachmentDisplayName(attachment);

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        <View className="gap-2 pt-4">
          <Text className="text-sm font-bold uppercase text-ledger-primary">
            Attachment
          </Text>
          <Text className="text-3xl font-extrabold text-ledger-ink">
            {displayName}
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            Stored locally on this device.
          </Text>
        </View>

        {attachment.file_type === "photo" ? (
          <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-3">
            <View className="min-h-[420px] overflow-hidden rounded-card bg-ledger-background">
              <Image
                accessibilityLabel={displayName}
                className="h-[420px] w-full"
                onError={() => {
                  setImageLoadError(
                    "Unable to preview this photo in AutoLedger.",
                  );
                }}
                resizeMode="contain"
                source={{ uri: attachment.local_uri }}
              />
            </View>
            {imageLoadError ? (
              <Text className="text-sm leading-5 text-ledger-muted">
                {imageLoadError}
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
            <Text className="text-lg font-bold text-ledger-ink">
              PDF document
            </Text>
            <Text className="text-sm leading-5 text-ledger-muted">
              PDF previews are handled by your device. Open this document with a
              PDF viewer installed on your phone.
            </Text>
            <Pressable
              accessibilityRole="button"
              className="rounded-card bg-ledger-primary px-4 py-3"
              onPress={() => {
                void openExternally();
              }}
            >
              <Text className="text-center text-base font-bold text-white">
                Open PDF
              </Text>
            </Pressable>
          </View>
        )}

        <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <Text className="text-lg font-bold text-ledger-ink">Details</Text>
          <DetailRow
            label="Type"
            value={formatAttachmentTypeLabel(attachment.file_type)}
          />
          <DetailRow
            label="Size"
            value={formatAttachmentFileSize(attachment.file_size_bytes)}
          />
          <DetailRow label="MIME type" value={attachment.mime_type} />
          <DetailRow
            label="Created"
            value={formatDisplayDate(attachment.created_at.slice(0, 10))}
          />
        </View>

        {attachment.file_type === "photo" ? (
          <Pressable
            accessibilityRole="button"
            className="rounded-card border border-ledger-line bg-ledger-surface px-4 py-3"
            onPress={() => {
              void openExternally();
            }}
          >
            <Text className="text-center text-base font-bold text-ledger-ink">
              Open With Another App
            </Text>
          </Pressable>
        ) : null}

        {openError ? (
          <View className="rounded-card border border-red-200 bg-ledger-surface p-4">
            <Text className="text-sm leading-5 text-ledger-muted">
              {openError}
            </Text>
          </View>
        ) : null}
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
