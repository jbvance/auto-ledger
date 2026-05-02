import { formatDisplayDate } from "@autoledger/shared";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";

const dateToDateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const parseDateOnly = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

type DatePickerFieldProps<TFieldValues extends FieldValues> = {
  clearLabel?: string;
  control: Control<TFieldValues>;
  error?: { message?: string };
  label: string;
  name: Path<TFieldValues>;
  optional?: boolean;
  placeholder?: string;
};

export function DatePickerField<TFieldValues extends FieldValues>({
  clearLabel = "Clear Date",
  control,
  error,
  label,
  name,
  optional = false,
  placeholder = "Select date",
}: DatePickerFieldProps<TFieldValues>) {
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onBlur, onChange, value } }) => {
        const dateValue = typeof value === "string" ? value : "";
        const selectedDate = parseDateOnly(dateValue) ?? new Date();
        const displayValue = dateValue
          ? formatDisplayDate(dateValue)
          : placeholder;

        const handlePickerChange = (
          event: DateTimePickerEvent,
          nextDate?: Date,
        ) => {
          if (Platform.OS !== "ios") {
            setIsPickerVisible(false);
            onBlur();
          }

          if (event.type === "set" && nextDate) {
            onChange(dateToDateOnly(nextDate));
          }
        };

        return (
          <View className="gap-2">
            <Text className="text-sm font-bold text-ledger-ink">{label}</Text>
            <Pressable
              accessibilityRole="button"
              className={`rounded-card border px-3 py-3 ${
                error ? "border-red-500" : "border-ledger-line"
              } bg-ledger-background`}
              onPress={() => {
                setIsPickerVisible(true);
              }}
            >
              <Text
                className={`text-base font-semibold ${
                  dateValue ? "text-ledger-ink" : "text-ledger-muted"
                }`}
              >
                {displayValue}
              </Text>
            </Pressable>
            {isPickerVisible ? (
              <View className="gap-2 rounded-card border border-ledger-line bg-ledger-background p-2">
                <DateTimePicker
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  mode="date"
                  onChange={handlePickerChange}
                  value={selectedDate}
                />
                {Platform.OS === "ios" ? (
                  <Pressable
                    accessibilityRole="button"
                    className="rounded-card bg-ledger-primary px-4 py-3"
                    onPress={() => {
                      onChange(dateToDateOnly(selectedDate));
                      onBlur();
                      setIsPickerVisible(false);
                    }}
                  >
                    <Text className="text-center text-sm font-bold text-white">
                      Done
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {optional && dateValue ? (
              <Pressable
                accessibilityRole="button"
                className="self-start rounded-card border border-ledger-line bg-ledger-background px-3 py-2"
                onPress={() => {
                  onChange("");
                  onBlur();
                }}
              >
                <Text className="text-sm font-bold text-ledger-ink">
                  {clearLabel}
                </Text>
              </Pressable>
            ) : null}
            {error?.message ? (
              <Text className="text-sm font-semibold text-red-700">
                {error.message}
              </Text>
            ) : null}
          </View>
        );
      }}
    />
  );
}
