import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth";
import {
  getGuestMigrationReviewSummary,
  localDataRetentionMessage,
  runGuestMigrationReviewStep,
  runRemainingGuestMigrationSteps,
  type MigrationReviewOverallStatus,
  type MigrationReviewStepKey,
  type MigrationReviewStepRunResult,
  type MigrationReviewStepStatus,
  type MigrationReviewStepSummary,
  type MigrationReviewSummary,
} from "../../lib/guestMigrationReview";

const statusLabels: Record<MigrationReviewStepStatus, string> = {
  blocked: "Blocked",
  completed: "Completed",
  completed_with_errors: "Completed with issues",
  failed: "Failed",
  in_progress: "In progress",
  not_started: "Not started",
  ready: "Ready",
};

const overallStatusLabels: Record<MigrationReviewOverallStatus, string> = {
  completed: "Complete",
  completed_with_errors: "Completed with issues",
  failed: "Needs attention",
  not_started: "Not started",
  partially_complete: "Partially complete",
};

const statusContainerClasses: Record<MigrationReviewStepStatus, string> = {
  blocked: "border-ledger-line bg-ledger-background",
  completed: "border-emerald-200 bg-emerald-50",
  completed_with_errors: "border-amber-200 bg-amber-50",
  failed: "border-red-200 bg-red-50",
  in_progress: "border-blue-200 bg-blue-50",
  not_started: "border-ledger-line bg-ledger-background",
  ready: "border-ledger-primary bg-ledger-background",
};

const statusTextClasses: Record<MigrationReviewStepStatus, string> = {
  blocked: "text-ledger-muted",
  completed: "text-emerald-800",
  completed_with_errors: "text-amber-800",
  failed: "text-red-700",
  in_progress: "text-blue-800",
  not_started: "text-ledger-muted",
  ready: "text-ledger-primary",
};

export default function MigrationScreen() {
  const { isConfigured, isLoading: isAuthLoading, user } = useAuth();
  const [activeStepKey, setActiveStepKey] =
    useState<MigrationReviewStepKey | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningRemaining, setIsRunningRemaining] = useState(false);
  const [lastRunResults, setLastRunResults] = useState<
    MigrationReviewStepRunResult[]
  >([]);
  const [review, setReview] = useState<MigrationReviewSummary | null>(null);

  const loadReview = useCallback(async () => {
    if (!user) {
      setReview(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      setReview(
        await getGuestMigrationReviewSummary({
          accountId: user.id,
          activeStepKey,
        }),
      );
    } catch (error: unknown) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Unable to load migration status.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeStepKey, user]);

  useFocusEffect(
    useCallback(() => {
      void loadReview();
    }, [loadReview]),
  );

  const runStep = async (stepKey: MigrationReviewStepKey) => {
    if (!user) {
      return;
    }

    setFeedback(null);
    setActiveStepKey(stepKey);

    try {
      const result = await runGuestMigrationReviewStep({
        accountId: user.id,
        stepKey,
      });

      setLastRunResults([result]);
      setFeedback(result.message);
    } catch (error: unknown) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Migration could not finish. Your local data was not changed.",
      );
    } finally {
      setActiveStepKey(null);
      await loadReview();
    }
  };

  const runRemaining = async () => {
    if (!user) {
      return;
    }

    setFeedback(null);
    setIsRunningRemaining(true);
    setLastRunResults([]);

    try {
      const result = await runRemainingGuestMigrationSteps({
        accountId: user.id,
        onStepStart: setActiveStepKey,
      });

      setReview(result.summary);
      setLastRunResults(result.results);
      setFeedback(
        result.results.length === 0
          ? "There are no ready migration steps to run right now."
          : `Migration steps finished. Review each step below for any items needing attention. ${localDataRetentionMessage}`,
      );
    } catch (error: unknown) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Migration could not finish. Your local data was not changed.",
      );
    } finally {
      setActiveStepKey(null);
      setIsRunningRemaining(false);
      await loadReview();
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-ledger-background">
        <ActivityIndicator />
        <Text className="mt-3 text-sm text-ledger-muted">
          Loading migration status...
        </Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-ledger-background">
        <ScrollView contentContainerClassName="gap-5 px-6 py-6">
          <Header />
          <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
            <Text className="text-lg font-bold text-ledger-ink">
              Sign in to move local data
            </Text>
            <Text className="text-sm leading-5 text-ledger-muted">
              Guest mode stays available without an account. Migration is
              optional and only copies supported local records after you sign
              in.
            </Text>
            <Pressable
              accessibilityRole="button"
              className={`rounded-card px-4 py-3 ${
                isConfigured ? "bg-ledger-primary" : "bg-ledger-primary opacity-60"
              }`}
              disabled={!isConfigured}
              onPress={() => router.push("/auth/sign-in" as Href)}
            >
              <Text className="text-center text-base font-bold text-white">
                Sign In
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const readySteps = review?.steps.filter((step) => step.canRun) ?? [];
  const isBusy = Boolean(activeStepKey) || isRunningRemaining;

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        <Header />

        {review ? (
          <>
            <OverviewCard review={review} />

            <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
              <View className="gap-1">
                <Text className="text-lg font-bold text-ledger-ink">
                  Migration Steps
                </Text>
                <Text className="text-sm leading-5 text-ledger-muted">
                  Run steps in order. Child records need vehicle mappings, and
                  attachments need service or repair parent mappings.
                </Text>
              </View>

              {review.steps.map((step, index) => (
                <StepCard
                  index={index + 1}
                  isActive={activeStepKey === step.key}
                  isBusy={isBusy}
                  key={step.key}
                  onRun={() => {
                    void runStep(step.key);
                  }}
                  step={step}
                />
              ))}
            </View>

            <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
              <Text className="text-lg font-bold text-ledger-ink">
                Run Remaining Steps
              </Text>
              <Text className="text-sm leading-5 text-ledger-muted">
                This runs ready steps in the recommended order and skips blocked
                steps. Individual step results remain visible below.
              </Text>
              <Pressable
                accessibilityRole="button"
                className={`rounded-card px-4 py-3 ${
                  readySteps.length === 0 || isBusy
                    ? "bg-ledger-primary opacity-60"
                    : "bg-ledger-primary"
                }`}
                disabled={readySteps.length === 0 || isBusy}
                onPress={() => {
                  void runRemaining();
                }}
              >
                <Text className="text-center text-base font-bold text-white">
                  {isRunningRemaining
                    ? "Migrating remaining data..."
                    : "Migrate Remaining Data"}
                </Text>
              </Pressable>
            </View>

            {feedback ? (
              <View className="rounded-card border border-ledger-line bg-ledger-surface p-4">
                <Text className="text-sm leading-5 text-ledger-muted">
                  {feedback}
                </Text>
              </View>
            ) : null}

            {lastRunResults.length > 0 ? (
              <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
                <Text className="text-lg font-bold text-ledger-ink">
                  Latest Results
                </Text>
                {lastRunResults.map((result) => (
                  <View
                    className="rounded-card border border-ledger-line bg-ledger-background p-3"
                    key={`${result.stepKey}-${result.run.id}`}
                  >
                    <Text className="text-sm font-bold text-ledger-ink">
                      {titleForStep(result.stepKey)}
                    </Text>
                    <Text className="mt-1 text-sm leading-5 text-ledger-muted">
                      {result.migratedCount} copied,{" "}
                      {result.alreadyPresentCount} already present,{" "}
                      {result.issueCount} need attention.
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="gap-2 rounded-card border border-ledger-line bg-ledger-surface p-4">
              <Text className="text-base font-bold text-ledger-ink">
                Local Data Stays Put
              </Text>
              <Text className="text-sm leading-5 text-ledger-muted">
                Migration copies supported records to your account. It does not
                delete guest records, remove local files, replace local data, or
                turn on continuous sync. Local cleanup will be a separate future
                choice.
              </Text>
            </View>
          </>
        ) : (
          <View className="rounded-card border border-ledger-line bg-ledger-surface p-4">
            <Text className="text-sm leading-5 text-ledger-muted">
              Migration status is unavailable right now.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View className="gap-2 pt-4">
      <Text className="text-sm font-bold uppercase text-ledger-primary">
        Account
      </Text>
      <Text className="text-4xl font-extrabold text-ledger-ink">
        Cloud Migration
      </Text>
      <Text className="text-base leading-6 text-ledger-muted">
        Review local guest records, copy them to your account in safe steps, and
        retry anything that needs attention.
      </Text>
    </View>
  );
}

function OverviewCard({ review }: { review: MigrationReviewSummary }) {
  return (
    <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-lg font-bold text-ledger-ink">
            Migration Review
          </Text>
          <Text className="text-sm leading-5 text-ledger-muted">
            {review.completionMessage ??
              "Migration is optional and user-controlled. Local guest data remains on this device."}
          </Text>
        </View>
        <OverallStatusBadge status={review.overallStatus} />
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Metric label="Local records" value={review.localTotals.supportedRecords} />
        <Metric label="Copied" value={review.mappingTotals.synced} />
        <Metric label="Skipped" value={review.mappingTotals.skipped} />
        <Metric label="Failed" value={review.mappingTotals.failed} />
      </View>

      <View className="gap-2">
        <SummaryRow
          label="Vehicles"
          localValue={`${review.guestSummary.counts.activeVehicles} active, ${review.guestSummary.counts.archivedVehicles} archived`}
          migratedValue={String(stepByKey(review, "vehicles")?.migratedCount ?? 0)}
        />
        <SummaryRow
          label="Odometer"
          localValue={String(review.guestSummary.counts.odometerEntries)}
          migratedValue={String(
            stepByKey(review, "odometer_entries")?.migratedCount ?? 0,
          )}
        />
        <SummaryRow
          label="Service"
          localValue={String(review.guestSummary.counts.serviceRecords)}
          migratedValue={String(
            stepByKey(review, "service_records")?.migratedCount ?? 0,
          )}
        />
        <SummaryRow
          label="Repair"
          localValue={String(review.guestSummary.counts.repairRecords)}
          migratedValue={String(
            stepByKey(review, "repair_records")?.migratedCount ?? 0,
          )}
        />
        <SummaryRow
          label="Reminders"
          localValue={`${review.guestSummary.counts.maintenanceReminders} total`}
          migratedValue={String(
            stepByKey(review, "maintenance_reminders")?.migratedCount ?? 0,
          )}
        />
        <SummaryRow
          label="Attachments"
          localValue={String(review.guestSummary.counts.attachments)}
          migratedValue={String(
            stepByKey(review, "record_attachments")?.migratedCount ?? 0,
          )}
        />
      </View>
    </View>
  );
}

function StepCard({
  index,
  isActive,
  isBusy,
  onRun,
  step,
}: {
  index: number;
  isActive: boolean;
  isBusy: boolean;
  onRun: () => void;
  step: MigrationReviewStepSummary;
}) {
  const displayStatus = isActive ? "in_progress" : step.status;
  const disabled = isBusy || !step.canRun;

  return (
    <View className="gap-3 rounded-card border border-ledger-line bg-ledger-background p-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-sm font-bold text-ledger-muted">
            Step {index}
          </Text>
          <Text className="mt-1 text-base font-bold text-ledger-ink">
            {step.title}
          </Text>
        </View>
        <StatusBadge status={displayStatus} />
      </View>

      <Text className="text-sm leading-5 text-ledger-muted">
        {step.description}
      </Text>

      {step.prerequisite ? (
        <Text className="text-xs font-bold uppercase text-ledger-muted">
          {step.prerequisite}
        </Text>
      ) : null}

      {step.blockedReason ? (
        <Text className="text-sm leading-5 text-ledger-muted">
          {step.blockedReason}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        <Metric label="Local" value={step.localCount} />
        <Metric label="Copied" value={step.migratedCount} />
        <Metric label="Skipped" value={step.skippedCount} />
        <Metric label="Failed" value={step.failedCount} />
      </View>

      <Pressable
        accessibilityRole="button"
        className={`rounded-card px-4 py-3 ${
          disabled ? "bg-ledger-primary opacity-60" : "bg-ledger-primary"
        }`}
        disabled={disabled}
        onPress={onRun}
      >
        <Text className="text-center text-base font-bold text-white">
          {isActive ? "Migrating..." : actionLabelForStep(step)}
        </Text>
      </Pressable>
    </View>
  );
}

function StatusBadge({ status }: { status: MigrationReviewStepStatus }) {
  return (
    <View
      className={`rounded-full border px-3 py-1 ${statusContainerClasses[status]}`}
    >
      <Text className={`text-xs font-bold ${statusTextClasses[status]}`}>
        {statusLabels[status]}
      </Text>
    </View>
  );
}

function OverallStatusBadge({
  status,
}: {
  status: MigrationReviewOverallStatus;
}) {
  const visualStatus: MigrationReviewStepStatus =
    status === "partially_complete" ? "ready" : status;

  return (
    <View
      className={`rounded-full border px-3 py-1 ${statusContainerClasses[visualStatus]}`}
    >
      <Text className={`text-xs font-bold ${statusTextClasses[visualStatus]}`}>
        {overallStatusLabels[status]}
      </Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View className="min-w-[96px] flex-1 rounded-card border border-ledger-line bg-ledger-surface p-3">
      <Text className="text-xs font-bold uppercase text-ledger-muted">
        {label}
      </Text>
      <Text className="mt-1 text-xl font-extrabold text-ledger-ink">
        {value}
      </Text>
    </View>
  );
}

function SummaryRow({
  label,
  localValue,
  migratedValue,
}: {
  label: string;
  localValue: string;
  migratedValue: string;
}) {
  return (
    <View className="flex-row justify-between gap-3 border-b border-ledger-line pb-2">
      <Text className="text-sm font-bold text-ledger-ink">{label}</Text>
      <Text className="flex-1 text-right text-sm text-ledger-muted">
        {localValue} local / {migratedValue} copied
      </Text>
    </View>
  );
}

function actionLabelForStep(step: MigrationReviewStepSummary) {
  if (step.status === "completed") {
    return "Completed";
  }

  if (step.status === "failed" || step.status === "completed_with_errors") {
    return "Retry Step";
  }

  if (step.status === "blocked") {
    return "Blocked";
  }

  return "Run Step";
}

function stepByKey(
  review: MigrationReviewSummary,
  stepKey: MigrationReviewStepKey,
) {
  return review.steps.find((step) => step.key === stepKey);
}

function titleForStep(stepKey: MigrationReviewStepKey) {
  const titles: Record<MigrationReviewStepKey, string> = {
    maintenance_reminders: "Maintenance reminders",
    odometer_entries: "Odometer entries",
    record_attachments: "Attachments",
    repair_records: "Repair records",
    service_records: "Service records",
    vehicles: "Vehicles",
  };

  return titles[stepKey];
}
