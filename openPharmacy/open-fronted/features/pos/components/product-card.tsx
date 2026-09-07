"use client"

import { memo } from "react"
import { TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCurrencyBOB } from "@/shared/utils/format"
import {
  PRODUCT_CATEGORY_LABELS,
  type Product,
  type ProductCategory,
} from "@/features/products/types"
import { useAddProduct } from "@/features/pos/hooks/use-add-product"

const CATEGORY_TONE: Record<ProductCategory, string> = {
  OTC: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  PRESCRIPTION_ONLY:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  PSYCHOTROPIC:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  NARCOTIC: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  NON_PHARMACEUTICAL:
    "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
}

interface ProductCardProps {
  product: Product
}

export const ProductCard = memo(function ProductCard({
  product,
}: ProductCardProps) {
  const { add } = useAddProduct()
  const stock = product.stockSummary
  const out = stock ? stock.availableQty <= 0 : false

  return (
    <button
      type="button"
      onClick={() => void add(product)}
      disabled={out}
      className={cn(
        "group/card flex h-full min-h-28 flex-col items-start gap-1 rounded-lg border bg-card p-3 text-left",
        "transition-all hover:border-primary/60 hover:bg-accent/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-card",
      )}
      aria-label={`Agregar ${product.commercialName}, ${formatCurrencyBOB(product.salePrice)}`}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-semibold leading-snug">
          {product.commercialName}{" "}
          <span className="text-xs text-muted-foreground">
            ({product.barcode})
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            CATEGORY_TONE[product.category],
          )}
        >
          {PRODUCT_CATEGORY_LABELS[product.category]}
        </span>
      </div>
      <span className="line-clamp-1 text-xs text-muted-foreground">
        {product.dciName}
        {product.concentration ? ` · ${product.concentration}` : ""}
      </span>
      <span className="line-clamp-1 text-xs text-muted-foreground">
        {product.form ? ` ${product.form}` : ""}
      </span>
      <div className="mt-auto flex w-full items-end justify-between pt-1">
        <span className="font-mono text-base font-bold text-primary">
          {formatCurrencyBOB(product.salePrice)}
        </span>
        <span
          className={cn(
            "font-mono text-xs",
            out
              ? "font-semibold text-destructive"
              : (stock?.expiringSoon ?? false)
                ? "font-semibold text-red-600 dark:text-red-400"
                : "text-muted-foreground",
          )}
        >
          {stock
            ? out
              ? "Sin stock"
              : `${stock.availableQty} u`
            : "— u"}
        </span>
      </div>
      {stock?.expiringSoon && !out && (
        <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
          <TriangleAlert className="size-3" aria-hidden="true" />
          Vence en {stock.daysUntilExpiry} d
        </span>
      )}
    </button>
  )
})
