// Metro's web import condition selects Zustand's ESM build, which contains
// import.meta and cannot execute inside the classic Expo development bundle.
// Requiring the package selects its equivalent CJS entry on every platform.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require("zustand") as typeof import("zustand");

export type PrimaryRole = "referee" | "director" | "assignor";

type OnboardingStore = {
  profileComplete: boolean | null;
  setProfileComplete: (v: boolean | null) => void;
  primaryRole: PrimaryRole | null;
  setPrimaryRole: (role: PrimaryRole | null) => void;
  profileVersion: number;
  bumpProfileVersion: () => void;
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  profileComplete: null,
  setProfileComplete: (v) => set({ profileComplete: v }),
  primaryRole: null,
  setPrimaryRole: (role) => set({ primaryRole: role }),
  profileVersion: 0,
  bumpProfileVersion: () => set((s) => ({ profileVersion: s.profileVersion + 1 })),
}));
