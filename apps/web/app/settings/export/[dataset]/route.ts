import { NextResponse } from "next/server";

import {
  exportWebCloudCsvByDataset,
  getWebCloudCsvExportFile,
  loadWebCloudCsvExportData,
} from "../../../../lib/cloud/exportData";
import { getWebCloudAuthState } from "../../../../lib/cloud/serverData";

type ExportRouteProps = {
  params: Promise<{
    dataset: string;
  }>;
};

const textResponse = (message: string, status: number) =>
  new NextResponse(message, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
    status,
  });

export async function GET(_request: Request, props: ExportRouteProps) {
  const { dataset } = await props.params;
  const exportFile = getWebCloudCsvExportFile(dataset);

  if (!exportFile) {
    return textResponse("Unknown cloud CSV export.", 404);
  }

  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return textResponse(
      authState.errorMessage ?? "Sign in to export cloud account data.",
      401,
    );
  }

  try {
    const data = await loadWebCloudCsvExportData({
      userId: authState.user.id,
    });
    const csv = exportWebCloudCsvByDataset({
      data,
      datasetId: exportFile.id,
    });

    return new NextResponse(csv, {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": `attachment; filename="${exportFile.fileName}"`,
        "content-type": "text/csv; charset=utf-8",
      },
    });
  } catch (error: unknown) {
    return textResponse(
      error instanceof Error
        ? error.message
        : "Unable to export cloud account data.",
      500,
    );
  }
}

