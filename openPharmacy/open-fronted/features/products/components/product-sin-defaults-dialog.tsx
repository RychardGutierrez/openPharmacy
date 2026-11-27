"use client"

import { useState } from "react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  useApplySinDefault,
  useSetSinDefault,
  useSinDefaults,
} from "@/features/products/api/use-product-sin"
import { SinCodesFields } from "@/features/products/components/sin-codes-fields"
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type ProductCategory,
  type SinCategoryDefault,
} from "@/features/products/types"

const defaultSinSchema = z.object({
  sinActivityCode: z.string().min(1, "Obligatorio"),
  sinProductCode: z.string().min(1, "Obligatorio"),
  sinUnitCode: z.string().min(1, "Obligatorio"),
})
type DefaultSinValues = z.infer<typeof defaultSinSchema>

export interface ProductSinDefaultsDialogProps {
  children: React.ReactNode
}

/**
 * Category defaults (SIAT-08). A product without complete codes takes its category default at
 * sale time, and "Aplicar" copies the default onto those products.
 */
export function ProductSinDefaultsDialog({ children }: ProductSinDefaultsDialogProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ProductCategory | null>(null)
  const defaults = useSinDefaults(open)
  const apply = useApplySinDefault()

  const byCategory = new Map<ProductCategory, SinCategoryDefault>(
    (defaults.data ?? []).map((row) => [row.category, row]),
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setEditing(null)
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Códigos SIN por categoría</DialogTitle>
          <DialogDescription>
            Un producto sin códigos propios usa el código de su categoría al vender. «Aplicar»
            copia el código a los productos de esa categoría que aún no tienen códigos completos.
          </DialogDescription>
        </DialogHeader>

        {defaults.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : defaults.error ? (
          <p className="text-sm text-destructive">No se pudieron cargar los códigos por defecto.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {PRODUCT_CATEGORIES.map((category) => {
              const current = byCategory.get(category)
              return (
                <li key={category} className="flex flex-col gap-3 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="grid gap-0.5">
                      <span className="text-sm font-medium">
                        {PRODUCT_CATEGORY_LABELS[category]}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {current
                          ? `${current.sin_activity_code} · ${current.sin_product_code} · ${current.sin_unit_code}`
                          : "Sin código por defecto"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(editing === category ? null : category)}
                      >
                        {editing === category ? "Cerrar" : "Editar"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={!current || apply.isPending}
                        onClick={() => apply.mutate(category)}
                      >
                        Aplicar a productos
                      </Button>
                    </div>
                  </div>

                  {editing === category ? (
                    <DefaultEditor
                      category={category}
                      initial={
                        current
                          ? {
                              sinActivityCode: current.sin_activity_code,
                              sinProductCode: current.sin_product_code,
                              sinUnitCode: current.sin_unit_code,
                            }
                          : { sinActivityCode: "", sinProductCode: "", sinUnitCode: "" }
                      }
                      onSaved={() => setEditing(null)}
                    />
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DefaultEditor({
  category,
  initial,
  onSaved,
}: {
  category: ProductCategory
  initial: DefaultSinValues
  onSaved: () => void
}) {
  const save = useSetSinDefault()
  const form = useForm<DefaultSinValues>({
    resolver: zodResolver(defaultSinSchema),
    defaultValues: initial,
  })
  const values = form.watch()
  const errors = form.formState.errors

  const onSubmit = (next: DefaultSinValues) => {
    save.mutate(
      { category, codes: next },
      { onSuccess: () => onSaved() },
    )
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="grid gap-4 rounded-md bg-muted/40 p-3"
    >
      <SinCodesFields
        idPrefix={`default-sin-${category}`}
        value={values}
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
      <DialogFooter>
        <Button type="submit" disabled={save.isPending} className="min-w-32">
          {save.isPending ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden="true" />
              <span>Guardando…</span>
            </>
          ) : (
            <span>Guardar por defecto</span>
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}
