import { AccountDataControls } from "../../components/AccountDataControls";
import { AccountPageShell } from "../../components/AccountPageChrome";
import {
  getWebCloudCsvExportSummary,
  loadWebCloudCsvExportData,
} from "../../lib/cloud/exportData";
import { getWebCloudAuthState } from "../../lib/cloud/serverData";

export default async function AccountDataSettingsPage() {
  const authState = await getWebCloudAuthState();
  const isAuthenticated = authState.status === "authenticated";
  const userEmail = isAuthenticated ? (authState.user.email ?? null) : null;
  let summary: ReturnType<typeof getWebCloudCsvExportSummary> | null = null;
  let loadError = authState.errorMessage;

  if (isAuthenticated) {
    try {
      const data = await loadWebCloudCsvExportData({
        userId: authState.user.id,
      });
      summary = getWebCloudCsvExportSummary(data);
    } catch (error: unknown) {
      loadError =
        error instanceof Error
          ? error.message
          : "Unable to load cloud account data details.";
    }
  }

  return (
    <AccountPageShell userEmail={userEmail}>
      <AccountDataControls
        isAuthenticated={isAuthenticated}
        loadError={loadError}
        summary={summary}
        userEmail={userEmail}
      />
    </AccountPageShell>
  );
}
