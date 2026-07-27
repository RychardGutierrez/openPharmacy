"use client"

import {
  AlertTriangle,
  BoxSelect,
  Flower2,
  Pill,
  ShieldAlert,
  Stethoscope,
  type LucideIcon,
} from "lucide-react"
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_DESCRIPTIONS, PRODUCT_CATEGORY_LABELS, type ProductCategory } from "@/features/products/types"
import { cn } from "@/lib/utils"

const categoryConfig: Record<
  ProductCategory,
  { icon: LucideIcon; accent: string }
> = {
  OTC: { icon: Pill, accent: "text-emerald-600" },
  PRESCRIPTION_ONLY: { icon: Stethoscope, accent: "text-amber-600" },
  PSYCHOTROPIC: { icon: ShieldAlert, accent: "text-destructive" },
  NARCOTIC: { icon: AlertTriangle, accent: "text-destructive" },
  NON_PHARMACEUTICAL: { icon: Flower2, accent: "text-sky-600" },
}

export interface CategoryCardGroupProps {
  value: ProductCategory | undefined
  onChange: (value: ProductCategory) => void
  name: string
  required?: boolean
}

/**
 * Accessible radio group of five product category cards. Each card shows the
 * category label, a short description, and a category icon. The selected card
 * receives a primary ring to match the design system.
 */
export function CategoryCardGroup({
  value,
  onChange,
  name,
  required = false,
}: CategoryCardGroupProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Categoría del producto"
      aria-required={required}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {PRODUCT_CATEGORIES.map((category) => {
        const isSelected = value === category
        const { icon: Icon, accent } = categoryConfig[category]
        return (
          <button
            key={category}
            type="button"
            role="radio"
            name={name}
            aria-checked={isSelected}
            data-state={isSelected ? "checked" : "unchecked"}
            onClick={() => onChange(category)}
            className={cn(
              "flex flex-col items-start gap-1 border bg-card p-3 text-left transition-all outline-none",
              isSelected
                ? "border-primary ring-2 ring-primary/30"
                : "border-border hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
          >
            <div className="flex items-center gap-2">
              <BoxSelect className={cn("size-4", accent)} aria-hidden="true" />
              <Icon className={cn("size-4", accent)} aria-hidden="true" />
              <span className="text-sm font-medium">
                {PRODUCT_CATEGORY_LABELS[category]}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {PRODUCT_CATEGORY_DESCRIPTIONS[category]}
            </p>
          </button>
        )
      })}
    </div>
  )
}
