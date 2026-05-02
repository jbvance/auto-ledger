import {
  odometerUnitLabels,
  odometerUnitValues,
  vehicleTypeLabels,
  vehicleTypeValues,
  type OdometerUnit,
  type Vehicle,
  type VehicleInput,
  type VehicleType,
} from "@autoledger/shared";
import { vehicleSchema } from "@autoledger/validation";
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

export type VehicleFormValues = {
  nickname: string;
  make: string;
  model: string;
  year: string;
  trim: string;
  vin: string;
  license_plate: string;
  license_state: string;
  color: string;
  vehicle_type: VehicleType;
  current_odometer: string;
  odometer_unit: OdometerUnit;
  purchase_date: string;
  purchase_odometer: string;
  notes: string;
};

export const emptyVehicleFormValues: VehicleFormValues = {
  nickname: "",
  make: "",
  model: "",
  year: "",
  trim: "",
  vin: "",
  license_plate: "",
  license_state: "",
  color: "",
  vehicle_type: "car",
  current_odometer: "",
  odometer_unit: "mi",
  purchase_date: "",
  purchase_odometer: "",
  notes: "",
};

const fieldValue = (value: number | string | null | undefined) =>
  value === null || value === undefined ? "" : `${value}`;

export const vehicleToFormValues = (vehicle: Vehicle): VehicleFormValues => ({
  nickname: vehicle.nickname,
  make: vehicle.make,
  model: vehicle.model,
  year: `${vehicle.year}`,
  trim: fieldValue(vehicle.trim),
  vin: fieldValue(vehicle.vin),
  license_plate: fieldValue(vehicle.license_plate),
  license_state: fieldValue(vehicle.license_state),
  color: fieldValue(vehicle.color),
  vehicle_type: vehicle.vehicle_type,
  current_odometer: `${vehicle.current_odometer}`,
  odometer_unit: vehicle.odometer_unit,
  purchase_date: fieldValue(vehicle.purchase_date),
  purchase_odometer: fieldValue(vehicle.purchase_odometer),
  notes: fieldValue(vehicle.notes),
});

type VehicleFormProps = {
  defaultValues: VehicleFormValues;
  description: string;
  eyebrow: string;
  onSubmit: (input: VehicleInput) => Promise<void>;
  submitLabel: string;
  title: string;
};

export function VehicleForm({
  defaultValues,
  description,
  eyebrow,
  onSubmit,
  submitLabel,
  title,
}: VehicleFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
  } = useForm<VehicleFormValues>({
    defaultValues,
    resolver: zodResolver(
      vehicleSchema,
    ) as unknown as Resolver<VehicleFormValues>,
  });

  const submitForm = handleSubmit(async (values) => {
    setSubmitError(null);
    const input = vehicleSchema.parse(values);
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
            {eyebrow}
          </Text>
          <Text className="text-3xl font-extrabold text-ledger-ink">
            {title}
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            {description}
          </Text>
        </View>

        <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <VehicleTextField
            control={control}
            error={errors.nickname}
            label="Nickname"
            name="nickname"
            placeholder="Family SUV"
          />
          <VehicleTextField
            autoCapitalize="words"
            control={control}
            error={errors.make}
            label="Make"
            name="make"
            placeholder="Toyota"
          />
          <VehicleTextField
            autoCapitalize="words"
            control={control}
            error={errors.model}
            label="Model"
            name="model"
            placeholder="RAV4"
          />
          <VehicleTextField
            control={control}
            error={errors.year}
            keyboardType="number-pad"
            label="Year"
            name="year"
            placeholder="2022"
          />
          <VehicleTextField
            autoCapitalize="words"
            control={control}
            error={errors.trim}
            label="Trim"
            name="trim"
            placeholder="XLE"
          />
          <VehicleTextField
            autoCapitalize="characters"
            control={control}
            error={errors.vin}
            label="VIN"
            name="vin"
            placeholder="Optional"
          />
          <VehicleTextField
            autoCapitalize="characters"
            control={control}
            error={errors.license_plate}
            label="License Plate"
            name="license_plate"
            placeholder="Optional"
          />
          <VehicleTextField
            autoCapitalize="characters"
            control={control}
            error={errors.license_state}
            label="License State"
            name="license_state"
            placeholder="TX"
          />
          <VehicleTextField
            autoCapitalize="words"
            control={control}
            error={errors.color}
            label="Color"
            name="color"
            placeholder="Silver"
          />
        </View>

        <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-4">
          <SegmentedField
            control={control}
            errors={errors}
            label="Vehicle Type"
            name="vehicle_type"
            options={vehicleTypeValues.map((value) => ({
              label: vehicleTypeLabels[value],
              value,
            }))}
          />
          <VehicleTextField
            control={control}
            error={errors.current_odometer}
            keyboardType="number-pad"
            label="Current Odometer"
            name="current_odometer"
            placeholder="42500"
          />
          <SegmentedField
            control={control}
            errors={errors}
            label="Odometer Unit"
            name="odometer_unit"
            options={odometerUnitValues.map((value) => ({
              label: odometerUnitLabels[value],
              value,
            }))}
          />
          <VehicleTextField
            control={control}
            error={errors.purchase_date}
            label="Purchase Date"
            name="purchase_date"
            placeholder="YYYY-MM-DD"
          />
          <VehicleTextField
            control={control}
            error={errors.purchase_odometer}
            keyboardType="number-pad"
            label="Purchase Odometer"
            name="purchase_odometer"
            placeholder="Optional"
          />
          <VehicleTextField
            control={control}
            error={errors.notes}
            label="Notes"
            multiline
            name="notes"
            placeholder="Anything helpful to remember"
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
            void submitForm().catch(() => {
              setSubmitError("Unable to save this vehicle. Please try again.");
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

type VehicleTextFieldProps = {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  control: Control<VehicleFormValues>;
  error?: { message?: string };
  keyboardType?: "default" | "number-pad";
  label: string;
  multiline?: boolean;
  name: Path<VehicleFormValues>;
  placeholder?: string;
};

function VehicleTextField({
  autoCapitalize = "sentences",
  control,
  error,
  keyboardType = "default",
  label,
  multiline = false,
  name,
  placeholder,
}: VehicleTextFieldProps) {
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
  control: Control<VehicleFormValues>;
  errors: FieldErrors<VehicleFormValues>;
  label: string;
  name: "vehicle_type" | "odometer_unit";
  options: Array<{
    label: string;
    value:
      | VehicleFormValues["vehicle_type"]
      | VehicleFormValues["odometer_unit"];
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
