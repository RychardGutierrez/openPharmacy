"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useBulkAssignSin } from "@/features/products/api/use-product-sin"
import { SinCodesFields } from "@/features/products/components/sin-codes-fields"
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from "@/features/products/types"

const SCOPE_SELECTED = "selected"
const SCOPE_CATEGORY = "category"

const bulkSinSchema = z
  .object({
    scope: z.enum([SCOPE_SELECTED, SCOPE_CATEGORY]),
    category: z.enum(PRODUCT_CATEGORIES).optional(),
    sinActivityCode: z.string(),
    sinProductCode: z.string(),
    sinUnitCode: z.string(),
    overwrite: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const required = "Obligatorio"
    if (!values.sinActivityCode)
      ctx.addIssue({ code: "custom", path: ["sinActivityCode"], message: required })
    if (!values.sinProductCode)
      ctx.addIssue({ code: "custom", path: ["sinProductCode"], message: required })
    if (!values.sinUnitCode)
      ctx.addIssue({ code: "custom", path: ["sinUnitCode"], message: required })
    if (values.scope === SCOPE_CATEGORY && !values.category)
      ctx.addIssue({
        code: "custom",
        path: ["category"],
        message: "Elige una categoría",
      })
  })

type BulkSinValues = z.infer<typeof bulkSinSchema>

export interface ProductSinBulkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Products selected in the table. */
  selectedIds: string[]
  /** Called after a successful assignment, so the table can clear its selection. */
  onDone?: () => void
}

/**
 * Assigns one set of SIN codes to the selected products, or to a whole category (SIAT-08).
 * Products that already have complete codes are kept unless the overwrite switch is on.
 */
export function ProductSinBulkDialog({
  open,
  onOpenChange,
  selectedIds,
  onDone,
}: ProductSinBulkDialogProps) {
  const mutation = useBulkAssignSin()
  const form = useForm<BulkSinValues>({
    resolver: zodResolver(bulkSinSchema),
    defaultValues: {
      scope: selectedIds.length > 0 ? SCOPE_SELECTED : SCOPE_CATEGORY,
      category: "OTC",
      sinActivityCode: "",
      sinProductCode: "",
      sinUnitCode: "",
      overwrite: false,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        scope: selectedIds.length > 0 ? SCOPE_SELECTED : SCOPE_CATEGORY,
        category: "OTC",
        sinActivityCode: "",
        sinProductCode: "",
        sinUnitCode: "",
        overwrite: false,
      })
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const scope = form.watch("scope")
  const category = form.watch("category")
  const overwrite = form.watch("overwrite")
  const sinActivityCode = form.watch("sinActivityCode")
  const sinProductCode = form.watch("sinProductCode")
  const sinUnitCode = form.watch("sinUnitCode")
  const errors = form.formState.errors

  const onSubmit = (values: BulkSinValues) => {
    if (values.scope === SCOPE_SELECTED && selectedIds.length === 0) {
      form.setError("root", { message: "Selecciona al menos un producto." })
      return
    }
    mutation.mutate(
      {
        productIds: values.scope === SCOPE_SELECTED ? selectedIds : undefined,
        category: values.scope === SCOPE_CATEGORY ? values.category : undefined,
        sinActivityCode: values.sinActivityCode,
        sinProductCode: values.sinProductCode,
        sinUnitCode: values.sinUnitCode,
        overwrite: values.overwrite,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          onDone?.()
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asignar códigos SIN</DialogTitle>
          <DialogDescription>
            Aplica la misma actividad, producto y unidad a varios productos. Los productos que ya
            tienen códigos completos no cambian, salvo que actives la sustitución.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <div className="grid gap-2">
            <Label htmlFor="bulk-sin-scope">Aplicar a</Label>
            <Select
              value={scope}
              onValueChange={(next) =>
                form.setValue("scope", next as typeof scope, { shouldValidate: true })
              }
            >
              <SelectTrigger id="bulk-sin-scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SCOPE_SELECTED} disabled={selectedIds.length === 0}>
                  Productos seleccionados ({selectedIds.length})
                </SelectItem>
                <SelectItem value={SCOPE_CATEGORY}>Una categoría completa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === SCOPE_CATEGORY ? (
            <div className="grid gap-2">
              <Label htmlFor="bulk-sin-category">Categoría</Label>
              <Select
                value={category}
                onValueChange={(next) =>
                  form.setValue("category", next as BulkSinValues["category"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="bulk-sin-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {PRODUCT_CATEGORY_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category ? (
                <p className="text-sm text-destructive">{errors.category.message}</p>
              ) : null}
            </div>
          ) : null}

          <SinCodesFields
            idPrefix="bulk-sin"
            value={{ sinActivityCode, sinProductCode, sinUnitCode }}
            onChange={(next) => {
              form.setValue("sinActivityCode", next.sinActivityCode, {
                shouldValidate: form.formState.isSubmitted,
              })
              form.setValue("sinProductCode", next.sinProductCode, {
                shouldValidate: form.formState.isSubmitted,
              })
              form.setValue("sinUnitCode", next.sinUnitCode, {
                shouldValidate: form.formState.isSubmitted,
              })
            }}
            errors={{
              sinActivityCode: errors.sinActivityCode?.message,
              sinProductCode: errors.sinProductCode?.message,
              sinUnitCode: errors.sinUnitCode?.message,
            }}
          />

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="grid gap-0.5">
              <Label htmlFor="bulk-sin-overwrite">Reemplazar códigos existentes</Label>
              <p className="text-xs text-muted-foreground">
                Sustituye los códigos completos que ya tengan los productos.
              </p>
            </div>
            <Switch
              id="bulk-sin-overwrite"
              checked={overwrite}
              onCheckedChange={(checked) => form.setValue("overwrite", checked)}
            />
          </div>

          {errors.root ? (
            <p className="text-sm text-destructive">{errors.root.message}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="min-w-32">
              {mutation.isPending ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                  <span>Aplicando…</span>
                </>
              ) : (
                <span>Asignar códigos</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
