"use client"

import { useState } from "react"
import { Check, ExternalLink, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useApproveReopenRequest, useRejectReopenRequest, useReopenShiftDirectly } from "@/features/shifts/api/use-reopen-actions"
import { usePendingReopenRequests } from "@/features/shifts/api/use-pending-reopen-requests"
import type { ShiftReopenRequestWithRelations } from "@/features/shifts/types"
import { formatCurrencyBOB } from "@/shared/utils/format"

type Action = "approve" | "reject" | "direct" | null

export function ReopenRequestsPageClient() {
  const query = usePendingReopenRequests()
  const approve = useApproveReopenRequest()
  const reject = useRejectReopenRequest()
  const direct = useReopenShiftDirectly()
  const [selected, setSelected] = useState<{ request: ShiftReopenRequestWithRelations; action: Action } | null>(null)

  const confirm = async () => {
    if (!selected) return
    const { request, action } = selected
    try {
      if (action === "approve") await approve.mutateAsync(request.id)
      if (action === "reject") await reject.mutateAsync(request.id)
      if (action === "direct") await direct.mutateAsync(request.shift.id)
      setSelected(null)
    } catch {
      // The mutation toast contains the user-facing API error.
    }
  }
  const pending = approve.isPending || reject.isPending || direct.isPending

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Solicitudes de reapertura</h1><p className="text-sm text-muted-foreground">Revisa las solicitudes pendientes de los turnos cerrados.</p></div>
      <Card><CardHeader><CardTitle>Solicitudes pendientes</CardTitle></CardHeader><CardContent>
        {query.isLoading ? <p className="text-sm text-muted-foreground">Cargando solicitudes...</p> : query.error ? <Alert variant="destructive"><AlertDescription>{query.error.message}</AlertDescription></Alert> : query.data?.length ? (
          <Table><TableHeader><TableRow><TableHead>Solicitante</TableHead><TableHead>Turno</TableHead><TableHead>Motivo</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>
            {query.data.map((request) => <RequestRow key={request.id} request={request} onAction={(action) => setSelected({ request, action })} />)}
          </TableBody></Table>
        ) : <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>}
      </CardContent></Card>
      <AlertDialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{selected?.action === "approve" ? "Aprobar reapertura" : selected?.action === "reject" ? "Rechazar solicitud" : "Reabrir turno directamente"}</AlertDialogTitle><AlertDialogDescription>{selected?.action === "direct" ? "Esta acción reabrirá el turno y rechazará solicitudes pendientes asociadas." : "Confirma que deseas aplicar esta acción."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); void confirm() }}>{pending ? "Procesando..." : "Confirmar"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RequestRow({ request, onAction }: { request: ShiftReopenRequestWithRelations; onAction: (action: Exclude<Action, null>) => void }) {
  const [expanded, setExpanded] = useState(false)
  return <>
    <TableRow aria-expanded={expanded}>
      <TableCell><div className="font-medium">{request.requester.fullName}</div><div className="text-xs text-muted-foreground">{request.requester.email}</div></TableCell>
      <TableCell><div className="font-mono text-xs">{request.shift.id.slice(0, 8)}...</div><div className="text-xs">{formatCurrencyBOB(request.shift.openingCash)}</div></TableCell>
      <TableCell className="max-w-56"><button type="button" className="truncate text-left underline decoration-dotted" onClick={() => setExpanded(!expanded)}>{request.reason}</button></TableCell>
      <TableCell>{new Date(request.createdAt).toLocaleDateString("es-BO")}</TableCell>
      <TableCell><div className="flex justify-end gap-1"><Button size="icon-sm" variant="ghost" aria-label={`Aprobar solicitud de ${request.requester.fullName}`} onClick={() => onAction("approve")}><Check className="size-4 text-green-600" /></Button><Button size="icon-sm" variant="ghost" aria-label={`Rechazar solicitud de ${request.requester.fullName}`} onClick={() => onAction("reject")}><X className="size-4 text-destructive" /></Button><Button size="icon-sm" variant="ghost" aria-label={`Reabrir directamente el turno de ${request.requester.fullName}`} onClick={() => onAction("direct")}><ExternalLink className="size-4" /></Button></div></TableCell>
    </TableRow>
    {expanded ? <TableRow><TableCell colSpan={5} className="whitespace-normal bg-muted/30"><strong>Motivo completo:</strong> {request.reason}</TableCell></TableRow> : null}
  </>
}
