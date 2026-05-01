import {
  maintenanceReminderCategoryValues,
  maintenanceReminderTypeValues,
  odometerSourceTypeValues,
  odometerUnitValues,
  repairRecordCategoryValues,
  serviceRecordCategoryValues,
  vehicleTypeValues,
} from "@autoledger/shared";
import { z } from "zod";

const currentYear = new Date().getFullYear();

const isValidDateString = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return false;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const optionalTextSchema = (maxLength: number) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).max(maxLength).optional(),
  );

const optionalDateSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.")
    .refine(isValidDateString, {
      message: "Enter a valid date.",
    })
    .optional(),
);

const requiredDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.")
  .refine(isValidDateString, {
    message: "Enter a valid date.",
  });

const optionalNonNegativeIntegerSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().int().min(0).optional(),
);

const optionalNonNegativeNumberSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().min(0).optional(),
);

export const vehicleSchema = z
  .object({
    nickname: z.string().trim().min(1, "Nickname is required.").max(80),
    make: z.string().trim().min(1, "Make is required.").max(80),
    model: z.string().trim().min(1, "Model is required.").max(80),
    year: z.coerce
      .number()
      .int()
      .min(1886, "Enter a valid model year.")
      .max(currentYear + 1, "Enter a valid model year."),
    trim: optionalTextSchema(80),
    vin: optionalTextSchema(17),
    license_plate: optionalTextSchema(20),
    license_state: optionalTextSchema(32),
    color: optionalTextSchema(40),
    vehicle_type: z.enum(vehicleTypeValues),
    current_odometer: z.coerce.number().int().min(0),
    odometer_unit: z.enum(odometerUnitValues),
    purchase_date: optionalDateSchema,
    purchase_odometer: optionalNonNegativeIntegerSchema,
    notes: optionalTextSchema(1000),
  })
  .refine(
    (value) =>
      value.purchase_odometer === undefined ||
      value.purchase_odometer <= value.current_odometer,
    {
      message: "Purchase odometer cannot exceed current odometer.",
      path: ["purchase_odometer"],
    },
  );

export type VehicleFormValues = z.input<typeof vehicleSchema>;
export type VehicleValidatedInput = z.output<typeof vehicleSchema>;

export const odometerEntrySchema = z.object({
  vehicle_id: z.string().trim().min(1, "Vehicle is required."),
  reading: z.coerce.number().int().min(0, "Reading must be non-negative."),
  reading_date: requiredDateSchema,
  odometer_unit: z.enum(odometerUnitValues),
  source_type: z.enum(odometerSourceTypeValues),
  notes: optionalTextSchema(1000),
});

export type OdometerEntryFormValues = z.input<typeof odometerEntrySchema>;
export type OdometerEntryValidatedInput = z.output<typeof odometerEntrySchema>;

export const serviceRecordSchema = z.object({
  vehicle_id: z.string().trim().min(1, "Vehicle is required."),
  service_date: requiredDateSchema,
  odometer_reading: optionalNonNegativeIntegerSchema,
  title: z.string().trim().min(1, "Title is required.").max(120),
  category: z.enum(serviceRecordCategoryValues),
  description: optionalTextSchema(2000),
  vendor_name: optionalTextSchema(120),
  cost_amount: optionalNonNegativeNumberSchema,
  cost_currency: z.preprocess(
    (value) => (value === "" || value === undefined ? "USD" : value),
    z.string().trim().length(3).default("USD"),
  ),
  notes: optionalTextSchema(1000),
});

export type ServiceRecordFormValues = z.input<typeof serviceRecordSchema>;
export type ServiceRecordValidatedInput = z.output<typeof serviceRecordSchema>;

export const repairRecordSchema = z.object({
  vehicle_id: z.string().trim().min(1, "Vehicle is required."),
  repair_date: requiredDateSchema,
  odometer_reading: optionalNonNegativeIntegerSchema,
  title: z.string().trim().min(1, "Title is required.").max(120),
  category: z.enum(repairRecordCategoryValues),
  description: optionalTextSchema(2000),
  vendor_name: optionalTextSchema(120),
  cost_amount: optionalNonNegativeNumberSchema,
  cost_currency: z.preprocess(
    (value) => (value === "" || value === undefined ? "USD" : value),
    z.string().trim().length(3).default("USD"),
  ),
  warranty_until_date: optionalDateSchema,
  warranty_until_odometer: optionalNonNegativeIntegerSchema,
  notes: optionalTextSchema(1000),
});

export type RepairRecordFormValues = z.input<typeof repairRecordSchema>;
export type RepairRecordValidatedInput = z.output<typeof repairRecordSchema>;

export const maintenanceReminderSchema = z
  .object({
    vehicle_id: z.string().trim().min(1, "Vehicle is required."),
    title: z.string().trim().min(1, "Title is required.").max(120),
    category: z.enum(maintenanceReminderCategoryValues),
    reminder_type: z.enum(maintenanceReminderTypeValues),
    due_date: optionalDateSchema,
    due_odometer: optionalNonNegativeIntegerSchema,
    repeat_interval_months: optionalNonNegativeIntegerSchema,
    repeat_interval_miles: optionalNonNegativeIntegerSchema,
    notes: optionalTextSchema(1000),
  })
  .superRefine((value, context) => {
    if (value.reminder_type === "date" && !value.due_date) {
      context.addIssue({
        code: "custom",
        message: "Due date is required for date reminders.",
        path: ["due_date"],
      });
    }

    if (value.reminder_type === "mileage" && value.due_odometer === undefined) {
      context.addIssue({
        code: "custom",
        message: "Due odometer is required for mileage reminders.",
        path: ["due_odometer"],
      });
    }

    if (
      value.reminder_type === "date_or_mileage" &&
      !value.due_date &&
      value.due_odometer === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Add a due date, due odometer, or both.",
        path: ["due_date"],
      });
      context.addIssue({
        code: "custom",
        message: "Add a due date, due odometer, or both.",
        path: ["due_odometer"],
      });
    }
  });

export type MaintenanceReminderFormValues = z.input<
  typeof maintenanceReminderSchema
>;
export type MaintenanceReminderValidatedInput = z.output<
  typeof maintenanceReminderSchema
>;

export const optionalUrlSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);

export const optionalSecretSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

export const publicSupabaseEnvSchema = z.object({
  url: optionalUrlSchema,
  anonKey: optionalSecretSchema,
});

export type PublicSupabaseEnv = z.infer<typeof publicSupabaseEnvSchema>;
