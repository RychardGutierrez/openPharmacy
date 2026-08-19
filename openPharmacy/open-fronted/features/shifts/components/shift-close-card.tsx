"use client"

import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Info, LoaderCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { closeShiftFormSchema, type CloseShiftFormValues, type Shift, type ShiftSales } from "@/features/shifts/types"
import { formatCurrencyBOB, parseDecimalInput } from "@/shared/utils/format"
import { ZReportButton } from "@/features/shifts/components/z-report-button"

export function ShiftCloseCard({ shift, cashierName, sales, onSubmit, isPending = false }: {
  shift: Shift
  cashierName: string
  sales?: ShiftSales
  onSubmit: (values: CloseShiftFormValues) => void | Promise<void>
  isPending?: boolean
}) {
  const form = useForm<CloseShiftFormValues>({ resolver: zodResolver(closeShiftFormSchema) as Resolver<CloseShiftFormValues>, defaultValues: { closingCash: 0 } })
  const countedCash = Number(form.watch("closingCash") ?? 0)
  const difference = countedCash - shift.openingCash
  const hasCount = Boolean(form.formState.dirtyFields.closingCash)
  return (
    <Card>
      <CardHeader><CardTitle>Cerrar turno</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
          <div><dt className="text-muted-foreground">Apertura</dt><dd className="font-medium">{formatCurrencyBOB(shift.openingCash)}</dd></div>
          <div><dt className="text-muted-foreground">Ventas en efectivo</dt><dd className="font-medium">{formatCurrencyBOB(0)}</dd></div>
          <div><dt className="text-muted-foreground">Ventas con tarjeta</dt><dd className="font-medium"><Tooltip><TooltipTrigger asChild><span className="cursor-help underline decoration-dotted">—</span></TooltipTrigger><TooltipContent>Disponible cuando el módulo de ventas esté activo.</TooltipContent></Tooltip></dd></div>
          <div><dt className="text-muted-foreground">Efectivo esperado (provisional)</dt><dd className="font-medium">{formatCurrencyBOB(shift.openingCash)}</dd></div>
        </dl>
        <section aria-labelledby="sold-products-title" className="flex flex-col gap-3">
          <h3 id="sold-products-title" className="text-sm font-semibold">Productos vendidos</h3>
          {!sales || sales.products.length === 0 ? <p className="text-sm text-muted-foreground">No hay ventas registradas en este turno.</p> : <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/40"><tr><th className="px-3 py-2 text-left font-medium">Producto</th><th className="px-3 py-2 text-right font-medium">Cantidad</th><th className="px-3 py-2 text-right font-medium">Total</th></tr></thead><tbody>{sales.products.map((product) => <tr key={product.productId} className="border-t"><td className="px-3 py-2">{product.name}</td><td className="px-3 py-2 text-right">{product.quantity}</td><td className="px-3 py-2 text-right">{formatCurrencyBOB(product.total)}</td></tr>)}</tbody><tfoot className="border-t bg-muted/20 font-medium"><tr><td className="px-3 py-2">Total ({sales.totals.distinctProducts} productos)</td><td className="px-3 py-2 text-right">{sales.totals.units}</td><td className="px-3 py-2 text-right">{formatCurrencyBOB(sales.totals.netSales)}</td></tr></tfoot></table></div>}
        </section>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <FormField control={form.control} name="closingCash" render={({ field }) => (
              <FormItem>
                <FormLabel>Efectivo contado (Bs)</FormLabel>
                <FormControl><Input type="number" min="0" step="0.01" inputMode="decimal" {...field} value={Number(field.value ?? 0)} onChange={(event) => field.onChange(parseDecimalInput(event.target.value))} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {hasCount && difference !== 0 ? (
              <Alert variant={difference < 0 ? "destructive" : "default"} role={difference < 0 ? "alert" : "status"} aria-live={difference < 0 ? "assertive" : "polite"}>
                {difference < 0 ? <AlertTriangle aria-hidden="true" /> : <Info aria-hidden="true" />}
                <AlertDescription>{difference < 0 ? `Faltante de ${formatCurrencyBOB(Math.abs(difference))} en caja` : `Sobrante de ${formatCurrencyBOB(difference)} en caja`}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <ZReportButton shift={shift} cashierName={cashierName} sales={sales} />
              <Button type="submit" disabled={!hasCount || isPending} aria-describedby={!hasCount ? "counted-cash-help" : undefined}>
                {isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                Cerrar turno
              </Button>
            </div>
            {!hasCount ? <p id="counted-cash-help" className="text-xs text-muted-foreground">Ingresa el efectivo contado para cerrar el turno.</p> : null}
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
