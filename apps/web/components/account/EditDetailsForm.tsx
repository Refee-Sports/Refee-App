"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/AppButton";
import { supabase } from "@/lib/supabase";
import { fetchMyProfile } from "@/lib/profile/queries";
import { fetchMyHirerProfile } from "@/lib/director/queries";
import { uploadAvatarFile } from "@/lib/profile/avatar";
import { updateAssignorDetails, updateDirectorDetails } from "@/lib/profile/account";
import { ORG_TYPES } from "@/lib/roles/queries";

/**
 * Edit the details a director or assignor gave at sign-up: photo, name, city,
 * and for directors the organization. Referees have their own fuller page.
 */
export function EditDetailsForm({ role }: { role: "director" | "assignor" }) {
  const router = useRouter();
  const isDirector = role === "director";
  const backHref = `/${role}/profile`;

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastInitial: "", city: "", state: "", orgName: "", orgType: "" });

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      const [{ data: profile }, hirerResult] = await Promise.all([
        fetchMyProfile(session.user.id),
        isDirector ? fetchMyHirerProfile(session.user.id) : Promise.resolve({ data: null }),
      ]);
      const hirer = hirerResult.data as
        | { org_name: string; org_type: string; city: string | null; state: string | null;
            contact_first_name: string | null; contact_last_initial: string | null }
        | null;
      setAvatarUrl(profile?.avatar_url ?? null);
      setForm({
        firstName: hirer?.contact_first_name ?? profile?.first_name ?? "",
        lastInitial: hirer?.contact_last_initial ?? profile?.last_initial ?? "",
        city: hirer?.city ?? profile?.city ?? "",
        state: hirer?.state ?? profile?.state ?? "",
        orgName: hirer?.org_name ?? "",
        orgType: hirer?.org_type ?? "",
      });
      setLoading(false);
    })();
  }, [isDirector]);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const changePhoto = async (file: File | undefined) => {
    if (!userId || !file) return;
    setUploading(true);
    const result = await uploadAvatarFile(userId, file);
    setUploading(false);
    if (result.error) setError(result.error.message);
    else if (result.avatarUrl) setAvatarUrl(result.avatarUrl);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || saving) return;
    setSaving(true);
    setError(null);
    const result = isDirector
      ? await updateDirectorDetails(userId, {
          contactFirstName: form.firstName,
          contactLastInitial: form.lastInitial,
          orgName: form.orgName,
          orgType: form.orgType,
          city: form.city,
          state: form.state,
        })
      : await updateAssignorDetails(userId, form);
    setSaving(false);
    if (result.error) setError(result.error.message);
    else router.push(backHref);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper text-signal">
        <Spinner />
      </div>
    );
  }

  const input = "mt-2 w-full border border-ink bg-chalk px-3 py-3 text-[15px] outline-none focus:border-signal";
  const label = "block font-mono-bold text-[10px] uppercase text-ink";

  return (
    <form onSubmit={save} className="mx-auto w-full max-w-xl px-5 py-6 sm:px-0">
      <Link href={backHref} className="font-mono-bold text-[10px] uppercase underline">
        Back to profile
      </Link>
      <h1 className="mt-6 font-display text-3xl uppercase text-ink">Edit profile</h1>

      <label className="mt-6 flex cursor-pointer items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center overflow-hidden bg-ink text-paper">
          {uploading ? (
            <Spinner />
          ) : avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user upload from storage
            <img src={avatarUrl} alt="Your photo" className="h-16 w-16 object-cover" />
          ) : null}
        </span>
        <span className="font-mono-bold text-[10px] uppercase underline">Change photo</span>
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => void changePhoto(e.target.files?.[0])} />
      </label>

      {isDirector ? (
        <>
          <label className={`${label} mt-6`}>
            Organization name
            <input value={form.orgName} onChange={(e) => set("orgName")(e.target.value)} className={input} />
          </label>
          <fieldset className="mt-5">
            <legend className={label}>Organization type</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {ORG_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={form.orgType === t.id}
                  onClick={() => set("orgType")(t.id)}
                  className={`border px-3 py-2 font-mono-bold text-[10px] uppercase ${
                    form.orgType === t.id ? "border-ink bg-ink text-paper" : "border-ink-20 bg-chalk text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      <div className="mt-5 grid grid-cols-[1fr_auto] gap-4">
        <label className={label}>
          {isDirector ? "Contact first name" : "First name"}
          <input value={form.firstName} onChange={(e) => set("firstName")(e.target.value)} autoComplete="given-name" className={input} />
        </label>
        <label className={label}>
          Last initial
          <input
            value={form.lastInitial}
            onChange={(e) => set("lastInitial")(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase())}
            maxLength={1}
            className={`${input} w-20`}
          />
        </label>
        <label className={label}>
          City
          <input value={form.city} onChange={(e) => set("city")(e.target.value)} autoComplete="address-level2" className={input} />
        </label>
        <label className={label}>
          State
          <input
            value={form.state}
            onChange={(e) => set("state")(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase())}
            maxLength={2}
            autoComplete="address-level1"
            className={`${input} w-20`}
          />
        </label>
      </div>

      {error ? <p className="mt-4 border border-foul bg-foul/10 p-3 text-sm text-foul">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="mt-6 w-full bg-ink py-4 font-mono-bold text-[11px] uppercase text-paper disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
