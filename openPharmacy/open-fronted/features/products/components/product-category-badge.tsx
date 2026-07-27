import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  PRODUCT_CATEGORY_LABELS,
  type ProductCategory,
} from "@/features/products/types"

const categoryVariants: Record<ProductCategory, string> = {
  OTC: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  PRESCRIPTION_ONLY:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  PSYCHOTROPIC:
    "bg-destructive/10 text-destructive dark:bg-destructive/20",
  NARCOTIC:
    "bg-destructive/10 text-destructive dark:bg-destructive/20",
  NON_PHARMACEUTICAL:
    "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
}

export interface ProductCategoryBadgeProps {
  category: ProductCategory
  className?: string
}

export function ProductCategoryBadge({ category, className }: ProductCategoryBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        categoryVariants[category],
        className,
      )}
    >
      {PRODUCT_CATEGORY_LABELS[category]}
    </Badge>
  )
}
