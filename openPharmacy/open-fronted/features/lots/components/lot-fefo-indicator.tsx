import { ChevronUp } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface LotFefoIndicatorProps {
  isNext: boolean
  className?: string
}

export function LotFefoIndicator({ isNext, className }: LotFefoIndicatorProps) {
  if (!isNext) return null
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-slot="lot-fefo-indicator"
            aria-label="Próximo a dispensar (FEFO)"
            className={cn(
              "inline-flex items-center justify-center rounded-full bg-primary/10 p-0.5 text-primary",
              className,
            )}
          >
            <ChevronUp className="size-4" aria-hidden="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Próximo a dispensar (FEFO)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
