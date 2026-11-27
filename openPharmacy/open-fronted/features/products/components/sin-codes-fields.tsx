"use client"

import { SiatCatalogPicker } from "@/features/products/components/siat-catalog-picker"
import type { SinCodes } from "@/features/products/types"

export interface SinCodesFieldsProps {
  idPrefix: string
  value: SinCodes
  onChange: (next: SinCodes) => void
  disabled?: boolean
  /** Field-level errors keyed by SIN field name. */
  errors?: Partial<Record<keyof SinCodes, string>>
}

/**
 * The three SIN pickers (activity, product, unit) as one group. Changing the activity clears the
 * product, because a product belongs to one activity (SIAT-08).
 */
export function SinCodesFields({
  idPrefix,
  value,
  onChange,
  disabled = false,
  errors,
}: SinCodesFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="grid gap-1.5">
        <SiatCatalogPicker
          id={`${idPrefix}-activity`}
          catalog="activities"
          label="Actividad económica"
          value={value.sinActivityCode || undefined}
          disabled={disabled}
          ariaInvalid={Boolean(errors?.sinActivityCode)}
          onChange={(code) => {
            const next = code ?? ""
            onChange({
              sinActivityCode: next,
              sinProductCode: next === value.sinActivityCode ? value.sinProductCode : "",
              sinUnitCode: value.sinUnitCode,
            })
          }}
        />
        {errors?.sinActivityCode ? (
          <p className="text-sm text-destructive">{errors.sinActivityCode}</p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <SiatCatalogPicker
          id={`${idPrefix}-product`}
          catalog="products"
          parentCode={value.sinActivityCode || undefined}
          label="Producto SIN"
          value={value.sinProductCode || undefined}
          disabled={disabled}
          ariaInvalid={Boolean(errors?.sinProductCode)}
          onChange={(code) => onChange({ ...value, sinProductCode: code ?? "" })}
        />
        {errors?.sinProductCode ? (
          <p className="text-sm text-destructive">{errors.sinProductCode}</p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <SiatCatalogPicker
          id={`${idPrefix}-unit`}
          catalog="units"
          label="Unidad de medida"
          value={value.sinUnitCode || undefined}
          disabled={disabled}
          ariaInvalid={Boolean(errors?.sinUnitCode)}
          onChange={(code) => onChange({ ...value, sinUnitCode: code ?? "" })}
        />
        {errors?.sinUnitCode ? (
          <p className="text-sm text-destructive">{errors.sinUnitCode}</p>
        ) : null}
      </div>
    </div>
  )
}

/** The three codes are required together in the bulk and default flows. */
export function validateCompleteSinCodes(
  value: SinCodes,
): Partial<Record<keyof SinCodes, string>> {
  const errors: Partial<Record<keyof SinCodes, string>> = {}
  const message = "Obligatorio"
  if (!value.sinActivityCode) errors.sinActivityCode = message
  if (!value.sinProductCode) errors.sinProductCode = message
  if (!value.sinUnitCode) errors.sinUnitCode = message
  return errors
}
