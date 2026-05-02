import {
  formatOdometer,
  maintenanceReminderCategoryLabels,
  maintenanceReminderCategoryValues,
  maintenanceReminderTypeLabels,
  maintenanceReminderTypeValues,
  type MaintenanceReminder,
  type MaintenanceReminderCategory,
  type MaintenanceReminderInput,
  type MaintenanceReminderType,
  type Vehicle,
} from "@autoledger/shared";
import { maintenanceReminderSchema } from "@autoledger/validation";
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

export type MaintenanceReminderFormValues = {
  vehicle_id: string;
  title: string;
  category: MaintenanceReminderCategory;
  reminder_type: MaintenanceReminderType;
  due_date: string;
  due_odometer: string;
  repeat_interval_months: string;
  repeat_interval_miles: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const fieldValue = (value: number | string | null | undefined) =>
  value === null || value === undefined ? "" : `${value}`;

export const defaultMaintenanceReminderFormValues = (
  vehicle: Vehicle,
): MaintenanceReminderFormValues => ({
  vehicle_id: vehicle.id,
  title: "",
  category: "oil_change",
  reminder_type: "date_or_mileage",
  due_date: "",
  due_odometer: "",
  repeat_interval_months: "",
  repeat_interval_miles: "",
  notes: "",
});

export const maintenanceReminderToFormValues = (
  reminder: MaintenanceReminder,
): MaintenanceReminderFormValues => ({
  vehicle_id: reminder.vehicle_id,
  title: reminder.title,
  category: reminder.category,
  reminder_type: reminder.reminder_type,
  due_date: fieldValue(reminder.due_date),
  due_odometer: fieldValue(reminder.due_odometer),
  repeat_interval_months: fieldValue(reminder.repeat_interval_months),
  repeat_interval_miles: fieldValue(reminder.repeat_interval_miles),
  notes: fieldValue(reminder.notes),
});

type MaintenanceReminderFormProps = {
  defaultValues: MaintenanceReminderFormValues;
  description: string;
  onSubmit: (input: MaintenanceReminderInput) => Promise<void>;
  submitLabel: string;
  title: string;
  vehicle: Vehicle;
};

export function MaintenanceReminderForm({
  defaultValues,
  description,
  onSubmit,
  submitLabel,
  title,
  vehicle,
}: MaintenanceReminderFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    watch,
  } = useForm<MaintenanceReminderFormValues>({
    defaultValues,
    resolver: zodResolver(
      maintenanceReminderSchema,
    ) as unknown as Resolver<MaintenanceReminderFormValues>,
  });
  const reminderType = watch("reminder_type");

  const submitForm = handleSubmit(async (values) => {
    setSubmitError(null);
    const input = maintenanceReminderSchema.parse(values);
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
            Reminder
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
          <ReminderTextField
            control={control}
            error={errors.title}
            label="Title"
            name="title"
            placeholder="Oil change"
          />
          <SegmentedField
            control={control}
            errors={errors}
            label="Category"
            name="category"
            options={maintenanceReminderCategoryValues.map((value) => ({
              label: maintenanceReminderCategoryLabels[value],
              value,
            }))}
          />
          <SegmentedField
            control={control}
            errors={errors}
            label="Reminder Type"
            name="reminder_type"
            options={maintenanceReminderTypeValues.map((value) => ({
              label: maintenanceReminderTypeLabels[value],
              value,
            }))}
          />
          {reminderType === "mileage" ? null : (
            <DatePickerField
              control={control}
              error={errors.due_date}
              label="Due Date"
              name="due_date"
              optional
              placeholder={today()}
            />
          )}
          {reminderType === "date" ? null : (
            <ReminderTextField
              control={control}
              error={errors.due_odometer}
              keyboardType="number-pad"
              label="Due Odometer"
              name="due_odometer"
              placeholder={`${vehicle.current_odometer + 5000}`}
            />
          )}
          <ReminderTextField
            control={control}
            error={errors.repeat_interval_months}
            keyboardType="number-pad"
            label="Repeat Every Months"
            name="repeat_interval_months"
            placeholder="Optional"
          />
          <ReminderTextField
            control={control}
            error={errors.repeat_interval_miles}
            keyboardType="number-pad"
            label={`Repeat Every ${vehicle.odometer_unit}`}
            name="repeat_interval_miles"
            placeholder="Optional"
          />
          <ReminderTextField
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
            Notifications
          </Text>
          <Text className="text-sm leading-5 text-ledger-muted">
            Local device notifications are optional. Date-based reminders can
            notify before the due date when reminder notifications are enabled
            in Settings.
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
              setSubmitError("Unable to save this reminder. Please try again.");
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

type ReminderTextFieldProps = {
  control: Control<MaintenanceReminderFormValues>;
  error?: { message?: string };
  keyboardType?: "default" | "number-pad";
  label: string;
  multiline?: boolean;
  name: Path<MaintenanceReminderFormValues>;
  placeholder?: string;
};

function ReminderTextField({
  control,
  error,
  keyboardType = "default",
  label,
  multiline = false,
  name,
  placeholder,
}: ReminderTextFieldProps) {
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

type SegmentedFieldProps = {
  control: Control<MaintenanceReminderFormValues>;
  errors: FieldErrors<MaintenanceReminderFormValues>;
  label: string;
  name: "category" | "reminder_type";
  options: Array<{
    label: string;
    value: MaintenanceReminderCategory | MaintenanceReminderType;
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
