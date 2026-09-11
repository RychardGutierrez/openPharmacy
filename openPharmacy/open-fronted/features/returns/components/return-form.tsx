"use client"

import { LoaderCircle, Printer } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrencyBOB } from "@/shared/utils/format"
import {
  RETURN_TYPE_LABELS,
  type ReturnFormValues,
} from "@/features/returns/types"

export interface ReturnFormProps {
  form: UseFormReturn<ReturnFormValues>
  selectedCount: number
  refund: number
  isPending: boolean
  canSubmit: boolean
  onSubmit: (values: ReturnFormValues) => void
}

export function ReturnFormCard({
  form,
  selectedCount,
  refund,
  isPending,
  canSubmit,
  onSubmit,
}: ReturnFormProps) {
  const refundDisplay = Number.isFinite(refund) ? refund : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Datos de la devolución</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
          >
            <FormField
              control={form.control}
              name="returnType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de devolución</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex gap-4"
                    >
                      {(["FULL", "PARTIAL"] as const).map((type) => (
                        <div key={type} className="flex items-center gap-2">
                          <RadioGroupItem
                            value={type}
                            id={`return-type-${type}`}
                          />
                          <label
                            htmlFor={`return-type-${type}`}
                            className="text-sm font-medium"
                          >
                            {RETURN_TYPE_LABELS[type]}
                          </label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
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
                      placeholder="Describa el motivo de la devolución…"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">
                Líneas seleccionadas
              </p>
              <p className="text-lg font-medium">{selectedCount}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Monto a reembolsar
              </p>
              <p
                className="text-2xl font-semibold"
                aria-live="polite"
                aria-atomic="true"
              >
                {formatCurrencyBOB(refundDisplay)}
              </p>
            </div>

            <Button
              type="submit"
              disabled={!canSubmit || isPending}
              className="min-w-32 self-end"
            >
              {isPending ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                  <span>Procesando…</span>
                </>
              ) : (
                <>
                  <Printer className="size-4" aria-hidden="true" />
                  <span>Confirmar e imprimir</span>
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
