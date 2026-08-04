import { create } from "zustand";

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
