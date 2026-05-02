import {
  formatAttachmentFileSize,
  formatAttachmentTypeLabel,
  formatDisplayDate,
  getAttachmentDisplayName,
  type RecordAttachment,
  type RecordAttachmentInput,
  type Vehicle,
} from "@autoledger/shared";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { createAttachment, deleteAttachment } from "../lib/recordAttachments";

type RecordAttachmentsSectionProps =
  | {
      attachments: RecordAttachment[];
      mode?: "cloud" | "local";
      onAttachmentsChanged: () => Promise<void>;
      onCreateAttachment?: (input: RecordAttachmentInput) => Promise<void>;
      onDeleteAttachment?: (attachment: RecordAttachment) => Promise<void>;
      onOpenAttachment?: (attachment: RecordAttachment) => Promise<void>;
      recordId: string;
      recordType: "service";
      vehicle: Vehicle;
    }
  | {
      attachments: RecordAttachment[];
      mode?: "cloud" | "local";
      onAttachmentsChanged: () => Promise<void>;
      onCreateAttachment?: (input: RecordAttachmentInput) => Promise<void>;
      onDeleteAttachment?: (attachment: RecordAttachment) => Promise<void>;
      onOpenAttachment?: (attachment: RecordAttachment) => Promise<void>;
      recordId: string;
      recordType: "repair";
      vehicle: Vehicle;
    };

const getFileNameFromUri = (uri: string, fallback: string) => {
  const withoutQuery = uri.split("?")[0] ?? uri;
  const segment = withoutQuery.split("/").filter(Boolean).pop();

  return segment ? decodeURIComponent(segment) : fallback;
};

const getImageMimeType = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "png") {
    return "image/png";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  if (extension === "gif") {
    return "image/gif";
  }

  return "image/jpeg";
};

const getPdfFileName = (fileName: string) =>
  fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;

export function RecordAttachmentsSection({
  attachments,
  mode = "local",
  onAttachmentsChanged,
  onCreateAttachment,
  onDeleteAttachment,
  onOpenAttachment,
  recordId,
  recordType,
  vehicle,
}: RecordAttachmentsSectionProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const modeLabel = mode === "cloud" ? "cloud" : "local";

  const buildAttachmentInput = (
    input: Omit<
      RecordAttachmentInput,
      "repair_record_id" | "service_record_id" | "vehicle_id"
    >,
  ): RecordAttachmentInput => ({
    ...input,
    repair_record_id: recordType === "repair" ? recordId : undefined,
    service_record_id: recordType === "service" ? recordId : undefined,
    vehicle_id: vehicle.id,
  });

  const saveAttachment = async (input: RecordAttachmentInput) => {
    if (onCreateAttachment) {
      await onCreateAttachment(input);
    } else {
      await createAttachment(input);
    }

    await onAttachmentsChanged();
    setFeedback("Attachment added.");
  };

  const addPhoto = async () => {
    setIsAdding(true);
    setFeedback(null);

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setFeedback("Photo access was not allowed. You can still add PDFs.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: false,
        mediaTypes: ["images"],
        quality: 1,
      });

      if (result.canceled) {
        setFeedback("No photo selected.");
        return;
      }

      const asset = result.assets[0];

      if (!asset?.uri) {
        setFeedback("Unable to read the selected photo.");
        return;
      }

      const fileName =
        asset.fileName ?? getFileNameFromUri(asset.uri, "receipt-photo.jpg");
      const mimeType = asset.mimeType ?? getImageMimeType(fileName);

      await saveAttachment(
        buildAttachmentInput({
          file_name: fileName,
          file_size_bytes: asset.fileSize,
          file_type: "photo",
          local_uri: asset.uri,
          mime_type: mimeType,
        }),
      );
    } catch (error: unknown) {
      console.warn("Unable to add photo attachment.", error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "Unable to add that photo. Please try again.",
      );
    } finally {
      setIsAdding(false);
    }
  };

  const addPdf = async () => {
    setIsAdding(true);
    setFeedback(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: "application/pdf",
      });

      if (result.canceled) {
        setFeedback("No document selected.");
        return;
      }

      const asset = result.assets[0];

      if (!asset?.uri) {
        setFeedback("Unable to read the selected document.");
        return;
      }

      await saveAttachment(
        buildAttachmentInput({
          file_name: getPdfFileName(asset.name),
          file_size_bytes: asset.size,
          file_type: "pdf",
          local_uri: asset.uri,
          mime_type: asset.mimeType ?? "application/pdf",
        }),
      );
    } catch (error: unknown) {
      console.warn("Unable to add PDF attachment.", error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "Unable to add that PDF. Please try again.",
      );
    } finally {
      setIsAdding(false);
    }
  };

  const openAttachment = async (attachment: RecordAttachment) => {
    setFeedback(null);

    try {
      if (onOpenAttachment) {
        await onOpenAttachment(attachment);
        return;
      }

      router.push(`/attachments/${attachment.id}` as Href);
    } catch (error: unknown) {
      console.warn("Unable to open attachment.", error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "Unable to open this attachment. Please try again.",
      );
    }
  };

  const confirmDeleteAttachment = (attachment: RecordAttachment) => {
    Alert.alert(
      "Delete attachment?",
      `${getAttachmentDisplayName(attachment)} will be removed from this ${modeLabel} record.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void removeAttachment(attachment);
          },
        },
      ],
    );
  };

  const removeAttachment = async (attachment: RecordAttachment) => {
    setIsDeletingId(attachment.id);
    setFeedback(null);

    try {
      if (onDeleteAttachment) {
        await onDeleteAttachment(attachment);
      } else {
        await deleteAttachment(attachment.id);
      }

      await onAttachmentsChanged();
      setFeedback("Attachment deleted.");
    } catch (error: unknown) {
      console.warn("Unable to delete attachment.", error);
      setFeedback("Unable to delete this attachment. Please try again.");
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
      <View className="gap-1">
        <Text className="text-base font-bold text-ledger-ink">Attachments</Text>
        <Text className="text-sm leading-5 text-ledger-muted">
          Add receipt photos or PDFs to this {modeLabel} record.
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Pressable
          accessibilityRole="button"
          className="rounded-card bg-ledger-primary px-3 py-2"
          disabled={isAdding}
          onPress={() => {
            void addPhoto();
          }}
        >
          <Text className="text-sm font-bold text-white">
            {isAdding ? "Adding..." : "Add Photo"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          className="rounded-card border border-ledger-line bg-ledger-background px-3 py-2"
          disabled={isAdding}
          onPress={() => {
            void addPdf();
          }}
        >
          <Text className="text-sm font-bold text-ledger-ink">
            Add receipt or document
          </Text>
        </Pressable>
      </View>

      {feedback ? (
        <View className="rounded-card bg-ledger-background p-3">
          <Text className="text-sm leading-5 text-ledger-muted">
            {feedback}
          </Text>
        </View>
      ) : null}

      {attachments.length === 0 ? (
        <View className="gap-1 rounded-card border border-ledger-line bg-ledger-background p-4">
          <Text className="text-base font-bold text-ledger-ink">
            No receipts or documents yet.
          </Text>
          <Text className="text-sm leading-5 text-ledger-muted">
            {mode === "cloud"
              ? "Photos and PDFs are stored privately in Supabase."
              : "Photos and PDFs are saved locally on this device."}
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {attachments.map((attachment) => (
            <AttachmentRow
              attachment={attachment}
              isDeleting={isDeletingId === attachment.id}
              key={attachment.id}
              onDelete={() => confirmDeleteAttachment(attachment)}
              onOpen={() => {
                void openAttachment(attachment);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function AttachmentRow({
  attachment,
  isDeleting,
  onDelete,
  onOpen,
}: {
  attachment: RecordAttachment;
  isDeleting: boolean;
  onDelete: () => void;
  onOpen: () => void;
}) {
  return (
    <View className="gap-3 rounded-card border border-ledger-line bg-ledger-background p-3">
      <Pressable accessibilityRole="button" className="gap-2" onPress={onOpen}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-base font-bold text-ledger-ink">
              {getAttachmentDisplayName(attachment)}
            </Text>
            <Text className="text-sm leading-5 text-ledger-muted">
              Added {formatDisplayDate(attachment.created_at.slice(0, 10))}
            </Text>
          </View>
          <View className="rounded-card bg-ledger-surface px-2 py-1">
            <Text className="text-xs font-bold uppercase text-ledger-muted">
              {formatAttachmentTypeLabel(attachment.file_type)}
            </Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <View className="rounded-card bg-ledger-surface px-2 py-1">
            <Text className="text-xs font-bold uppercase text-ledger-muted">
              {formatAttachmentFileSize(attachment.file_size_bytes)}
            </Text>
          </View>
          <View className="rounded-card bg-ledger-surface px-2 py-1">
            <Text className="text-xs font-bold uppercase text-ledger-muted">
              Tap to open
            </Text>
          </View>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        className="rounded-card border border-red-200 bg-ledger-surface px-3 py-2"
        disabled={isDeleting}
        onPress={onDelete}
      >
        <Text className="text-center text-sm font-bold text-red-700">
          {isDeleting ? "Deleting..." : "Delete Attachment"}
        </Text>
      </Pressable>
    </View>
  );
}
