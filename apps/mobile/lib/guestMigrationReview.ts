import {
  countSyncedMigrationMappings,
  getAttachmentMigrationMappings,
  getGuestMigrationSummary,
  getLatestMigrationRunsByScopeForAccount,
  getMaintenanceReminderMigrationMappings,
  getOdometerMigrationMappings,
  getRepairRecordMigrationMappings,
  getServiceRecordMigrationMappings,
  getVehicleMigrationMappings,
  type GuestMigrationSummary,
  type LatestMigrationRunsByScope,
  type MigrationEntityMapping,
  type MigrationRun,
  type MigrationRunScope,
} from "./guestMigration";
import {
  migrateGuestAttachmentsToCloud,
  type GuestAttachmentMigrationResult,
} from "./guestAttachmentMigration";
import {
  migrateGuestMaintenanceRemindersToCloud,
  type GuestMaintenanceReminderMigrationResult,
} from "./guestMaintenanceReminderMigration";
import {
  migrateGuestOdometerEntriesToCloud,
  type GuestOdometerMigrationResult,
} from "./guestOdometerMigration";
import {
  migrateGuestRepairRecordsToCloud,
  type GuestRepairRecordMigrationResult,
} from "./guestRepairRecordMigration";
import {
  migrateGuestServiceRecordsToCloud,
  type GuestServiceRecordMigrationResult,
} from "./guestServiceRecordMigration";
import {
  migrateGuestVehiclesToCloud,
  type GuestVehicleMigrationResult,
} from "./guestVehicleMigration";

export const localDataRetentionMessage =
  "Your original local records remain on this device.";

export const migrationReviewStepOrder = [
  "vehicles",
  "odometer_entries",
  "service_records",
  "repair_records",
  "maintenance_reminders",
  "record_attachments",
] as const;

export type MigrationReviewStepKey = (typeof migrationReviewStepOrder)[number];

export type MigrationReviewStepStatus =
  | "blocked"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "in_progress"
  | "not_started"
  | "ready";

export type MigrationReviewOverallStatus =
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "not_started"
  | "partially_complete";

export type MigrationReviewMappingCounts = {
  failed: number;
  skipped: number;
  synced: number;
  total: number;
};

export type MigrationReviewStepSummary = {
  blockedReason: string | null;
  canRun: boolean;
  description: string;
  failedCount: number;
  key: MigrationReviewStepKey;
  latestRun: MigrationRun | null;
  localCount: number;
  migratedCount: number;
  prerequisite: string | null;
  skippedCount: number;
  status: MigrationReviewStepStatus;
  title: string;
};

export type MigrationReviewSummary = {
  completionMessage: string | null;
  guestSummary: GuestMigrationSummary;
  hasIssues: boolean;
  isComplete: boolean;
  localTotals: {
    supportedRecords: number;
  };
  mappingTotals: {
    failed: number;
    skipped: number;
    synced: number;
  };
  overallStatus: MigrationReviewOverallStatus;
  steps: MigrationReviewStepSummary[];
};

export type MigrationReviewBuildInput = {
  activeStepKey?: MigrationReviewStepKey | null;
  attachmentMappings: MigrationEntityMapping[];
  guestSummary: GuestMigrationSummary;
  latestRuns: LatestMigrationRunsByScope;
  maintenanceReminderMappings: MigrationEntityMapping[];
  odometerMappings: MigrationEntityMapping[];
  repairRecordMappings: MigrationEntityMapping[];
  serviceRecordMappings: MigrationEntityMapping[];
  vehicleMappings: MigrationEntityMapping[];
};

export type MigrationReviewStepRunResult = {
  alreadyPresentCount: number;
  issueCount: number;
  message: string;
  migratedCount: number;
  run: MigrationRun;
  status: MigrationRun["status"];
  stepKey: MigrationReviewStepKey;
};

export type MigrationReviewRemainingRunResult = {
  results: MigrationReviewStepRunResult[];
  summary: MigrationReviewSummary;
};

type MigrationResult =
  | GuestAttachmentMigrationResult
  | GuestMaintenanceReminderMigrationResult
  | GuestOdometerMigrationResult
  | GuestRepairRecordMigrationResult
  | GuestServiceRecordMigrationResult
  | GuestVehicleMigrationResult;

const stepCopy: Record<
  MigrationReviewStepKey,
  {
    description: string;
    prerequisite: string | null;
    title: string;
  }
> = {
  maintenance_reminders: {
    description:
      "Copies local reminders and keeps local notification IDs on this device.",
    prerequisite: "Requires migrated vehicle mappings.",
    title: "Maintenance reminders",
  },
  odometer_entries: {
    description: "Copies local odometer readings to the matching cloud vehicles.",
    prerequisite: "Requires migrated vehicle mappings.",
    title: "Odometer entries",
  },
  record_attachments: {
    description:
      "Uploads local service and repair files to private cloud storage after parent records are copied.",
    prerequisite: "Requires migrated service or repair record mappings.",
    title: "Attachments",
  },
  repair_records: {
    description: "Copies local repair records to the matching cloud vehicles.",
    prerequisite: "Requires migrated vehicle mappings.",
    title: "Repair records",
  },
  service_records: {
    description: "Copies local service records to the matching cloud vehicles.",
    prerequisite: "Requires migrated vehicle mappings.",
    title: "Service records",
  },
  vehicles: {
    description: "Copies active and archived local vehicles to your account.",
    prerequisite: null,
    title: "Vehicles",
  },
};

const scopeForStep = (
  stepKey: MigrationReviewStepKey,
): MigrationRunScope => stepKey;

const countMappings = (
  mappings: MigrationEntityMapping[],
): MigrationReviewMappingCounts => ({
  failed: mappings.filter((mapping) => mapping.status === "failed").length,
  skipped: mappings.filter((mapping) => mapping.status === "skipped").length,
  synced: countSyncedMigrationMappings(mappings),
  total: mappings.length,
});

const getLocalCount = (
  stepKey: MigrationReviewStepKey,
  guestSummary: GuestMigrationSummary,
) => {
  switch (stepKey) {
    case "vehicles":
      return guestSummary.counts.totalVehicles;
    case "odometer_entries":
      return guestSummary.counts.odometerEntries;
    case "service_records":
      return guestSummary.counts.serviceRecords;
    case "repair_records":
      return guestSummary.counts.repairRecords;
    case "maintenance_reminders":
      return guestSummary.counts.maintenanceReminders;
    case "record_attachments":
      return guestSummary.counts.attachments;
  }
};

const getBlockedReason = ({
  localCount,
  mappingCountsByStep,
  stepKey,
}: {
  localCount: number;
  mappingCountsByStep: Record<MigrationReviewStepKey, MigrationReviewMappingCounts>;
  stepKey: MigrationReviewStepKey;
}) => {
  if (localCount === 0 || stepKey === "vehicles") {
    return null;
  }

  const currentStepHasStoredOutcome =
    mappingCountsByStep[stepKey].synced +
      mappingCountsByStep[stepKey].failed +
      mappingCountsByStep[stepKey].skipped >
    0;

  if (currentStepHasStoredOutcome) {
    return null;
  }

  if (
    stepKey === "record_attachments" &&
    mappingCountsByStep.service_records.synced +
      mappingCountsByStep.repair_records.synced ===
      0
  ) {
    return "Copy service or repair records before migrating attachments.";
  }

  if (
    stepKey !== "record_attachments" &&
    mappingCountsByStep.vehicles.synced === 0
  ) {
    return "Copy vehicles before migrating this step.";
  }

  return null;
};

const getStepStatus = ({
  activeStepKey,
  blockedReason,
  latestRun,
  localCount,
  mappingCounts,
  stepKey,
}: {
  activeStepKey?: MigrationReviewStepKey | null;
  blockedReason: string | null;
  latestRun: MigrationRun | null;
  localCount: number;
  mappingCounts: MigrationReviewMappingCounts;
  stepKey: MigrationReviewStepKey;
}): MigrationReviewStepStatus => {
  if (activeStepKey === stepKey) {
    return "in_progress";
  }

  if (localCount === 0) {
    return "completed";
  }

  if (blockedReason) {
    return "blocked";
  }

  if (latestRun?.status === "running" || latestRun?.status === "pending") {
    return "in_progress";
  }

  const issueCount = mappingCounts.failed + mappingCounts.skipped;

  if (mappingCounts.synced >= localCount && issueCount === 0) {
    return "completed";
  }

  if (mappingCounts.synced > 0 && issueCount > 0) {
    return "completed_with_errors";
  }

  if (mappingCounts.synced === 0 && issueCount > 0) {
    return "failed";
  }

  if (latestRun?.status === "failed") {
    return "failed";
  }

  if (latestRun?.status === "completed_with_errors") {
    return "completed_with_errors";
  }

  if (mappingCounts.synced > 0 && mappingCounts.synced < localCount) {
    return "ready";
  }

  return latestRun ? "ready" : "not_started";
};

const canRunStep = (status: MigrationReviewStepStatus, localCount: number) =>
  localCount > 0 &&
  (status === "ready" ||
    status === "not_started" ||
    status === "failed" ||
    status === "completed_with_errors");

const getOverallStatus = ({
  issueCount,
  steps,
  syncedCount,
  totalLocalCount,
}: {
  issueCount: number;
  steps: MigrationReviewStepSummary[];
  syncedCount: number;
  totalLocalCount: number;
}): MigrationReviewOverallStatus => {
  if (totalLocalCount === 0 || syncedCount === 0) {
    return issueCount > 0 ? "failed" : "not_started";
  }

  if (steps.every((step) => step.status === "completed")) {
    return "completed";
  }

  if (issueCount > 0) {
    return syncedCount > 0 ? "completed_with_errors" : "failed";
  }

  return "partially_complete";
};

export const buildMigrationReviewSummary = ({
  activeStepKey = null,
  attachmentMappings,
  guestSummary,
  latestRuns,
  maintenanceReminderMappings,
  odometerMappings,
  repairRecordMappings,
  serviceRecordMappings,
  vehicleMappings,
}: MigrationReviewBuildInput): MigrationReviewSummary => {
  const mappingsByStep: Record<MigrationReviewStepKey, MigrationEntityMapping[]> =
    {
      maintenance_reminders: maintenanceReminderMappings,
      odometer_entries: odometerMappings,
      record_attachments: attachmentMappings,
      repair_records: repairRecordMappings,
      service_records: serviceRecordMappings,
      vehicles: vehicleMappings,
    };
  const mappingCountsByStep = Object.fromEntries(
    migrationReviewStepOrder.map((stepKey) => [
      stepKey,
      countMappings(mappingsByStep[stepKey]),
    ]),
  ) as Record<MigrationReviewStepKey, MigrationReviewMappingCounts>;

  const steps = migrationReviewStepOrder.map((stepKey) => {
    const localCount = getLocalCount(stepKey, guestSummary);
    const mappingCounts = mappingCountsByStep[stepKey];
    const blockedReason = getBlockedReason({
      localCount,
      mappingCountsByStep,
      stepKey,
    });
    const latestRun = latestRuns[scopeForStep(stepKey)];
    const status = getStepStatus({
      activeStepKey,
      blockedReason,
      latestRun,
      localCount,
      mappingCounts,
      stepKey,
    });

    return {
      blockedReason,
      canRun: canRunStep(status, localCount),
      description: stepCopy[stepKey].description,
      failedCount: mappingCounts.failed,
      key: stepKey,
      latestRun,
      localCount,
      migratedCount: mappingCounts.synced,
      prerequisite: stepCopy[stepKey].prerequisite,
      skippedCount: mappingCounts.skipped,
      status,
      title: stepCopy[stepKey].title,
    };
  });
  const totalLocalCount = steps.reduce((sum, step) => sum + step.localCount, 0);
  const syncedCount = steps.reduce((sum, step) => sum + step.migratedCount, 0);
  const skippedCount = steps.reduce((sum, step) => sum + step.skippedCount, 0);
  const failedCount = steps.reduce((sum, step) => sum + step.failedCount, 0);
  const issueCount = failedCount + skippedCount;
  const overallStatus = getOverallStatus({
    issueCount,
    steps,
    syncedCount,
    totalLocalCount,
  });
  const isComplete = overallStatus === "completed";

  return {
    completionMessage: isComplete
      ? `Your supported local records have been copied to your account. ${localDataRetentionMessage}`
      : null,
    guestSummary,
    hasIssues: issueCount > 0,
    isComplete,
    localTotals: {
      supportedRecords: totalLocalCount,
    },
    mappingTotals: {
      failed: failedCount,
      skipped: skippedCount,
      synced: syncedCount,
    },
    overallStatus,
    steps,
  };
};

export const getGuestMigrationReviewSummary = async ({
  accountId,
  activeStepKey = null,
}: {
  accountId: string;
  activeStepKey?: MigrationReviewStepKey | null;
}): Promise<MigrationReviewSummary> => {
  const [
    guestSummary,
    latestRuns,
    vehicleMappings,
    odometerMappings,
    serviceRecordMappings,
    repairRecordMappings,
    maintenanceReminderMappings,
    attachmentMappings,
  ] = await Promise.all([
    getGuestMigrationSummary(accountId),
    getLatestMigrationRunsByScopeForAccount(accountId),
    getVehicleMigrationMappings(accountId),
    getOdometerMigrationMappings(accountId),
    getServiceRecordMigrationMappings(accountId),
    getRepairRecordMigrationMappings(accountId),
    getMaintenanceReminderMigrationMappings(accountId),
    getAttachmentMigrationMappings(accountId),
  ]);

  return buildMigrationReviewSummary({
    activeStepKey,
    attachmentMappings,
    guestSummary,
    latestRuns,
    maintenanceReminderMappings,
    odometerMappings,
    repairRecordMappings,
    serviceRecordMappings,
    vehicleMappings,
  });
};

const normalizeRunResult = (
  stepKey: MigrationReviewStepKey,
  result: MigrationResult,
): MigrationReviewStepRunResult => {
  let alreadyPresentCount = 0;
  let issueCount = result.failedCount;
  let migratedCount = result.migratedCount;

  if ("skippedCount" in result) {
    alreadyPresentCount = result.skippedCount;
  }

  if ("skippedMissingVehicleMappingCount" in result) {
    issueCount += result.skippedMissingVehicleMappingCount;
  }

  if ("skippedAlreadyMigratedCount" in result) {
    alreadyPresentCount = result.skippedAlreadyMigratedCount;
    issueCount +=
      result.skippedMissingParentMappingCount + result.skippedUnsupportedCount;
    migratedCount = result.migratedCount;
  }

  const message =
    issueCount > 0
      ? `${stepCopy[stepKey].title} finished with ${issueCount} item${issueCount === 1 ? "" : "s"} needing attention. ${localDataRetentionMessage}`
      : `${stepCopy[stepKey].title} finished. ${localDataRetentionMessage}`;

  return {
    alreadyPresentCount,
    issueCount,
    message,
    migratedCount,
    run: result.run,
    status: result.run.status,
    stepKey,
  };
};

export const runGuestMigrationReviewStep = async ({
  accountId,
  stepKey,
}: {
  accountId: string;
  stepKey: MigrationReviewStepKey;
}): Promise<MigrationReviewStepRunResult> => {
  switch (stepKey) {
    case "vehicles":
      return normalizeRunResult(
        stepKey,
        await migrateGuestVehiclesToCloud(accountId),
      );
    case "odometer_entries":
      return normalizeRunResult(
        stepKey,
        await migrateGuestOdometerEntriesToCloud(accountId),
      );
    case "service_records":
      return normalizeRunResult(
        stepKey,
        await migrateGuestServiceRecordsToCloud(accountId),
      );
    case "repair_records":
      return normalizeRunResult(
        stepKey,
        await migrateGuestRepairRecordsToCloud(accountId),
      );
    case "maintenance_reminders":
      return normalizeRunResult(
        stepKey,
        await migrateGuestMaintenanceRemindersToCloud(accountId),
      );
    case "record_attachments":
      return normalizeRunResult(
        stepKey,
        await migrateGuestAttachmentsToCloud(accountId),
      );
  }
};

export const runRemainingGuestMigrationSteps = async ({
  accountId,
  onStepStart,
}: {
  accountId: string;
  onStepStart?: (stepKey: MigrationReviewStepKey) => void;
}): Promise<MigrationReviewRemainingRunResult> => {
  const results: MigrationReviewStepRunResult[] = [];
  let summary = await getGuestMigrationReviewSummary({ accountId });

  for (const stepKey of migrationReviewStepOrder) {
    const step = summary.steps.find((item) => item.key === stepKey);

    if (!step?.canRun) {
      continue;
    }

    onStepStart?.(stepKey);
    results.push(await runGuestMigrationReviewStep({ accountId, stepKey }));
    summary = await getGuestMigrationReviewSummary({ accountId });
  }

  return {
    results,
    summary,
  };
};
