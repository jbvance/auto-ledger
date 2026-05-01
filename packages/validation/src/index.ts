import { odometerUnitValues, vehicleTypeValues } from "@autoledger/shared";
import { z } from "zod";

const currentYear = new Date().getFullYear();

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
    .optional(),
);

const optionalNonNegativeIntegerSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().int().min(0).optional(),
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
