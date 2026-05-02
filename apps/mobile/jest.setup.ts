jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock("expo-file-system/legacy", () => ({
  EncodingType: {
    UTF8: "utf8",
  },
  cacheDirectory: "file:///cache/",
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  documentDirectory: "file:///documents/",
  getContentUriAsync: jest.fn(async (uri: string) => uri),
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 100 })),
  makeDirectoryAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(),
}));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock("@react-native-community/datetimepicker", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");

  return {
    __esModule: true,
    default: () => React.createElement(Text, null, "Date picker"),
  };
});

jest.mock("expo-notifications/build/cancelScheduledNotificationAsync", () =>
  jest.fn(),
);
jest.mock("expo-notifications/build/NotificationPermissions", () => ({
  getPermissionsAsync: jest.fn(async () => ({
    canAskAgain: true,
    granted: false,
    status: "undetermined",
  })),
  requestPermissionsAsync: jest.fn(async () => ({
    canAskAgain: true,
    granted: true,
    status: "granted",
  })),
}));
jest.mock("expo-notifications/build/NotificationPermissions.types", () => ({
  IosAuthorizationStatus: {
    PROVISIONAL: 3,
  },
}));
jest.mock("expo-notifications/build/NotificationChannelManager.types", () => ({
  AndroidImportance: {
    DEFAULT: "default",
  },
}));
jest.mock("expo-notifications/build/scheduleNotificationAsync", () =>
  jest.fn(async () => "notification-id"),
);
jest.mock("expo-notifications/build/setNotificationChannelAsync", () =>
  jest.fn(),
);
jest.mock("expo-notifications/build/NotificationsHandler", () => ({
  setNotificationHandler: jest.fn(),
}));
jest.mock("expo-notifications/build/Notifications.types", () => ({
  PermissionStatus: {
    DENIED: "denied",
  },
  SchedulableTriggerInputTypes: {
    DATE: "date",
  },
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      getUser: jest.fn(async () => ({ data: { user: null } })),
      onAuthStateChange: jest.fn(() => ({
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      })),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
  })),
  processLock: {},
}));

jest.mock("react-native-url-polyfill/auto", () => ({}));
