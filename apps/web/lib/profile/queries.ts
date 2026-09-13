import { supabase } from "@/lib/supabase";
import { geocodeAddress } from "@/lib/geo/geocode";

export type ProfileRow = {
  id: string;
  first_name: string;
  last_initial: string;
  display_name: string;
  city: string;
  state: string;
  avatar_url: string | null;
  rating: number;
  rating_count: number;
  games_called_total: number;
  is_available: boolean;
  is_verified: boolean;
  ref_id_number: number;
  member_since: string;
  primary_role: string;
};

export type RefSportRow = {
  sport_id: string;
  years_experience: number;
  sports: { display_name: string } | { display_name: string }[];
};

export type AvailabilityRow = {
  min_pay_per_game: number;
  travel_radius_miles: number;
  available_days: number;
  max_games_per_day: number;
};

export async function profileExists(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("public_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  return !!data;
}

export async function fetchMyProfile(userId: string) {
  return supabase
    .from("public_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
}

export async function fetchMyRefSports(userId: string) {
  return supabase
    .from("ref_sports")
    .select("sport_id, years_experience, sports(display_name)")
    .eq("ref_id", userId);
}

export async function fetchMyAvailability(userId: string) {
  return supabase
    .from("availability_prefs")
    .select("*")
    .eq("ref_id", userId)
    .maybeSingle();
}

export type CertEntry = { bodyId: string; licenseNumber: string };

export async function saveFullProfile(
  userId: string,
  args: {
    firstName: string;
    lastInitial: string;
    city: string;
    state: string;
    sportId: string;
    yearsExperience: number;
    minPayPerGame: number;
    travelRadiusMiles: number;
    certs: CertEntry[];
    levelIds: string[];
  }
) {
  // Geocode home city for distance-based job filtering (best-effort)
  const home = await geocodeAddress(`${args.city}, ${args.state}, USA`);

  const { error: profileError } = await supabase.from("public_profiles").upsert({
    id: userId,
    first_name: args.firstName,
    last_initial: args.lastInitial,
    city: args.city,
    state: args.state,
    home_lat: home?.lat ?? null,
    home_lng: home?.lng ?? null,
  });
  if (profileError) return { error: profileError };

  const { error: sportError } = await supabase.from("ref_sports").upsert({
    ref_id: userId,
    sport_id: args.sportId,
    years_experience: args.yearsExperience,
  });
  if (sportError) return { error: sportError };

  const { error: availError } = await supabase.from("availability_prefs").upsert({
    ref_id: userId,
    min_pay_per_game: args.minPayPerGame,
    travel_radius_miles: args.travelRadiusMiles,
  });
  if (availError) return { error: availError };

  // Always clear then re-insert so retries don't accumulate duplicates
  const { error: delCertError } = await supabase
    .from("certifications")
    .delete()
    .eq("ref_id", userId);
  if (delCertError) return { error: delCertError };

  if (args.certs.length > 0) {
    const { error: certError } = await supabase.from("certifications").insert(
      args.certs.map((c) => ({
        ref_id: userId,
        org_name: c.bodyId,
        license_number: c.licenseNumber || null,
      }))
    );
    if (certError) return { error: certError };
  }

  const { error: delLevelError } = await supabase
    .from("ref_levels")
    .delete()
    .eq("ref_id", userId);
  if (delLevelError) return { error: delLevelError };

  if (args.levelIds.length > 0) {
    const { error: levelError } = await supabase.from("ref_levels").insert(
      args.levelIds.map((levelId) => ({
        ref_id: userId,
        level_id: levelId,
        years_experience: 0,
      }))
    );
    if (levelError) return { error: levelError };
  }

  return { error: null };
}

export type CertificationRow = {
  id: string;
  org_name: string;
  license_number: string | null;
};

export type RefLevelRow = {
  level_id: string;
  years_experience: number;
};

export async function fetchMyCertifications(userId: string) {
  return supabase
    .from("certifications")
    .select("id, org_name, license_number")
    .eq("ref_id", userId);
}

export async function fetchMyLevels(userId: string) {
  return supabase
    .from("ref_levels")
    .select("level_id, years_experience")
    .eq("ref_id", userId);
}

export async function updateFullProfile(
  userId: string,
  args: {
    firstName: string;
    lastInitial: string;
    city: string;
    state: string;
    sportId: string;
    yearsExperience: number;
    minPayPerGame: number;
    travelRadiusMiles: number;
    availableDays: number;
    certs: CertEntry[];
    levelIds: string[];
  }
) {
  // Geocode home city for distance-based job filtering (best-effort)
  const home = await geocodeAddress(`${args.city}, ${args.state}, USA`);

  const { error: profileError } = await supabase.from("public_profiles").upsert({
    id: userId,
    first_name: args.firstName,
    last_initial: args.lastInitial,
    city: args.city,
    state: args.state,
    home_lat: home?.lat ?? null,
    home_lng: home?.lng ?? null,
  });
  if (profileError) return { error: profileError };

  const { error: sportError } = await supabase.from("ref_sports").upsert({
    ref_id: userId,
    sport_id: args.sportId,
    years_experience: args.yearsExperience,
  });
  if (sportError) return { error: sportError };

  const { error: availError } = await supabase.from("availability_prefs").upsert({
    ref_id: userId,
    min_pay_per_game: args.minPayPerGame,
    travel_radius_miles: args.travelRadiusMiles,
    available_days: args.availableDays,
  });
  if (availError) return { error: availError };

  // Replace certifications wholesale
  const { error: delCertError } = await supabase
    .from("certifications")
    .delete()
    .eq("ref_id", userId);
  if (delCertError) return { error: delCertError };

  if (args.certs.length > 0) {
    const { error: certError } = await supabase.from("certifications").insert(
      args.certs.map((c) => ({
        ref_id: userId,
        org_name: c.bodyId,
        license_number: c.licenseNumber || null,
      }))
    );
    if (certError) return { error: certError };
  }

  // Replace levels wholesale
  const { error: delLevelError } = await supabase
    .from("ref_levels")
    .delete()
    .eq("ref_id", userId);
  if (delLevelError) return { error: delLevelError };

  if (args.levelIds.length > 0) {
    const { error: levelError } = await supabase.from("ref_levels").insert(
      args.levelIds.map((levelId) => ({
        ref_id: userId,
        level_id: levelId,
        years_experience: 0,
      }))
    );
    if (levelError) return { error: levelError };
  }

  return { error: null };
}

export async function toggleAvailability(userId: string, isAvailable: boolean) {
  return supabase
    .from("public_profiles")
    .update({ is_available: isAvailable })
    .eq("id", userId);
}

export async function fetchPrimaryRole(
  userId: string
): Promise<"referee" | "director" | "assignor"> {
  const { data } = await supabase
    .from("public_profiles")
    .select("primary_role")
    .eq("id", userId)
    .maybeSingle();
  return (data?.primary_role as "referee" | "director" | "assignor") ?? "referee";
}
