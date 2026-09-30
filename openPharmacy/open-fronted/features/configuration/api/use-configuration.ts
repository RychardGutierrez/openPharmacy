"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  getConfiguration,
  getRuntimeConfiguration,
  updateConfiguration,
  uploadConfigurationLogo,
} from "@/features/configuration/api/configuration-api"
import type { ConfigurationValues } from "@/features/configuration/types"

const CONFIGURATION_QUERY_KEY = ["configuration"]
const RUNTIME_CONFIGURATION_QUERY_KEY = ["configuration", "runtime"]

export function useConfiguration() {
  return useQuery({ queryKey: CONFIGURATION_QUERY_KEY, queryFn: getConfiguration })
}

export function useRuntimeConfiguration() {
  return useQuery({ queryKey: RUNTIME_CONFIGURATION_QUERY_KEY, queryFn: getRuntimeConfiguration })
}

export function useUpdateConfiguration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: Partial<ConfigurationValues>) => updateConfiguration(values),
    onSuccess: (data) => {
      queryClient.setQueryData(CONFIGURATION_QUERY_KEY, data)
      void queryClient.invalidateQueries({ queryKey: RUNTIME_CONFIGURATION_QUERY_KEY })
    },
  })
}

export function useUploadConfigurationLogo() {
  return useMutation({ mutationFn: uploadConfigurationLogo })
}
