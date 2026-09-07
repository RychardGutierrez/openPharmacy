"use client"

import { useCurrentShift } from "@/features/shifts/api/use-current-shift"
import { useOpenShift } from "@/features/shifts/api/use-open-shift"
import type { Shift } from "@/features/shifts/types"

export interface ShiftGateResult {
  shift: Shift | null
  isLoading: boolean
  isOpen: boolean
  openShift: (openingCash: number) => void
  isOpening: boolean
}

export function useShiftGate(): ShiftGateResult {
  const { data, isPending } = useCurrentShift()
  const openMutation = useOpenShift()

  return {
    shift: data ?? null,
    isLoading: isPending,
    isOpen: Boolean(data),
    openShift: (openingCash: number) => openMutation.mutate({ openingCash }),
    isOpening: openMutation.isPending,
  }
}
