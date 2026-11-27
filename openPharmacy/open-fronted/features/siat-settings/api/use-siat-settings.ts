"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  getSiatCatalogItems,
  getSiatCatalogsStatus,
  getSiatSettings,
  syncSiatCatalogs,
  testSiatConnection,
  updateSiatSettings,
  type SiatCatalogItemsParams,
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

export const SIAT_CATALOGS_QUERY_KEY = ["siat-catalogs"]

export function useSiatCatalogsStatus() {
  return useQuery({ queryKey: SIAT_CATALOGS_QUERY_KEY, queryFn: getSiatCatalogsStatus })
}

/**
 * Codes of one catalog for the SIAT-08 pickers. Keyed under SIAT_CATALOGS_QUERY_KEY, so a
 * catalog sync invalidates it too.
 */
export function useSiatCatalogItems(
  catalog: "activities" | "products" | "units",
  params: SiatCatalogItemsParams,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: [...SIAT_CATALOGS_QUERY_KEY, "items", catalog, params],
    queryFn: () => getSiatCatalogItems(catalog, params),
    enabled: options.enabled ?? true,
  })
}

export function useSyncSiatCatalogs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: syncSiatCatalogs,
    onSettled: () => queryClient.invalidateQueries({ queryKey: SIAT_CATALOGS_QUERY_KEY }),
  })
}
