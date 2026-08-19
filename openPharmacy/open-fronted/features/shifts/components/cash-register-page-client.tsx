"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Clock3 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuthStore } from "@/features/auth/store/auth-store"
import { useCloseShift } from "@/features/shifts/api/use-close-shift"
import { useCurrentShift } from "@/features/shifts/api/use-current-shift"
import { useShiftHistory } from "@/features/shifts/api/use-shift-history"
import { useShiftSales } from "@/features/shifts/api/use-shift-sales"
import { useOpenShift } from "@/features/shifts/api/use-open-shift"
import { ReopenRequestDialog } from "@/features/shifts/components/reopen-request-dialog"
import { ShiftCloseCard } from "@/features/shifts/components/shift-close-card"
import { ShiftOpenCard } from "@/features/shifts/components/shift-open-card"
import { useShiftStore } from "@/features/shifts/store/shift-store"
import type { Shift, ShiftCloseResponse } from "@/features/shifts/types"
import { formatCurrencyBOB } from "@/shared/utils/format"

export function CashRegisterPageClient() {
  const user = useAuthStore((state) => state.user)
  const setOpenShift = useShiftStore((state) => state.setOpenShift)
  const clearOpenShift = useShiftStore((state) => state.clearOpenShift)
  const hydrated = useShiftStore((state) => state.hydrated)
  const currentQuery = useCurrentShift()
  const historyQuery = useShiftHistory()
  const openMutation = useOpenShift()
  const closeMutation = useCloseShift()
  const [closedShift, setClosedShift] = useState<Shift | null>(null)
  const [closeResult, setCloseResult] = useState<ShiftCloseResponse | null>(null)
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const [reopenRequested, setReopenRequested] = useState(false)
  const [reviewedShift, setReviewedShift] = useState<Shift | null>(null)
  // Hooks must run before the loading and auth guards below.
  const activeShift = currentQuery.data ?? null
  const salesQuery = useShiftSales(activeShift?.id)
  const reviewedSalesQuery = useShiftSales(reviewedShift?.id)
  const closedShifts = (historyQuery.data ?? []).filter((shift) => shift.status === "CLOSED")

  useEffect(() => {
    if (currentQuery.isLoading || currentQuery.data === undefined) return
    if (currentQuery.data) setOpenShift(currentQuery.data)
    else clearOpenShift()
  }, [clearOpenShift, currentQuery.data, currentQuery.isLoading, setOpenShift])

  if (!hydrated || currentQuery.isLoading) return <div className="text-sm text-muted-foreground">Verificando el turno en la base de datos...</div>
  if (!user) return null
  if (currentQuery.isError) {
    return <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>No se pudo verificar el estado del turno. <button type="button" className="font-medium underline" onClick={() => void currentQuery.refetch()}>Reintentar</button></AlertDescription></Alert>
  }

  const handleClose = async (values: { closingCash: number }) => {
    if (!activeShift) return
    try {
      const result = await closeMutation.mutateAsync({ id: activeShift.id, values })
      setClosedShift(result.shift)
      setCloseResult(result)
    } catch {
      // The mutation toast contains the user-facing API error.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Caja registradora</h1>
        <p className="text-sm text-muted-foreground">Controla la apertura y el cierre de tu turno.</p>
      </div>
      {!activeShift && !closedShift ? (
        <>
          <Alert><AlertCircle aria-hidden="true" /><AlertDescription>Solo puede haber un turno activo por cajero.</AlertDescription></Alert>
          <ShiftOpenCard cashierName={user.fullName} onSubmit={async (values) => { try { await openMutation.mutateAsync(values) } catch { /* The mutation toast contains the API error. */ } }} isPending={openMutation.isPending} />
        </>
      ) : activeShift ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="size-5 text-primary" aria-hidden="true" />Turno activo</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Estado</span><Badge>Abierto</Badge></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Apertura</span><strong>{formatCurrencyBOB(activeShift.openingCash)}</strong></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Inicio</span><span>{new Date(activeShift.openedAt).toLocaleString("es-BO")}</span></div>
              <div className="border-t pt-4 text-xs text-muted-foreground">El efectivo esperado se muestra como provisional hasta que el backend cierre y reconcilie el turno.</div>
            </CardContent>
          </Card>
          <ShiftCloseCard shift={activeShift} cashierName={user.fullName} sales={salesQuery.data} onSubmit={handleClose} isPending={closeMutation.isPending} />
        </div>
      ) : closedShift ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-green-600" aria-hidden="true" />Turno cerrado</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div><p className="text-muted-foreground">Apertura</p><strong>{formatCurrencyBOB(closedShift.openingCash)}</strong></div>
              <div><p className="text-muted-foreground">Efectivo contado</p><strong>{formatCurrencyBOB(closeResult?.countedCash ?? closedShift.closingCash ?? 0)}</strong></div>
              <div><p className="text-muted-foreground">Diferencia</p><strong>{formatCurrencyBOB(closeResult?.difference ?? 0)}</strong></div>
            </div>
            {reopenRequested ? <Alert><AlertDescription>Solicitud de reapertura pendiente de revisión.</AlertDescription></Alert> : <Button variant="outline" className="sm:w-fit" disabled={Boolean(activeShift)} title={activeShift ? "Cierra primero el turno activo" : undefined} onClick={() => setReopenDialogOpen(true)}>Solicitar reapertura</Button>}
            <ReopenRequestDialog shiftId={closedShift.id} open={reopenDialogOpen} onOpenChange={setReopenDialogOpen} onSuccess={() => setReopenRequested(true)} />
            <div className="text-xs text-muted-foreground">Para consultar otros turnos cerrados se necesitará el historial de turnos.</div>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader><CardTitle>Historial de cierres</CardTitle></CardHeader>
        <CardContent>
          {historyQuery.isLoading ? <p className="text-sm text-muted-foreground">Cargando cierres...</p> : historyQuery.error ? <p className="text-sm text-destructive">No se pudo cargar el historial.</p> : closedShifts.length === 0 ? <p className="text-sm text-muted-foreground">Aún no tienes turnos cerrados.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Fecha de cierre</TableHead><TableHead>Apertura</TableHead><TableHead>Efectivo contado</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
              <TableBody>{closedShifts.map((shift) => { const pending = shift.id === closedShift?.id && reopenRequested; return <TableRow key={shift.id}><TableCell>{shift.closedAt ? new Date(shift.closedAt).toLocaleString("es-BO") : "-"}</TableCell><TableCell>{formatCurrencyBOB(shift.openingCash)}</TableCell><TableCell>{formatCurrencyBOB(shift.closingCash ?? 0)}</TableCell><TableCell><div className="flex justify-end gap-2">{pending ? <span className="text-sm text-muted-foreground">Solicitud pendiente</span> : <Button variant="outline" size="sm" disabled={Boolean(activeShift)} title={activeShift ? "Cierra primero el turno activo" : undefined} onClick={() => { setClosedShift(shift); setReopenRequested(false); setReopenDialogOpen(true) }}>Solicitar reapertura</Button>}<Button variant="ghost" size="sm" onClick={() => setReviewedShift(shift)}>Revisar</Button></div></TableCell></TableRow> })}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={Boolean(reviewedShift)} onOpenChange={(open) => { if (!open) setReviewedShift(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revisión del turno</DialogTitle><DialogDescription>Consulta la información registrada antes de solicitar una reapertura.</DialogDescription></DialogHeader>
          {reviewedShift ? <div className="flex flex-col gap-5"><dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted-foreground">Estado</dt><dd>{reviewedShift.status === "CLOSED" ? "Cerrado" : "Abierto"}</dd></div><div><dt className="text-muted-foreground">Apertura</dt><dd>{formatCurrencyBOB(reviewedShift.openingCash)}</dd></div><div><dt className="text-muted-foreground">Efectivo contado</dt><dd>{formatCurrencyBOB(reviewedShift.closingCash ?? 0)}</dd></div><div><dt className="text-muted-foreground">Efectivo esperado</dt><dd>{reviewedShift.expectedCash === null ? "Pendiente" : formatCurrencyBOB(reviewedShift.expectedCash)}</dd></div><div className="col-span-2"><dt className="text-muted-foreground">Cierre</dt><dd>{reviewedShift.closedAt ? new Date(reviewedShift.closedAt).toLocaleString("es-BO") : "Pendiente"}</dd></div></dl><div><h3 className="mb-2 text-sm font-semibold">Productos vendidos</h3>{reviewedSalesQuery.isLoading ? <p className="text-sm text-muted-foreground">Cargando ventas...</p> : reviewedSalesQuery.data?.products.length ? <div className="max-h-60 overflow-y-auto rounded border text-sm">{reviewedSalesQuery.data.products.map((product) => <div key={product.productId} className="flex justify-between gap-3 border-b px-3 py-2 last:border-0"><span>{product.name}</span><span className="shrink-0">{product.quantity} · {formatCurrencyBOB(product.total)}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No hay ventas registradas.</p>}</div></div> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
