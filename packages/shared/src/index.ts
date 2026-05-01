export const appName = "AutoLedger";

export const currentPhase = {
  id: 1,
  name: "Monorepo and Foundation",
} as const;

export type NavigationSection = {
  label: string;
  description: string;
};

export const foundationNavigation: NavigationSection[] = [
  {
    label: "Dashboard",
    description: "The future home for vehicle summaries.",
  },
  {
    label: "Vehicles",
    description: "Guest vehicle tracking starts in Phase 2.",
  },
  {
    label: "Records",
    description: "Service and repair records are intentionally not active yet.",
  },
  {
    label: "Settings",
    description: "Privacy, sync, and export controls come in later phases.",
  },
];
