import {
  formatCostAmount,
  formatDisplayDate,
  formatMaintenanceReminderCategory,
  formatOdometer,
  formatVehicleSubtitle,
  formatVehicleTitle,
  getMaintenanceReminderStatus,
  maintenanceReminderStatusLabels,
  vehicleTypeLabels,
  type MaintenanceReminder,
  type Vehicle,
} from "@autoledger/shared";
import Link from "next/link";

import {
  AccountAuthPrompt,
  AccountErrorPanel,
  AccountPageShell,
} from "../../components/AccountPageChrome";
import {
  getWebCloudAuthState,
  loadWebCloudDashboardData,
  type WebRecentActivityItem,
} from "../../lib/cloud/serverData";

export default async function DashboardPage() {
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <AccountPageShell>
        <AccountAuthPrompt
          defaultMessage="The web dashboard shows cloud account data only. Sign in to continue."
          message={authState.errorMessage}
          title="Sign in to view your dashboard"
        />
      </AccountPageShell>
    );
  }

  const userEmail = authState.user.email ?? null;
  let dashboard: Awaited<ReturnType<typeof loadWebCloudDashboardData>> | null =
    null;
  let loadError: string | null = null;

  try {
    dashboard = await loadWebCloudDashboardData(authState.user.id);
  } catch (error: unknown) {
    loadError =
      error instanceof Error
        ? error.message
        : "Unable to load the cloud dashboard.";
  }

  if (loadError || !dashboard) {
    return (
      <AccountPageShell userEmail={userEmail}>
        <AccountErrorPanel
          message={loadError ?? "Unable to load the cloud dashboard."}
          title="Dashboard unavailable"
        />
      </AccountPageShell>
    );
  }

  return (
    <AccountPageShell userEmail={userEmail}>
      <section className="flex flex-col gap-3 border-b border-[var(--line)] pb-5">
        <p className="text-sm font-bold uppercase text-[var(--primary)]">
          Account dashboard
        </p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold leading-tight">
              Cloud garage overview
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--muted)]">
              Web shows signed-in Supabase account data only. Local mobile guest
              records stay local and are not mixed into these views.
            </p>
          </div>
          <Link
            className="rounded-lg bg-[var(--primary)] px-4 py-3 text-center text-sm font-bold text-white"
            href="/vehicles"
          >
            View Vehicles
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard
          label="active vehicles"
          value={dashboard.counts.activeVehicles}
        />
        <StatCard
          label="archived vehicles"
          value={dashboard.archivedVehicleCount}
        />
        <StatCard
          label="odometer entries"
          value={dashboard.counts.odometerEntries}
        />
        <StatCard
          label="service records"
          value={dashboard.counts.serviceRecords}
        />
        <StatCard
          label="repair records"
          value={dashboard.counts.repairRecords}
        />
        <StatCard
          label="active reminders"
          value={dashboard.counts.upcomingReminders}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <VehicleSummarySection vehicles={dashboard.activeVehicles} />
        <ReminderSummarySection
          reminders={dashboard.activeReminders}
          vehicles={dashboard.activeVehicles}
        />
      </section>

      <RecentActivitySection items={dashboard.recentActivity} />
    </AccountPageShell>
  );
}

function VehicleSummarySection({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Vehicles</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Active cloud vehicles saved to this account.
          </p>
        </div>
        <Link
          className="text-sm font-bold text-[var(--primary)]"
          href="/vehicles"
        >
          All vehicles
        </Link>
      </div>
      {vehicles.length === 0 ? (
        <EmptyText>No vehicles in your account yet.</EmptyText>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {vehicles.slice(0, 4).map((vehicle) => (
            <Link
              className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-4 text-[var(--foreground)] transition hover:border-[var(--primary)]"
              href={`/vehicles/${vehicle.id}`}
              key={vehicle.id}
            >
              <h3 className="font-bold">{formatVehicleTitle(vehicle)}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {formatVehicleSubtitle(vehicle)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <SmallBadge>
                  {vehicleTypeLabels[vehicle.vehicle_type]}
                </SmallBadge>
                <SmallBadge>
                  {formatOdometer(
                    vehicle.current_odometer,
                    vehicle.odometer_unit,
                  )}
                </SmallBadge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function ReminderSummarySection({
  reminders,
  vehicles,
}: {
  reminders: MaintenanceReminder[];
  vehicles: Vehicle[];
}) {
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-bold">Upcoming Reminders</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        Most urgent active reminders across cloud vehicles.
      </p>
      {reminders.length === 0 ? (
        <EmptyText>No active cloud reminders yet.</EmptyText>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {reminders.slice(0, 5).map((reminder) => {
            const vehicle = vehicleById.get(reminder.vehicle_id);
            const status = getMaintenanceReminderStatus({
              currentOdometer: vehicle?.current_odometer ?? 0,
              reminder,
            });

            return (
              <div
                className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-3"
                key={reminder.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {vehicle ? (
                      <Link
                        className="font-bold text-[var(--foreground)] transition hover:text-[var(--primary)]"
                        href={`/vehicles/${vehicle.id}/reminders/${reminder.id}`}
                      >
                        {reminder.title}
                      </Link>
                    ) : (
                      <p className="font-bold">{reminder.title}</p>
                    )}
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {vehicle?.nickname ?? "Cloud vehicle"} -{" "}
                      {formatMaintenanceReminderCategory(reminder.category)}
                    </p>
                  </div>
                  <span className="rounded-md bg-[var(--surface)] px-2 py-1 text-xs font-bold uppercase text-[var(--muted)]">
                    {maintenanceReminderStatusLabels[status]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {reminder.due_date
                    ? formatDisplayDate(reminder.due_date)
                    : "No due date"}
                  {vehicle &&
                  reminder.due_odometer !== null &&
                  reminder.due_odometer !== undefined
                    ? ` - Due ${formatOdometer(reminder.due_odometer, vehicle.odometer_unit)}`
                    : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RecentActivitySection({ items }: { items: WebRecentActivityItem[] }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-bold">Recent Activity</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        Latest cloud odometer, service, and repair records across active
        vehicles.
      </p>
      {items.length === 0 ? (
        <EmptyText>No recent cloud activity yet.</EmptyText>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <div
              className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-4"
              key={`${item.type}-${item.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-[var(--primary)]">
                    {item.typeLabel}
                  </p>
                  <h3 className="mt-1 font-bold">{item.title}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {item.vehicle.nickname} - {formatDisplayDate(item.date)}
                  </p>
                </div>
                {item.categoryLabel ? (
                  <SmallBadge>{item.categoryLabel}</SmallBadge>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.odometer_reading === null ||
                item.odometer_reading === undefined ? null : (
                  <SmallBadge>
                    {formatOdometer(
                      item.odometer_reading,
                      item.type === "odometer"
                        ? item.source.odometer_unit
                        : item.vehicle.odometer_unit,
                    )}
                  </SmallBadge>
                )}
                {item.cost_amount === null ||
                item.cost_amount === undefined ? null : (
                  <SmallBadge>
                    {formatCostAmount(item.cost_amount, item.cost_currency)}
                  </SmallBadge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase leading-4 text-[var(--muted)]">
        {label}
      </p>
    </div>
  );
}

function SmallBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-[var(--surface)] px-2 py-1 text-xs font-bold uppercase text-[var(--muted)]">
      {children}
    </span>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg bg-[var(--background)] p-3">
      <p className="text-sm leading-6 text-[var(--muted)]">{children}</p>
    </div>
  );
}
