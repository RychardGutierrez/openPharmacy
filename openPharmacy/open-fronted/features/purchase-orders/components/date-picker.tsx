"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface DatePickerProps {
  id?: string
  value: string | undefined
  onChange: (next: string | undefined) => void
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  minDate?: Date
  maxDate?: Date
  align?: "start" | "center" | "end"
  className?: string
  ariaInvalid?: boolean
  ariaDescribedBy?: string
}

function toIsoDate(date: Date): string {
  const local = new Date(date)
  local.setUTCHours(0, 0, 0, 0)
  return local.toISOString().slice(0, 10)
}

function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  required = false,
  disabled = false,
  minDate,
  maxDate,
  align = "start",
  className,
  ariaInvalid,
  ariaDescribedBy,
}: DatePickerProps) {
  const selected = parseIsoDate(value)
  const labelId = id ? `${id}-label` : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-labelledby={labelId}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-required={required}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start gap-2 text-left font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4" aria-hidden="true" />
          <span className="flex-1 truncate">
            {selected ? format(selected, "dd/MM/yyyy") : placeholder}
          </span>
          {selected && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Limpiar fecha"
              className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(event) => {
                event.stopPropagation()
                onChange(undefined)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  event.stopPropagation()
                  onChange(undefined)
                }
              }}
            >
              <XIcon className="size-3.5" aria-hidden="true" />
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => onChange(date ? toIsoDate(date) : undefined)}
          disabled={(date) =>
            Boolean(
              (minDate && new Date(date) < minDate) ||
                (maxDate && new Date(date) > maxDate),
            )
          }
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
