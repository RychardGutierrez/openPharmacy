"use client"

import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle, WalletCards } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { openShiftFormSchema, type OpenShiftFormValues } from "@/features/shifts/types"
import { parseDecimalInput } from "@/shared/utils/format"

export function ShiftOpenCard({ cashierName, onSubmit, isPending = false }: {
  cashierName: string
  onSubmit: (values: OpenShiftFormValues) => void | Promise<void>
  isPending?: boolean
}) {
  const form = useForm<OpenShiftFormValues>({ resolver: zodResolver(openShiftFormSchema) as Resolver<OpenShiftFormValues>, defaultValues: { openingCash: 0 } })
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <WalletCards className="size-5 text-primary" aria-hidden="true" />
          <CardTitle>Abrir turno</CardTitle>
        </div>
        <CardDescription>Registra el efectivo inicial de tu caja.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
            <div className="grid gap-2">
              <label htmlFor="cashier-name" className="text-sm font-medium">Cajero</label>
              <Input id="cashier-name" value={cashierName} readOnly aria-readonly="true" />
            </div>
            <FormField control={form.control} name="openingCash" render={({ field }) => (
              <FormItem>
                <FormLabel>Efectivo de apertura (Bs)</FormLabel>
                <FormControl><Input type="number" min="0" step="0.01" inputMode="decimal" {...field} value={Number(field.value ?? 0)} onChange={(event) => field.onChange(parseDecimalInput(event.target.value))} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" disabled={isPending} className="sm:w-fit">
              {isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              Abrir turno
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
