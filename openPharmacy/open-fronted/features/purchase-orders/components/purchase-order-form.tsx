"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Plus, Save, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DatePicker } from "@/features/purchase-orders/components/date-picker"
import {
  parseCurrency,
  parseQuantity,
} from "@/features/purchase-orders/components/purchase-order-line-table"
import { ProductPickerDialog } from "@/features/purchase-orders/components/product-picker-dialog"
import { PurchaseOrderLineTable } from "@/features/purchase-orders/components/purchase-order-line-table"
import { SubmitPurchaseOrderDialog } from "@/features/purchase-orders/components/submit-purchase-order-dialog"
import { SupplierPicker } from "@/features/purchase-orders/components/supplier-picker"
import {
  useCreatePurchaseOrder,
  useLastSupplierCost,
  useSubmitPurchaseOrder,
  useSuppliers,
  useUpdatePurchaseOrder,
} from "@/features/purchase-orders/api/use-purchase-orders"
import { useSupplierById } from "@/features/purchase-orders/api/use-supplier-by-id"
import { formatCurrencyBOB } from "@/shared/utils/format"
import type { PurchaseOrder } from "@/features/purchase-orders/types"
import type { Product } from "@/features/products/types"

const DEFAULT_DATE = new Date().toISOString().slice(0, 10)

/**
 * Quantities and unit costs are stored as raw strings so the inputs do
 * not auto-prepend or auto-step values. The form parses them through
 * `parseQuantity` / `parseCurrency` for totals and for the payload sent
 * to the backend.
 */
interface DraftLine {
  productId: string
  productName: string
  qtyOrdered: string
  unitCost: string
}

export interface PurchaseOrderFormProps {
  /** Existing order when editing. When undefined, the form creates a new draft. */
  order?: PurchaseOrder
  /** Called after create/update with the saved order id. */
  onSaved?: (orderId: string) => void
}

export function PurchaseOrderForm({ order, onSaved }: PurchaseOrderFormProps) {
  const router = useRouter()
  const isEdit = Boolean(order)
  const [supplierId, setSupplierId] = useState<string>(
    order?.supplierId ?? "",
  )
  const [orderDate, setOrderDate] = useState<string>(
    order?.orderDate ?? DEFAULT_DATE,
  )
  const [lines, setLines] = useState<DraftLine[]>(() =>
    order
      ? order.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          qtyOrdered: String(item.qtyOrdered),
          unitCost: String(item.unitCost),
        }))
      : [],
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  /**
   * After we save a brand-new draft (because the user clicked "Enviar al
   * proveedor" before saving), we keep the form mounted, store the new id
   * here, and use it as the submit target.
   */
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)

  const suppliersQuery = useSuppliers()
  const initialSupplierQuery = useSupplierById(order?.supplierId)
  const createOrder = useCreatePurchaseOrder()
  const updateOrder = useUpdatePurchaseOrder()
  const submitOrder = useSubmitPurchaseOrder()

  const selectedSupplierName =
    initialSupplierQuery.data?.name ??
    suppliersQuery.data?.find((s) => s.id === supplierId)?.name ??
    order?.supplierName ??
    ""

  const targetOrderId = order?.id ?? createdOrderId

  const excludedIds = useMemo(
    () => new Set(lines.map((l) => l.productId)),
    [lines],
  )

  const totalEstimate = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = parseQuantity(line.qtyOrdered) ?? 0
        const cost = parseCurrency(line.unitCost) ?? 0
        return sum + qty * cost
      }, 0),
    [lines],
  )

  const canSave =
    lines.length > 0 && supplierId.length > 0 && orderDate.length > 0

  const updateLine = (productId: string, patch: Partial<DraftLine>) =>
    setLines((prev) =>
      prev.map((line) =>
        line.productId === productId ? { ...line, ...patch } : line,
      ),
    )

  const onQuantityChange = (productId: string, value: string) =>
    updateLine(productId, { qtyOrdered: value })

  const onCostChange = (productId: string, value: string) =>
    updateLine(productId, { unitCost: value })

  const addLines = (products: Product[]) => {
    const existing = new Set(lines.map((line) => line.productId))
    const fresh = products.filter((product) => !existing.has(product.id))
    const skipped = products.length - fresh.length
    if (fresh.length === 0) return
    setLines((prev) => [
      ...prev,
      ...fresh.map((product) => ({
        productId: product.id,
        productName: product.commercialName,
        qtyOrdered: "",
        unitCost: "",
      })),
    ])
    if (skipped > 0) {
      toast.warning(
        skipped === 1
          ? "Un producto ya estaba en la orden y se omitió"
          : `${skipped} productos ya estaban en la orden y se omitieron`,
      )
    }
  }

  const removeLine = (productId: string) =>
    setLines((prev) => prev.filter((line) => line.productId !== productId))

  const handleAddClick = () => {
    if (!supplierId) {
      toast.warning("Selecciona un proveedor antes de agregar productos")
      return
    }
    setPickerOpen(true)
  }

  /**
   * Validate every draft line. Returns a user-friendly Spanish error
   * pointing at the offending product, or `null` when everything is valid.
   *
   * Used by the save / send / confirm actions to surface a clear toast
   * before hitting the backend (which would otherwise return a NestJS
   * ValidationPipe error the user cannot interpret).
   */
  const validateLines = (): string | null => {
    if (lines.length === 0) return null
    for (const line of lines) {
      const qty = parseQuantity(line.qtyOrdered)
      if (qty === null) {
        return `La cantidad de "${line.productName}" debe ser un entero mayor o igual a 1.`
      }
      const cost = parseCurrency(line.unitCost)
      if (cost === null) {
        return `El costo unitario de "${line.productName}" debe ser un número mayor a 0 (máx. 2 decimales).`
      }
    }
    return null
  }

  const buildItemsForCreate = () =>
    lines.flatMap((line) => {
      const qty = parseQuantity(line.qtyOrdered)
      const cost = parseCurrency(line.unitCost)
      if (qty === null || cost === null) return []
      return [
        {
          productId: line.productId,
          qtyOrdered: qty,
          unitCost: cost,
        },
      ]
    })

  const buildItemsForUpdate = () =>
    lines.flatMap((line, idx) => {
      const qty = parseQuantity(line.qtyOrdered)
      const cost = parseCurrency(line.unitCost)
      if (qty === null || cost === null) return []
      return [
        {
          orderItemId: order?.items[idx]?.id ?? "",
          productId: line.productId,
          qtyOrdered: qty,
          unitCost: cost,
        },
      ]
    })

  const save = async () => {
    if (!canSave) {
      if (lines.length === 0) {
        toast.error("Agrega al menos un producto antes de guardar.")
      } else if (!supplierId) {
        toast.error("Selecciona un proveedor antes de guardar.")
      } else if (!orderDate) {
        toast.error("Selecciona la fecha de la orden antes de guardar.")
      }
      return
    }
    const validationError = validateLines()
    if (validationError) {
      toast.error(validationError)
      return
    }
    if (order) {
      const updated = await updateOrder.mutateAsync({
        id: order.id,
        payload: {
          supplierId,
          orderDate,
          items: buildItemsForUpdate(),
        },
      })
      onSaved?.(updated.id)
      return
    }
    if (createdOrderId) {
      const updated = await updateOrder.mutateAsync({
        id: createdOrderId,
        payload: {
          supplierId,
          orderDate,
          items: buildItemsForUpdate(),
        },
      })
      onSaved?.(updated.id)
      return
    }
    const created = await createOrder.mutateAsync({
      supplierId,
      orderDate,
      items: buildItemsForCreate(),
    })
    setCreatedOrderId(created.id)
    onSaved?.(created.id)
  }

  /**
   * Click handler for the primary "Enviar al proveedor" action.
   *
   *  - For a brand new draft we POST the order first so we have an id to
   *    submit against, then open the confirmation dialog.
   *  - For an existing draft we open the confirmation dialog directly; the
   *    confirmation handler will save any pending edits before submitting.
   */
  const handleSendClick = async () => {
    if (!supplierId) {
      toast.error("Selecciona un proveedor antes de enviar.")
      return
    }
    if (lines.length === 0) {
      toast.error("Agrega al menos un producto antes de enviar.")
      return
    }
    if (!orderDate) {
      toast.error("Selecciona la fecha de la orden antes de enviar.")
      return
    }
    const validationError = validateLines()
    if (validationError) {
      toast.error(validationError)
      return
    }
    if (!isEdit && !createdOrderId) {
      try {
        const created = await createOrder.mutateAsync({
          supplierId,
          orderDate,
          items: buildItemsForCreate(),
        })
        setCreatedOrderId(created.id)
      } catch {
        // Toast is rendered by the mutation's onError handler.
        return
      }
    }
    setSubmitOpen(true)
  }

  /**
   * Confirmed submit. Saves any unsaved edits before submitting so the order
   * moves from PENDING to ORDERED with the latest draft state.
   */
  const handleSubmitConfirm = async () => {
    const submitId = order?.id ?? createdOrderId
    if (!submitId || lines.length === 0) return

    const validationError = validateLines()
    if (validationError) {
      toast.error(validationError)
      setSubmitOpen(false)
      return
    }

    if (order) {
      const hasUnsavedSupplier = supplierId !== order.supplierId
      const hasUnsavedDate = orderDate !== order.orderDate
      const hasUnsavedLines =
        lines.length !== order.items.length ||
        lines.some((line, idx) => {
          const item = order.items[idx]
          if (!item) return true
          const lineCost = parseCurrency(line.unitCost)
          return (
            line.productId !== item.productId ||
            Number(line.qtyOrdered) !== item.qtyOrdered ||
            (lineCost === null
              ? item.unitCost !== 0
              : Math.abs(lineCost - item.unitCost) > 0.001)
          )
        })

      if (hasUnsavedSupplier || hasUnsavedDate || hasUnsavedLines) {
        await updateOrder.mutateAsync({
          id: order.id,
          payload: {
            supplierId,
            orderDate,
            items: buildItemsForUpdate(),
          },
        })
      }
    } else if (createdOrderId) {
      const created = await createOrder.mutateAsync({
        supplierId,
        orderDate,
        items: buildItemsForCreate(),
      })
      setCreatedOrderId(created.id)
      await submitOrder.mutateAsync(created.id)
      setSubmitOpen(false)
      onSaved?.(created.id)
      return
    }

    await submitOrder.mutateAsync(submitId)
    setSubmitOpen(false)
    onSaved?.(submitId)
  }

  const isPending =
    createOrder.isPending ||
    updateOrder.isPending ||
    submitOrder.isPending

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>
            {isEdit ? "Editar borrador" : "Nueva orden"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              {initialSupplierQuery.isLoading && order?.supplierId ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <SupplierPicker
                  value={supplierId || undefined}
                  onChange={(id) => setSupplierId(id ?? "")}
                />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="po-order-date"
                className="text-sm font-medium leading-none"
              >
                Fecha de la orden
              </label>
              <DatePicker
                id="po-order-date"
                value={orderDate}
                onChange={(next) => setOrderDate(next ?? "")}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Productos</h3>
            <Button
              type="button"
              size="sm"
              onClick={handleAddClick}
              disabled={!supplierId}
            >
              <Plus className="size-4" aria-hidden="true" />
              Agregar producto
            </Button>
          </div>

          <PurchaseOrderLineTable
            lines={lines}
            onQuantityChange={onQuantityChange}
            onCostChange={onCostChange}
            onRemove={removeLine}
          />
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader className="pb-3">
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Productos</dt>
              <dd className="font-medium">{lines.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Total estimado</dt>
              <dd
                className="text-xl font-semibold tabular-nums"
                aria-live="polite"
              >
                {formatCurrencyBOB(totalEstimate)}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canSave || isPending}
              onClick={save}
              className="w-full"
            >
              <Save className="size-4" aria-hidden="true" />
              {isEdit || createdOrderId
                ? "Guardar borrador"
                : "Crear borrador"}
            </Button>
            <Button
              type="button"
              disabled={!canSave || isPending}
              onClick={handleSendClick}
              className="w-full"
            >
              {isPending ? (
                <>
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                  Procesando…
                </>
              ) : (
                <>
                  <Send className="size-4" aria-hidden="true" />
                  Enviar al proveedor
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onConfirm={(products) => addLines(products)}
        excludeProductIds={excludedIds}
      />

      {targetOrderId ? (
        <SubmitPurchaseOrderDialog
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          supplierName={selectedSupplierName}
          orderDate={orderDate}
          itemCount={lines.length}
          totalEstimate={totalEstimate}
          isPending={isPending}
          onConfirm={handleSubmitConfirm}
        />
      ) : null}

      <LastCostPrefillTrigger
        supplierId={supplierId}
        lines={lines}
        onPrefill={(productId, unitCost) =>
          updateLine(productId, { unitCost: String(unitCost) })
        }
      />
    </div>
  )
}

interface LastCostPrefillTriggerProps {
  supplierId: string
  lines: DraftLine[]
  onPrefill: (productId: string, unitCost: string) => void
}

function LastCostPrefillTrigger({
  supplierId,
  lines,
  onPrefill,
}: LastCostPrefillTriggerProps) {
  const newest = lines.at(-1)
  const query = useLastSupplierCost(supplierId, newest?.productId)
  useEffect(() => {
    if (!query.data) return
    if (!newest) return
    if (newest.unitCost.trim() !== "") return
    onPrefill(newest.productId, String(query.data.unitCost))
  }, [query.data, newest, onPrefill])
  return null
}
