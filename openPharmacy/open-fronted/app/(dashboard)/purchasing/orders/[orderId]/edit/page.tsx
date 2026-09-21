"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft, X } from "lucide-react"
import { useRouter } from "next/navigation"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PurchaseOrderForm } from "@/features/purchase-orders/components/purchase-order-form"
import { usePurchaseOrder } from "@/features/purchase-orders/api/use-purchase-orders"

export default function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const router = useRouter()
  const { orderId } = use(params)
  const query = usePurchaseOrder(orderId)

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (query.error || !query.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudo cargar la orden</AlertTitle>
        <AlertDescription>
          {query.error?.message ?? "Inténtalo de nuevo."}
        </AlertDescription>
        <div className="mt-3 flex gap-2">
          <Button asChild variant="outline">
            <Link href="/purchasing/orders">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Volver al listado
            </Link>
          </Button>
        </div>
      </Alert>
    )
  }

  if (query.data.status !== "PENDING") {
    return (
      <Alert variant="destructive">
        <AlertTitle>Edición no permitida</AlertTitle>
        <AlertDescription>
          Solo se pueden editar órdenes en estado Borrador.
        </AlertDescription>
        <div className="mt-3 flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/purchasing/orders/${orderId}`}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Volver al detalle
            </Link>
          </Button>
        </div>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm" className="size-9">
            <Link href="/purchasing/orders" aria-label="Volver al listado">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Editar borrador
            </h1>
            <p className="text-sm text-muted-foreground">
              Modifica proveedor, fecha y productos antes de enviar la orden.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/purchasing/orders/${orderId}`}>
            <X className="size-4" aria-hidden="true" />
            Cancelar y volver
          </Link>
        </Button>
      </header>
      <PurchaseOrderForm
        order={query.data}
        onSaved={() => router.push(`/purchasing/orders/${orderId}`)}
      />
    </div>
  )
}
