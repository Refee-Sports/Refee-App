import { AuthSplit } from "@/components/auth/AuthSplit";

/** Onboarding runs in the same signed-out split as the auth screens. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <AuthSplit>{children}</AuthSplit>;
}
