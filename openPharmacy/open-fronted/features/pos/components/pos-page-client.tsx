"use client"

import { useEffect, useMemo, useState } from "react"
import { LoaderCircle, PrinterIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { usePosStore } from "@/features/pos/store/pos-store"
import { useShiftGate } from "@/features/pos/hooks/use-shift-gate"
import { useThermalPrint } from "@/features/pos/hooks/use-thermal-print"
import { useSale } from "@/features/pos/api/use-sale"
import {
  isPrescriptionCategory,
  type SaleReceipt,
} from "@/features/pos/types"
import { ProductBrowser } from "@/features/pos/components/product-browser"
import { CartPanel } from "@/features/pos/components/cart-panel"
import { PaymentDialog } from "@/features/pos/components/payment-dialog"
import { PrescriptionGateDialog } from "@/features/pos/components/prescription-gate-dialog"
import { ShiftGate } from "@/features/pos/components/shift-gate"
import { ThermalReceipt } from "@/features/pos/components/thermal-receipt"

let didHydrate = false

export function PosPageClient() {
  const hydrate = usePosStore((state) => state.hydrate)
  const lines = usePosStore((state) => state.lines)
  const lastSale = usePosStore((state) => state.lastSale)
  const lastSaleId = usePosStore((state) => state.lastSaleId)

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [rxDialogOpen, setRxDialogOpen] = useState(false)
  const [rxAcks, setRxAcks] = useState<string[]>([])

  const { isLoading, isOpen } = useShiftGate()
  const { data: fetchedLastSale } = useSale(
    lastSale ? undefined : (lastSaleId ?? undefined),
  )

  useEffect(() => {
    if (didHydrate) return
    didHydrate = true
    hydrate()
  }, [hydrate])

  const rxPendingLines = useMemo(
    () =>
      lines.filter(
        (line) =>
          isPrescriptionCategory(line.category) &&
          !rxAcks.includes(line.productId),
      ),
    [lines, rxAcks],
  )

  const receiptToPrint: SaleReceipt | null = lastSale ?? fetchedLastSale ?? null
  const reprint = useThermalPrint(lastSale)

  function handleCheckout() {
    if (rxPendingLines.length > 0) {
      setRxDialogOpen(true)
      return
    }
    setPaymentOpen(true)
  }

  function handleRxConfirmed(ackedIds: string[]) {
    setRxAcks((current) => [...new Set([...current, ...ackedIds])])
    setRxDialogOpen(false)
    setPaymentOpen(true)
  }

  if (isLoading) {
    return (
      <div className="grid h-64 place-items-center">
        <LoaderCircle
          className="size-6 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    )
  }

  if (!isOpen) {
    return <ShiftGate />
  }

  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[1.7fr_1fr]">
      <div className="flex min-w-0 flex-col gap-4">
        <ProductBrowser />
      </div>

      <div className="min-h-0 xl:sticky xl:top-0 xl:h-[calc(100vh-7rem)]">
        <CartPanel onCheckout={handleCheckout} />
      </div>

      <PrescriptionGateDialog
        open={rxDialogOpen}
        pendingLines={rxPendingLines}
        onConfirm={handleRxConfirmed}
        onCancel={() => setRxDialogOpen(false)}
      />

      <PaymentDialog
        key={paymentOpen ? "payment-open" : "payment-closed"}
        open={paymentOpen}
        onOpenChange={(open) => {
          setPaymentOpen(open)
          if (!open) setRxAcks([])
        }}
        onReprint={reprint}
        prescriptionProductIds={lines
          .filter((line) => isPrescriptionCategory(line.category))
          .map((line) => line.productId)}
      />

      {receiptToPrint && (
        <>
          <ThermalReceipt receipt={receiptToPrint} />
          <Button
            variant="outline"
            size="sm"
            className="fixed bottom-4 right-4 z-40 gap-2 shadow-lg print:hidden"
            onClick={reprint}
            aria-label="Reimprimir última venta"
          >
            <PrinterIcon aria-hidden="true" />
            {lastSale?.receiptNumber ?? lastSaleId?.slice(0, 8)}
          </Button>
        </>
      )}
    </div>
  )
}
