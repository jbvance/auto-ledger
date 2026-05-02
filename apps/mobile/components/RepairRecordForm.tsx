import {
  formatOdometer,
  repairRecordCategoryLabels,
  repairRecordCategoryValues,
  type RepairRecord,
  type RepairRecordCategory,
  type RepairRecordInput,
  type Vehicle,
} from "@autoledger/shared";
import { repairRecordSchema } from "@autoledger/validation";
import { zodResolver } from "@hookform/resolvers/zod";
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
  type FieldErrors,
  type Path,
  type Resolver,
} from "react-hook-form";

import { DatePickerField } from "./DatePickerField";

export type RepairRecordFormValues = {
  vehicle_id: string;
  repair_date: string;
  odometer_reading: string;
  title: string;
  category: RepairRecordCategory;
  description: string;
  vendor_name: string;
  cost_amount: string;
  cost_currency: string;
  warranty_until_date: string;
  warranty_until_odometer: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const fieldValue = (value: number | string | null | undefined) =>
  value === null || value === undefined ? "" : `${value}`;

export const defaultRepairRecordFormValues = (
  vehicle: Vehicle,
): RepairRecordFormValues => ({
  vehicle_id: vehicle.id,
  repair_date: today(),
  odometer_reading: `${vehicle.current_odometer}`,
  title: "",
  category: "diagnostic",
  description: "",
  vendor_name: "",
  cost_amount: "",
  cost_currency: "USD",
  warranty_until_date: "",
  warranty_until_odometer: "",
  notes: "",
});

export const repairRecordToFormValues = (
  record: RepairRecord,
): RepairRecordFormValues => ({
  vehicle_id: record.vehicle_id,
  repair_date: record.repair_date,
  odometer_reading: fieldValue(record.odometer_reading),
  title: record.title,
  category: record.category,
  description: fieldValue(record.description),
  vendor_name: fieldValue(record.vendor_name),
  cost_amount: fieldValue(record.cost_amount),
  cost_currency: record.cost_currency || "USD",
  warranty_until_date: fieldValue(record.warranty_until_date),
  warranty_until_odometer: fieldValue(record.warranty_until_odometer),
  notes: fieldValue(record.notes),
});

type RepairRecordFormProps = {
  defaultValues: RepairRecordFormValues;
  description: string;
  onSubmit: (input: RepairRecordInput) => Promise<void>;
  submitLabel: string;
  title: string;
  vehicle: Vehicle;
};

export function RepairRecordForm({
  defaultValues,
  description,
  onSubmit,
  submitLabel,
  title,
  vehicle,
}: RepairRecordFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
  } = useForm<RepairRecordFormValues>({
    defaultValues,
    resolver: zodResolver(
      repairRecordSchema,
    ) as unknown as Resolver<RepairRecordFormValues>,
  });

  const submitForm = handleSubmit(async (values) => {
    setSubmitError(null);
    const input = repairRecordSchema.parse(values);
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
            Repair
          </Text>
          <Text className="text-3xl font-extrabold text-ledger-ink">
            {title}
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            {description}
          </Text>
        </View>

        <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <Text className="text-sm font-bold uppercase text-ledger-muted">
            Vehicle
          </Text>
          <Text className="text-lg font-bold text-ledger-ink">
            {vehicle.nickname}
          </Text>
          <Text className="text-sm leading-5 text-ledger-muted">
            Current odometer:{" "}
            {formatOdometer(vehicle.current_odometer, vehicle.odometer_unit)}
          </Text>
        </View>

        <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <RepairTextField
            control={control}
            error={errors.title}
            label="Title"
            name="title"
            placeholder="Alternator replacement"
          />
          <SegmentedField
            control={control}
            errors={errors}
            label="Category"
            name="category"
            options={repairRecordCategoryValues.map((value) => ({
              label: repairRecordCategoryLabels[value],
              value,
            }))}
          />
          <DatePickerField
            control={control}
            error={errors.repair_date}
            label="Repair Date"
            name="repair_date"
            placeholder={today()}
          />
          <RepairTextField
            control={control}
            error={errors.odometer_reading}
            keyboardType="number-pad"
            label="Odometer Reading"
            name="odometer_reading"
            placeholder={`${vehicle.current_odometer}`}
          />
          <RepairTextField
            autoCapitalize="words"
            control={control}
            error={errors.vendor_name}
            label="Vendor / Shop"
            name="vendor_name"
            placeholder="Repair shop, dealer, or parts store"
          />
          <RepairTextField
            control={control}
            error={errors.cost_amount}
            keyboardType="decimal-pad"
            label="Cost"
            name="cost_amount"
            placeholder="425.00"
          />
          <View className="gap-2">
            <Text className="text-sm font-bold text-ledger-ink">Currency</Text>
            <View className="rounded-card border border-ledger-line bg-ledger-background px-3 py-3">
              <Text className="text-base font-semibold text-ledger-ink">
                USD
              </Text>
            </View>
          </View>
          <DatePickerField
            control={control}
            error={errors.warranty_until_date}
            label="Warranty Until Date"
            name="warranty_until_date"
            optional
            placeholder="Optional"
          />
          <RepairTextField
            control={control}
            error={errors.warranty_until_odometer}
            keyboardType="number-pad"
            label="Warranty Until Odometer"
            name="warranty_until_odometer"
            placeholder="Optional"
          />
          <RepairTextField
            control={control}
            error={errors.description}
            label="Description"
            multiline
            name="description"
            placeholder="Problem, diagnosis, work performed, or parts replaced"
          />
          <RepairTextField
            control={control}
            error={errors.notes}
            label="Notes"
            multiline
            name="notes"
            placeholder="Anything helpful to remember"
          />
        </View>

        <View className="gap-2 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <Text className="text-base font-bold text-ledger-ink">
            Attachments
          </Text>
          <Text className="text-sm leading-5 text-ledger-muted">
            After saving this repair record, you can add receipt photos or PDFs
            from the record detail screen.
          </Text>
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
            void submitForm().catch(() => {
              setSubmitError(
                "Unable to save this repair record. Please try again.",
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

type RepairTextFieldProps = {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  control: Control<RepairRecordFormValues>;
  error?: { message?: string };
  keyboardType?: "decimal-pad" | "default" | "number-pad";
  label: string;
  multiline?: boolean;
  name: Path<RepairRecordFormValues>;
  placeholder?: string;
};

function RepairTextField({
  autoCapitalize = "sentences",
  control,
  error,
  keyboardType = "default",
  label,
  multiline = false,
  name,
  placeholder,
}: RepairTextFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onBlur, onChange, value } }) => (
        <View className="gap-2">
          <Text className="text-sm font-bold text-ledger-ink">{label}</Text>
          <TextInput
            autoCapitalize={autoCapitalize}
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

type SegmentedFieldProps = {
  control: Control<RepairRecordFormValues>;
  errors: FieldErrors<RepairRecordFormValues>;
  label: string;
  name: "category";
  options: Array<{
    label: string;
    value: RepairRecordCategory;
  }>;
};

function SegmentedField({
  control,
  errors,
  label,
  name,
  options,
}: SegmentedFieldProps) {
  const error = errors[name];

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <View className="gap-2">
          <Text className="text-sm font-bold text-ledger-ink">{label}</Text>
          <View className="flex-row flex-wrap gap-2">
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <Pressable
                  accessibilityRole="button"
                  className={`rounded-card border px-3 py-2 ${
                    isSelected
                      ? "border-ledger-primary bg-ledger-primary"
                      : "border-ledger-line bg-ledger-background"
                  }`}
                  key={option.value}
                  onPress={() => onChange(option.value)}
                >
                  <Text
                    className={`text-sm font-bold ${
                      isSelected ? "text-white" : "text-ledger-ink"
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
