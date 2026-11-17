"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  getSiatSettings,
  testSiatConnection,
  updateSiatSettings,
} from "@/features/siat-settings/api/siat-settings-api"
import type { SiatSettingsUpdate } from "@/features/siat-settings/types"

export const SIAT_SETTINGS_QUERY_KEY = ["siat-settings"]

export function useSiatSettings() {
  return useQuery({ queryKey: SIAT_SETTINGS_QUERY_KEY, queryFn: getSiatSettings })
}

export function useUpdateSiatSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: SiatSettingsUpdate) => updateSiatSettings(values),
    onSuccess: (data) => {
      queryClient.setQueryData(SIAT_SETTINGS_QUERY_KEY, data)
    },
  })
}

export function useTestSiatConnection() {
  return useMutation({ mutationFn: testSiatConnection })
}
