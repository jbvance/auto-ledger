import { NextResponse } from "next/server";

import { createSignedUrlForCloudAttachment } from "../../../../../../../../lib/cloud/recordAttachmentData";
import { getWebCloudAuthState } from "../../../../../../../../lib/cloud/serverData";

type OpenServiceAttachmentRouteProps = {
  params: Promise<{
    attachmentId: string;
    serviceRecordId: string;
    vehicleId: string;
  }>;
};

const attachmentErrorResponse = (message: string, status = 400) =>
  new NextResponse(`Unable to open attachment. ${message}`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
    status,
  });

export async function GET(_request: Request, props: OpenServiceAttachmentRouteProps) {
  const { attachmentId, serviceRecordId, vehicleId } = await props.params;
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return attachmentErrorResponse(
      authState.errorMessage ?? "Sign in to view this private attachment.",
      401,
    );
  }

  try {
    const signedUrl = await createSignedUrlForCloudAttachment({
      attachmentId,
      serviceRecordId,
      userId: authState.user.id,
      vehicleId,
    });

    if (!signedUrl) {
      return attachmentErrorResponse(
        "This cloud attachment was not found for this service record.",
        404,
      );
    }

    return NextResponse.redirect(signedUrl);
  } catch (error: unknown) {
    return attachmentErrorResponse(
      error instanceof Error
        ? error.message
        : "A private attachment link could not be created.",
    );
  }
}
