import { router, type Href } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth";
import { hasAnyLocalGuestData } from "../../lib/localGuestData";

const localDataMessage =
  "Cloud sync for existing local records is coming soon. New cloud records will be saved to your account.";

export default function SignInScreen() {
  const { isConfigured, isLoading, signIn, user } = useAuth();
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

  const submit = async () => {
    setFeedback(null);
    setIsSubmitting(true);

    const result = await signIn({ email, password });

    if (result.error) {
      setFeedback(result.error);
      setIsSubmitting(false);
      return;
    }

    setFeedback(
      (await hasAnyLocalGuestData())
        ? localDataMessage
        : "Signed in. New vehicles will be saved to your account.",
    );
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-ledger-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#136f63" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ledger-background">
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        <View className="gap-2 pt-4">
          <Text className="text-sm font-bold uppercase text-ledger-primary">
            Optional account
          </Text>
          <Text className="text-4xl font-extrabold text-ledger-ink">
            Sign in
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            Keep using AutoLedger in guest mode, or sign in to save new vehicle
            records to your account.
          </Text>
        </View>

        {!isConfigured ? (
          <InfoCard text="Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable account sign-in." />
        ) : user ? (
          <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
            <Text className="text-lg font-bold text-ledger-ink">
              Already signed in
            </Text>
            <Text className="text-sm leading-5 text-ledger-muted">
              {user.email ?? "This account"} is signed in on this device. New
              vehicle records save to your account.
            </Text>
            <Pressable
              accessibilityRole="button"
              className="rounded-card bg-ledger-primary px-4 py-3"
              onPress={() => router.replace("/settings")}
            >
              <Text className="text-center text-base font-bold text-white">
                Back to Settings
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-4 rounded-card border border-ledger-line bg-ledger-surface p-4">
            <AuthField
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email"
              onChangeText={setEmail}
              textContentType="emailAddress"
              value={email}
            />
            <AuthField
              label="Password"
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              value={password}
            />

            {feedback ? <InfoCard text={feedback} /> : null}

            <Pressable
              accessibilityRole="button"
              className="rounded-card bg-ledger-primary px-4 py-3"
              disabled={isSubmitting}
              onPress={() => {
                void submit();
              }}
            >
              <Text className="text-center text-base font-bold text-white">
                {isSubmitting ? "Signing In..." : "Sign In"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="rounded-card border border-ledger-line bg-ledger-background px-4 py-3"
              onPress={() => router.replace("/auth/sign-up" as Href)}
            >
              <Text className="text-center text-base font-bold text-ledger-ink">
                Create Account
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AuthField({
  label,
  ...inputProps
}: {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
  label: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  textContentType?: "emailAddress" | "password";
  value: string;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-ledger-ink">{label}</Text>
      <TextInput
        className="rounded-card border border-ledger-line bg-ledger-background px-4 py-3 text-base text-ledger-ink"
        placeholderTextColor="#667277"
        {...inputProps}
      />
    </View>
  );
}

function InfoCard({ text }: { text: string }) {
  return (
    <View className="rounded-card border border-ledger-line bg-ledger-background p-3">
      <Text className="text-sm leading-5 text-ledger-muted">{text}</Text>
    </View>
  );
}
