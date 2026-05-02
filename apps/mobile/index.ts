import "@expo/metro-runtime";
import { withErrorOverlay } from "@expo/metro-runtime/error-overlay";
import "expo/src/Expo.fx";
import { App } from "expo-router/build/qualified-entry";
import { AppRegistry } from "react-native";

const RootApp =
  process.env.NODE_ENV === "production" ? App : withErrorOverlay(App);

AppRegistry.registerComponent("main", () => RootApp);
