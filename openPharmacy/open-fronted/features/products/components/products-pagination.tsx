"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

export interface ProductsPaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function ProductsPagination({
  page,
  totalPages,
  onPageChange,
}: ProductsPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-sm text-muted-foreground">
        Página {page} de {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
