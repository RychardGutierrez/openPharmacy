"use client"

import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { PurchaseOrderForm } from "@/features/purchase-orders/components/purchase-order-form"

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon-sm" className="size-9">
              <Link href="/purchasing/orders" aria-label="Volver al listado">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Nueva orden de compra
              </h1>
              <p className="text-sm text-muted-foreground">
                Selecciona un proveedor y agrega los productos a solicitar.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/purchasing/orders">
              <Plus className="size-4" aria-hidden="true" />
              Cancelar y volver
            </Link>
          </Button>
        </div>
      </header>
      <PurchaseOrderForm onSaved={(id) => router.push(`/purchasing/orders/${id}`)} />
    </div>
  )
}
