"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { CalendarIcon, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { ProductPicker } from "@/features/lots/components/product-picker"
import {
  lotFormSchema,
  type Lot,
  type LotFormValues,
} from "@/features/lots/types"
import { parseDecimalInput } from "@/shared/utils/format"
import { cn } from "@/lib/utils"

export interface LotFormProps {
  mode?: "create" | "edit"
  productId?: string
  defaultValues?: Partial<LotFormValues>
  onSubmit: (values: LotFormValues) => void | Promise<void>
  submitLabel?: string
  isPending?: boolean
}

const EMPTY_DEFAULTS: LotFormValues = {
  productId: undefined,
  lotNumber: "",
  expiryDate: "",
  initialQty: 0,
  reason: undefined,
}

export function LotForm({
  mode = "create",
  productId,
  defaultValues,
  onSubmit,
  submitLabel = "Guardar",
  isPending = false,
}: LotFormProps) {
  const form = useForm<LotFormValues>({
    resolver: zodResolver(lotFormSchema),
    defaultValues: {
      ...EMPTY_DEFAULTS,
      productId,
      ...defaultValues,
    },
  })

  const showProductPicker = mode === "create" && !productId

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(
          onSubmit,
          (errors) => {
            console.error("LotForm validation errors", errors)
          },
        )}
        noValidate
        className="flex flex-col gap-5"
      >
        {showProductPicker ? (
          <FormField
            control={form.control}
            name="productId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Producto</FormLabel>
                <FormControl>
                  <ProductPicker
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <FormField
          control={form.control}
          name="lotNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número de lote</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ej. LOT-2026-001"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="expiryDate"
          render={({ field }) => {
            const selectedDate = field.value ? new Date(field.value) : undefined
            return (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha de vencimiento</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {field.value ? (
                          format(selectedDate as Date, "PPP")
                        ) : (
                          <span>Seleccionar fecha</span>
                        )}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (!date) return
                        const year = date.getFullYear()
                        const month = String(date.getMonth() + 1).padStart(2, "0")
                        const day = String(date.getDate()).padStart(2, "0")
                        field.onChange(`${year}-${month}-${day}`)
                      }}
                      disabled={(date) => {
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        return date < today
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )
          }}
        />

        <FormField
          control={form.control}
          name="initialQty"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cantidad inicial</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={999999}
                  step={1}
                  placeholder="0"
                  value={field.value ?? 0}
                  onChange={(event) =>
                    field.onChange(
                      Math.trunc(
                        Math.max(0, parseDecimalInput(event.target.value)),
                      ),
                    )
                  }
                  disabled={mode === "edit"}
                />
              </FormControl>
              <FormMessage />
              {mode === "edit" ? (
                <p className="text-xs text-muted-foreground">
                  La cantidad inicial no se puede modificar una vez creado el
                  lote.
                </p>
              ) : null}
            </FormItem>
          )}
        />

        {mode === "edit" ? (
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Razón de corrección</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Ej. Corrección de typo en el número de lote"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={isPending} className="min-w-32">
            {isPending ? (
              <>
                <LoaderCircle
                  className="mr-2 size-4 animate-spin"
                  aria-hidden="true"
                />
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

export function buildLotFormDefaults(lot?: Lot): Partial<LotFormValues> {
  if (!lot) return {}
  return {
    productId: lot.productId,
    lotNumber: lot.lotNumber,
    expiryDate: lot.expiryDate.split("T")[0],
    initialQty: lot.initialQty,
    reason: "",
  }
}
