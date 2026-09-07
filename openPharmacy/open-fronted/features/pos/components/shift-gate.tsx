"use client"

import { useState } from "react"
import { LockKeyholeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrencyBOB } from "@/shared/utils/format"
import { useShiftGate } from "@/features/pos/hooks/use-shift-gate"
import { SHIFT_STATUS_LABELS } from "@/features/shifts/types"

export function ShiftGate() {
  const { shift, isLoading, isOpen, openShift, isOpening } = useShiftGate()
  const [openingCash, setOpeningCash] = useState("")

  if (isLoading) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted-foreground">
        Verificando turno…
      </div>
    )
  }

  if (isOpen && shift) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
        <span className="size-2 rounded-full bg-green-500" aria-hidden="true" />
        Turno #{shift.id.slice(0, 8)} ·{" "}
        {SHIFT_STATUS_LABELS[shift.status]} ·{" "}
        Fondo {formatCurrencyBOB(shift.openingCash)}
      </div>
    )
  }

  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-accent">
          <LockKeyholeIcon className="size-6 text-accent-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="font-serif text-lg font-semibold">
            No hay turno abierto
          </h2>
          <p className="text-sm text-muted-foreground">
            Necesitas abrir un turno con tu fondo de caja para registrar
            ventas.
          </p>
        </div>
        <div className="w-full space-y-2">
          <Label htmlFor="opening-cash" className="sr-only">
            Fondo de caja
          </Label>
          <Input
            id="opening-cash"
            inputMode="decimal"
            placeholder="Fondo de caja (Bs)"
            value={openingCash}
            onChange={(event) => setOpeningCash(event.target.value)}
            className="h-11 text-center font-mono text-lg"
          />
          <Button
            className="h-11 w-full font-bold"
            disabled={isOpening || openingCash.trim().length === 0}
            onClick={() => openShift(Number(openingCash.replace(",", ".")) || 0)}
          >
            {isOpening ? "Abriendo…" : "Abrir turno"}
          </Button>
        </div>
      </div>
    </div>
  )
}
