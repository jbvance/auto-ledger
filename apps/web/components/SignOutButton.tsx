"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "../lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = async () => {
    setFeedback(null);
    setIsSigningOut(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    setIsSigningOut(false);

    if (error) {
      setFeedback(error.message);
      return;
    }

    router.push("/login");
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <button
        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--foreground)]"
        disabled={isSigningOut}
        onClick={() => {
          void signOut();
        }}
        type="button"
      >
        {isSigningOut ? "Signing out..." : "Sign out"}
      </button>
      {feedback ? (
        <p className="text-sm leading-6 text-[var(--muted)]">{feedback}</p>
      ) : null}
    </div>
  );
}
