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

export default function SignUpScreen() {
  const { isConfigured, isLoading, signUp, user } = useAuth();
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

  const submit = async () => {
    setFeedback(null);
    setIsSubmitting(true);

    const result = await signUp({ email, password });

    if (result.error) {
      setFeedback(result.error);
      setIsSubmitting(false);
      return;
    }

    if (result.needsEmailConfirmation) {
      setFeedback(
        "Check your email to confirm your account. New cloud vehicles will be available after sign-in.",
      );
      setIsSubmitting(false);
      return;
    }

    setFeedback(
      (await hasAnyLocalGuestData())
        ? localDataMessage
        : "Account created. New vehicles will be saved to your account.",
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
            Create account
          </Text>
          <Text className="text-base leading-6 text-ledger-muted">
            Accounts are optional. Your existing guest records stay local on
            this device, and new vehicles can be saved to your account.
          </Text>
        </View>

        {!isConfigured ? (
          <InfoCard text="Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable account creation." />
        ) : user ? (
          <View className="gap-3 rounded-card border border-ledger-line bg-ledger-surface p-4">
            <Text className="text-lg font-bold text-ledger-ink">
              Account active
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
              textContentType="newPassword"
              value={password}
            />

            <Text className="text-sm leading-5 text-ledger-muted">
              Use at least 6 characters. AutoLedger will not upload local
              records during account creation.
            </Text>

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
                {isSubmitting ? "Creating..." : "Create Account"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="rounded-card border border-ledger-line bg-ledger-background px-4 py-3"
              onPress={() => router.replace("/auth/sign-in" as Href)}
            >
              <Text className="text-center text-base font-bold text-ledger-ink">
                Sign In Instead
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
  textContentType?: "emailAddress" | "newPassword";
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
