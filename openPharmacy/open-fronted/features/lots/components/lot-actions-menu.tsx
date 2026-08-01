"use client"

import { Edit, MoreHorizontal, Search, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Lot } from "@/features/lots/types"

export interface LotActionsMenuProps {
  lot: Lot | null
  align?: "start" | "end"
  onEdit?: (lot: Lot) => void
  onVoid?: (lot: Lot) => void
  onTrace?: (lot: Lot) => void
  disabled?: boolean
}

export function LotActionsMenu({
  lot,
  align = "end",
  onEdit,
  onVoid,
  onTrace,
  disabled = false,
}: LotActionsMenuProps) {
  const isVoided = Boolean(lot?.voidedAt)
  const hasStock = (lot?.currentQty ?? 0) > 0

  return (
    <TooltipProvider delayDuration={100}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Acciones del lote"
                disabled={disabled}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          {disabled ? (
            <TooltipContent side="top">
              <p>Selecciona un lote de la tabla</p>
            </TooltipContent>
          ) : null}
        </Tooltip>
        <DropdownMenuContent align={align}>
          <DropdownMenuItem
            onSelect={() => lot && onEdit?.(lot)}
            disabled={disabled || isVoided || !lot}
          >
            <Edit className="mr-2 size-4" aria-hidden="true" />
            <span>Editar</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => lot && onVoid?.(lot)}
            disabled={disabled || isVoided || hasStock || !lot}
          >
            <Trash2 className="mr-2 size-4" aria-hidden="true" />
            <span>Anular</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => lot && onTrace?.(lot)}
            disabled={disabled || !lot}
          >
            <Search className="mr-2 size-4" aria-hidden="true" />
            <span>Trazabilidad</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  )
}
