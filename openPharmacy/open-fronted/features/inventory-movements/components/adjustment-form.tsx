"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ProductPicker } from "@/features/lots/components/product-picker"
import { useLotsByProduct } from "@/features/lots/api/use-lots-by-product"
import { parseDecimalInput } from "@/shared/utils/format"
import {
  ADJUSTMENT_DIRECTIONS,
  ADJUSTMENT_DIRECTION_LABELS,
  createAdjustmentFormSchema,
  type CreateAdjustmentFormValues,
} from "@/features/inventory-movements/types"

export interface AdjustmentFormProps {
  defaultValues?: Partial<CreateAdjustmentFormValues>
  onSubmit: (values: CreateAdjustmentFormValues) => void | Promise<void>
  submitLabel?: string
  isPending?: boolean
}

const EMPTY_DEFAULTS: CreateAdjustmentFormValues = {
  productId: "",
  lotId: "",
  direction: "INCREASE",
  quantity: 1,
  reason: "",
}

export function AdjustmentForm({
  defaultValues,
  onSubmit,
  submitLabel = "Enviar solicitud",
  isPending = false,
}: AdjustmentFormProps) {
  const form = useForm<CreateAdjustmentFormValues>({
    resolver: zodResolver(createAdjustmentFormSchema),
    defaultValues: { ...EMPTY_DEFAULTS, ...defaultValues },
  })

  const productId = form.watch("productId")
  const reason = form.watch("reason") ?? ""
  const reasonLength = reason.length
  const reasonValid = reasonLength >= 20

  const { data: lots, isLoading: lotsLoading } = useLotsByProduct(productId)

  useEffect(() => {
    if (!productId) {
      form.setValue("lotId", "")
    }
  }, [productId, form])

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-5"
      >
        <FormField
          control={form.control}
          name="productId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Producto</FormLabel>
              <FormControl>
                <ProductPicker
                  value={field.value || undefined}
                  onChange={(value) => {
                    field.onChange(value ?? "")
                    form.setValue("lotId", "")
                  }}
                  placeholder="Buscar producto…"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="lotId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lote</FormLabel>
              <Select
                value={field.value || undefined}
                onValueChange={field.onChange}
                disabled={!productId || lotsLoading}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        productId
                          ? "Seleccionar lote"
                          : "Primero selecciona un producto"
                      }
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {lots?.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.lotNumber} ({lot.currentQty} unidades)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="direction"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ADJUSTMENT_DIRECTIONS.map((direction) => (
                    <SelectItem key={direction} value={direction}>
                      {ADJUSTMENT_DIRECTION_LABELS[direction]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cantidad</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={999999}
                  step={1}
                  placeholder="0"
                  value={field.value ?? 0}
                  onChange={(event) =>
                    field.onChange(
                      Math.trunc(parseDecimalInput(event.target.value)),
                    )
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Motivo</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Explica por qué se necesita este ajuste…"
                  rows={4}
                  {...field}
                />
              </FormControl>
              <div className="flex items-center justify-between">
                <FormMessage />
                <span
                  className={`text-xs tabular-nums ${
                    reasonValid ? "text-muted-foreground" : "text-destructive"
                  }`}
                >
                  {reasonLength} / 20
                </span>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="submit"
            disabled={isPending || !form.formState.isValid}
            className="min-w-32"
          >
            {isPending ? (
              <>
                <LoaderCircle
                  className="mr-2 size-4 animate-spin"
                  aria-hidden="true"
                />
                <span>Enviando…</span>
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
