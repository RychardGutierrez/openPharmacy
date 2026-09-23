"use client"

import { Truck } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SupplierEmptyPanel() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Detalles del proveedor</CardTitle>
        <CardDescription>
          Selecciona un proveedor de la lista para ver sus detalles y órdenes recientes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
        <Truck className="size-10 stroke-1" aria-hidden="true" />
        <p className="text-sm">Ningún proveedor seleccionado.</p>
      </CardContent>
    </Card>
  )
}
