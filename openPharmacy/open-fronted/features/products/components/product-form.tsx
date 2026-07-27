"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle } from "lucide-react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { BarcodeUniquenessIndicator } from "@/features/products/components/barcode-uniqueness-indicator"
import { CategoryCardGroup } from "@/features/products/components/category-card-group"
import { ComplianceWarningBanner } from "@/features/products/components/compliance-warning-banner"
import {
  isControlledCategory,
  productFormSchema,
  type ProductFormValues,
} from "@/features/products/types"
import { parseDecimalInput } from "@/shared/utils/format"

export interface ProductFormProps {
  defaultValues?: Partial<ProductFormValues>
  currentBarcode?: string | null
  onSubmit: (values: ProductFormValues) => Promise<void> | void
  submitLabel?: string
  isPending?: boolean
}

const EMPTY_DEFAULTS: ProductFormValues = {
  dciName: "",
  commercialName: "",
  laboratory: undefined,
  form: undefined,
  concentration: undefined,
  barcode: "",
  category: "OTC",
  salePrice: 0,
  costPrice: 0,
  minStock: 0,
}

export function ProductForm({
  defaultValues,
  currentBarcode,
  onSubmit,
  submitLabel = "Guardar",
  isPending = false,
}: ProductFormProps) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: { ...EMPTY_DEFAULTS, ...defaultValues },
  })

  const category = form.watch("category")
  const barcode = form.watch("barcode")

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-5"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="dciName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre DCI</FormLabel>
                <FormControl>
                  <Input
                    placeholder="p. ej. Paracetamol"
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="commercialName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre comercial</FormLabel>
                <FormControl>
                  <Input
                    placeholder="p. ej. Panadol"
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="laboratory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Laboratorio</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Opcional"
                    autoComplete="off"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="form"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Forma farmacéutica</FormLabel>
                <FormControl>
                  <Input
                    placeholder="p. ej. Tableta"
                    autoComplete="off"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="concentration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Concentración</FormLabel>
                <FormControl>
                  <Input
                    placeholder="p. ej. 500mg"
                    autoComplete="off"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="barcode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Código de barras</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    inputMode="numeric"
                    placeholder="3 a 14 dígitos"
                    autoComplete="off"
                    {...field}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, "")
                      field.onChange(digits)
                    }}
                  />
                  <div className="absolute inset-y-0 right-2 flex items-center">
                    <BarcodeUniquenessIndicator
                      barcode={barcode}
                      currentBarcode={currentBarcode}
                    />
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <FormControl>
                <CategoryCardGroup
                  value={field.value}
                  onChange={field.onChange}
                  name={field.name}
                  required
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isControlledCategory(category) ? (
          <ComplianceWarningBanner />
        ) : null}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="salePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio de venta</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    autoComplete="off"
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(parseDecimalInput(event.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="costPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio de costo</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    autoComplete="off"
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(parseDecimalInput(event.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="minStock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock mínimo</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min={0}
                    placeholder="0"
                    autoComplete="off"
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(
                        Math.max(
                          0,
                          Math.trunc(parseDecimalInput(event.target.value)),
                        ),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={isPending} className="min-w-32">
            {isPending ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden="true" />
                <span>Guardando…</span>
              </>
            ) : (
              <span>{submitLabel}</span>
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}
