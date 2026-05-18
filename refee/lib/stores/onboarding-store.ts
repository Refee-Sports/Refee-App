import { create } from "zustand";

type OnboardingStore = {
  profileComplete: boolean | null;
  setProfileComplete: (v: boolean | null) => void;
  profileVersion: number;
  bumpProfileVersion: () => void;
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  profileComplete: null,
  setProfileComplete: (v) => set({ profileComplete: v }),
  profileVersion: 0,
  bumpProfileVersion: () => set((s) => ({ profileVersion: s.profileVersion + 1 })),
}));
