"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { Shift } from "@/features/shifts/types"

type ShiftState = {
  openShift: Shift | null
  hydrated: boolean
  setOpenShift: (shift: Shift) => void
  clearOpenShift: () => void
  setHydrated: (hydrated: boolean) => void
}

export const useShiftStore = create<ShiftState>()(
  persist(
    (set) => ({
      openShift: null,
      hydrated: false,
      setOpenShift: (openShift) => set({ openShift }),
      clearOpenShift: () => set({ openShift: null }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "op_open_shift",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ openShift: state.openShift } as ShiftState),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
)
