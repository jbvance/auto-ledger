import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { AccountDataControls } from "./AccountDataControls";

const summary = {
  hasData: true,
  recordCounts: {
    attachmentMetadata: 2,
    maintenanceReminders: 4,
    odometerEntries: 5,
    repairRecords: 1,
    serviceRecords: 3,
    vehicles: 2,
  },
};

describe("web account data controls", () => {
  it("renders signed-in account status, export access, and inactive deletion", () => {
    const html = renderToStaticMarkup(
      <AccountDataControls
        isAuthenticated
        summary={summary}
        userEmail="driver@example.com"
      />,
    );

    expect(html).toContain("driver@example.com");
    expect(html).toContain("href=\"/settings/export\"");
    expect(html).toContain("Open Cloud CSV Export");
    expect(html).toContain("Local guest records are stored on this device.");
    expect(html).toContain(
      "Cloud account records are stored in your AutoLedger account.",
    );
    expect(html).toContain("Coming soon");
    expect(html).toContain("disabled=\"\"");
  });

  it("renders signed-out state without an active cloud delete action", () => {
    const html = renderToStaticMarkup(
      <AccountDataControls isAuthenticated={false} />,
    );

    expect(html).toContain("Not signed in");
    expect(html).toContain("Sign in to view cloud account data.");
    expect(html).toContain("Coming soon");
    expect(html).not.toContain("Delete Cloud Data Now");
  });
});
