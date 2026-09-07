"use client"

import { useMemo, useState } from "react"
import { CheckCircle2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatCurrencyBOB } from "@/shared/utils/format"
import { useCreateSale } from "@/features/pos/api/use-create-sale"
import { computeCartTotals, usePosStore } from "@/features/pos/store/pos-store"
import { roundMoney } from "@/features/pos/lib/money"
import {
  MIXED_SECONDARY_METHODS,
  PAYMENT_METHOD_LABELS,
  type MixedSecondaryMethod,
  type PaymentMethod,
  type SaleReceipt,
} from "@/features/pos/types"

const QUICK_CASH = [20, 50, 100]

type Stage = "form" | "success"

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReprint: () => void
  prescriptionProductIds: string[]
}

export function PaymentDialog({
  open,
  onOpenChange,
  onReprint,
  prescriptionProductIds,
}: PaymentDialogProps) {
  const lines = usePosStore((state) => state.lines)
  const lastSale = usePosStore((state) => state.lastSale)
  const totals = useMemo(() => computeCartTotals(lines), [lines])

  const [stage, setStage] = useState<Stage>("form")
  const [method, setMethod] = useState<PaymentMethod>("CASH")
  const [secondaryMethod, setSecondaryMethod] =
    useState<MixedSecondaryMethod>("CARD")
  const [cashInput, setCashInput] = useState("")

  const createSale = useCreateSale()

  const cashReceived = roundMoney(Number(cashInput.replace(",", ".")) || 0)
  const change =
    method === "CASH" ? roundMoney(cashReceived - totals.total) : 0
  const mixedRest =
    method === "MIXED" ? roundMoney(totals.total - cashReceived) : 0

  const cashInvalid =
    (method === "CASH" && cashReceived < totals.total) ||
    (method === "MIXED" &&
      (cashReceived <= 0 || cashReceived >= totals.total))

  const canConfirm =
    method !== "CASH" && method !== "MIXED" ? true : !cashInvalid

  async function confirm() {
    if (!canConfirm) return
    try {
      await createSale.mutateAsync({
        items: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
        paymentMethod: method,
        secondaryMethod: method === "MIXED" ? secondaryMethod : undefined,
        discount: totals.discount > 0 ? totals.discount : undefined,
        cashReceived:
          method === "CASH" || method === "MIXED"
            ? cashReceived
            : undefined,
        prescriptionProductIds:
          prescriptionProductIds.length > 0
            ? prescriptionProductIds
            : undefined,
      })
      setStage("success")
    } catch {
      return
    }
  }

  function finishSale() {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={stage === "form"}
        onInteractOutside={(event) => {
          if (stage !== "form") event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (stage !== "form") event.preventDefault()
        }}
      >
        {stage === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">
                Cobrar venta
              </DialogTitle>
              <DialogDescription>
                Total a cobrar:{" "}
                <span className="font-mono text-base font-bold text-foreground">
                  {formatCurrencyBOB(totals.total)}
                </span>
              </DialogDescription>
            </DialogHeader>

            <div
              role="radiogroup"
              aria-label="Método de pago"
              className="grid grid-cols-5 gap-1.5"
            >
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(
                (option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={method === option}
                    onClick={() => setMethod(option)}
                    className={cn(
                      "rounded-lg border px-1 py-2.5 text-xs font-semibold transition-colors",
                      "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      method === option
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted",
                    )}
                  >
                    {PAYMENT_METHOD_LABELS[option]}
                  </button>
                ),
              )}
            </div>

            {(method === "CASH" || method === "MIXED") && (
              <div className="space-y-2">
                <Label htmlFor="pos-cash-received">Efectivo recibido</Label>
                <Input
                  id="pos-cash-received"
                  inputMode="decimal"
                  value={cashInput}
                  onChange={(event) => setCashInput(event.target.value)}
                  placeholder="0.00"
                  aria-invalid={cashInput.length > 0 && cashInvalid}
                  className={cn(
                    "h-11 font-mono text-lg",
                    cashInput.length > 0 && cashInvalid && "border-destructive",
                  )}
                />
                <div className="flex gap-1.5">
                  {QUICK_CASH.map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 font-mono"
                      onClick={() => setCashInput(String(amount))}
                    >
                      {amount}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 font-mono"
                    onClick={() => setCashInput(String(totals.total))}
                  >
                    Exacto
                  </Button>
                </div>
                {method === "CASH" ? (
                  <p
                    aria-live="polite"
                    className={cn(
                      "flex justify-between rounded-lg px-3 py-2 font-mono text-sm",
                      cashInvalid && cashInput.length > 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted",
                    )}
                  >
                    <span>Cambio</span>
                    <span className="font-bold">
                      {formatCurrencyBOB(Math.max(0, change))}
                    </span>
                  </p>
                ) : (
                  <p
                    aria-live="polite"
                    className={cn(
                      "flex justify-between rounded-lg px-3 py-2 font-mono text-sm",
                      cashInvalid && cashInput.length > 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted",
                    )}
                  >
                    <span>Resto en {PAYMENT_METHOD_LABELS[secondaryMethod]}</span>
                    <span className="font-bold">
                      {formatCurrencyBOB(Math.max(0, mixedRest))}
                    </span>
                  </p>
                )}
              </div>
            )}

            {method === "MIXED" && (
              <div className="space-y-2">
                <Label htmlFor="pos-secondary-method">
                  Método electrónico
                </Label>
                <Select
                  value={secondaryMethod}
                  onValueChange={(value) =>
                    setSecondaryMethod(value as MixedSecondaryMethod)
                  }
                >
                  <SelectTrigger id="pos-secondary-method" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MIXED_SECONDARY_METHODS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {PAYMENT_METHOD_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              className="h-12 w-full text-base font-bold"
              disabled={!canConfirm || createSale.isPending}
              onClick={() => void confirm()}
            >
              {createSale.isPending
                ? "Procesando…"
                : `Confirmar ${PAYMENT_METHOD_LABELS[method]}`}
            </Button>
          </>
        ) : (
          <PaymentSuccess receipt={lastSale} onNewSale={finishSale} onReprint={onReprint} />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface PaymentSuccessProps {
  receipt: SaleReceipt | null
  onNewSale: () => void
  onReprint: () => void
}

function PaymentSuccess({ receipt, onNewSale, onReprint }: PaymentSuccessProps) {
  if (!receipt) return null

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <CheckCircle2Icon
        className="size-14 text-green-600 dark:text-green-400"
        aria-hidden="true"
      />
      <DialogHeader className="items-center">
        <DialogTitle className="font-serif text-2xl">
          Venta completada
        </DialogTitle>
        <DialogDescription className="font-mono">
          Recibo Nº {receipt.receiptNumber}
        </DialogDescription>
      </DialogHeader>

      <dl className="w-full space-y-1 rounded-lg bg-muted p-3 font-mono text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="font-bold">{formatCurrencyBOB(receipt.total)}</dd>
        </div>
        {receipt.paymentMethod === "MIXED" && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              Efectivo + {PAYMENT_METHOD_LABELS[receipt.secondaryMethod ?? "CARD"]}
            </dt>
            <dd>
              {formatCurrencyBOB(receipt.cashReceived)} +{" "}
              {formatCurrencyBOB(roundMoney(receipt.total - receipt.cashReceived))}
            </dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Cambio</dt>
          <dd className="font-bold">{formatCurrencyBOB(receipt.changeGiven)}</dd>
        </div>
      </dl>

      <div className="flex w-full gap-2">
        <Button variant="outline" className="flex-1" onClick={onReprint}>
          Reimprimir
        </Button>
        <Button
          className="flex-1 font-bold"
          autoFocus
          onClick={onNewSale}
        >
          Nueva venta
        </Button>
      </div>
    </div>
  )
}
