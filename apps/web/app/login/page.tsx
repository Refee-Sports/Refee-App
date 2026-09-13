import { redirect } from "next/navigation";

/**
 * The old placeholder login screen. Auth now lives at /auth/welcome, backed by
 * the same Supabase project as the mobile app, so this just forwards.
 */
export default function LoginPage() {
  redirect("/auth/welcome");
}
