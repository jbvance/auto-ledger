import {
  formatOdometer,
  formatDisplayDate,
  odometerSourceTypeLabels,
  type OdometerEntry,
  type OdometerEntryInput,
  type OdometerUnit,
  type Vehicle,
} from "@autoledger/shared";
import { odometerEntrySchema } from "@autoledger/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Controller,
  useForm,
  type Control,
  type Path,
  type Resolver,
} from "react-hook-form";

export type OdometerEntryFormValues = {
  vehicle_id: string;
  reading: string;
  reading_date: string;
  odometer_unit: OdometerUnit;
  source_type: "manual";
  notes: string;
};

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

export const defaultOdometerEntryFormValues = (
  vehicle: Vehicle,
): OdometerEntryFormValues => ({
  vehicle_id: vehicle.id,
  reading: "",
  reading_date: "",
  odometer_unit: vehicle.odometer_unit,
  source_type: "manual",
  notes: "",
});

export const odometerEntryToFormValues = (
  entry: OdometerEntry,
): OdometerEntryFormValues => ({
  vehicle_id: entry.vehicle_id,
  reading: `${entry.reading}`,
  reading_date: entry.reading_date,
  odometer_unit: entry.odometer_unit,
  source_type: "manual",
  notes: entry.notes ?? "",
});

type OdometerEntryFormProps = {
  defaultValues: OdometerEntryFormValues;
  description: string;
  onSubmit: (input: OdometerEntryInput) => Promise<void>;
  submitLabel: string;
  title: string;
  vehicle: Vehicle;
};

export function OdometerEntryForm({
  defaultValues,
  description,
  onSubmit,
  submitLabel,
  title,
  vehicle,
}: OdometerEntryFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
  } = useForm<OdometerEntryFormValues>({
    defaultValues,
    resolver: zodResolver(
      odometerEntrySchema,
    ) as unknown as Resolver<OdometerEntryFormValues>,
  });

  const submitForm = handleSubmit(async (values) => {
    setSubmitError(null);
    const input = odometerEntrySchema.parse(values);
    await onSubmit(input);
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <ScrollView
        contentContainerClassName="gap-5 px-6 py-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-2">
          <Text className="text-sm font-bold uppercase text-ledger-primary">
            Odometer
          </Text>
          <Text className="text-3xl font-extrabold text-ledger-ink">
            {title}
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            {description}
          </Text>
        </View>

        <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <Text className="text-sm font-bold uppercase text-ledger-muted">
            Vehicle
          </Text>
          <Text className="text-lg font-bold text-ledger-ink">
            {vehicle.nickname}
          </Text>
          <Text className="text-sm leading-5 text-ledger-muted">
            Readings use{" "}
            {formatOdometer(vehicle.current_odometer, vehicle.odometer_unit)} as
            the current vehicle odometer context.
          </Text>
        </View>

        <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <OdometerTextField
            control={control}
            error={errors.reading}
            keyboardType="number-pad"
            label="Reading"
            name="reading"
            placeholder="42500"
          />
          <OdometerDateField
            control={control}
            error={errors.reading_date}
            label="Reading Date"
            name="reading_date"
          />
          <View className="gap-2">
            <Text className="text-sm font-bold text-ledger-ink">Unit</Text>
            <View className="rounded-card border border-ledger-line bg-ledger-background px-3 py-3">
              <Text className="text-base font-semibold text-ledger-ink">
                {vehicle.odometer_unit}
              </Text>
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-sm font-bold text-ledger-ink">Source</Text>
            <View className="rounded-card border border-ledger-line bg-ledger-background px-3 py-3">
              <Text className="text-base font-semibold text-ledger-ink">
                {odometerSourceTypeLabels.manual}
              </Text>
            </View>
          </View>
          <OdometerTextField
            control={control}
            error={errors.notes}
            label="Notes"
            multiline
            name="notes"
            placeholder="Optional context"
          />
        </View>

        {submitError ? (
          <Text className="text-sm font-semibold text-red-700">
            {submitError}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          className="rounded-card bg-ledger-primary px-4 py-4"
          disabled={isSubmitting}
          onPress={() => {
            void submitForm().catch((error: unknown) => {
              setSubmitError(
                error instanceof Error
                  ? error.message
                  : "Unable to save this odometer entry. Please try again.",
              );
            });
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-center text-base font-bold text-white">
              {submitLabel}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type OdometerDateFieldProps = {
  control: Control<OdometerEntryFormValues>;
  error?: { message?: string };
  label: string;
  name: Path<OdometerEntryFormValues>;
};

function OdometerDateField({
  control,
  error,
  label,
  name,
}: OdometerDateFieldProps) {
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onBlur, onChange, value } }) => {
        const selectedDate = parseDateOnly(value) ?? new Date();
        const displayValue = value ? formatDisplayDate(value) : "Select date";

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
                  value ? "text-ledger-ink" : "text-ledger-muted"
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

type OdometerTextFieldProps = {
  control: Control<OdometerEntryFormValues>;
  error?: { message?: string };
  keyboardType?: "default" | "number-pad";
  label: string;
  multiline?: boolean;
  name: Path<OdometerEntryFormValues>;
  placeholder?: string;
};

function OdometerTextField({
  control,
  error,
  keyboardType = "default",
  label,
  multiline = false,
  name,
  placeholder,
}: OdometerTextFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onBlur, onChange, value } }) => (
        <View className="gap-2">
          <Text className="text-sm font-bold text-ledger-ink">{label}</Text>
          <TextInput
            autoCapitalize="sentences"
            className={`rounded-card border px-3 py-3 text-base text-ledger-ink ${
              error ? "border-red-500" : "border-ledger-line"
            } ${multiline ? "min-h-24" : ""}`}
            keyboardType={keyboardType}
            multiline={multiline}
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor="#667277"
            textAlignVertical={multiline ? "top" : "center"}
            value={`${value ?? ""}`}
          />
          {error?.message ? (
            <Text className="text-sm font-semibold text-red-700">
              {error.message}
            </Text>
          ) : null}
        </View>
      )}
    />
  );
}
