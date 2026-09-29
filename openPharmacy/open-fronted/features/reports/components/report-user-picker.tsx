"use client"

import { useRef, useState } from "react"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useUserLookup } from "@/features/inventory-movements/api/use-user-lookup"
import { useDebounce } from "@/shared/hooks/use-debounce"
import { useClickOutside } from "@/shared/hooks/use-click-outside"

export function ReportUserPicker({
  value,
  onChange,
}: {
  value?: string
  onChange: (value: string | undefined) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const debounced = useDebounce(search, 250)
  const { data: users = [], isFetching } = useUserLookup(debounced)

  useClickOutside(ref, () => setOpen(false), open)

  return (
    <div ref={ref} className="grid gap-2">
      <label htmlFor="report-user" className="text-sm font-medium leading-none">
        Usuario / cajero
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id="report-user"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls="report-user-list"
          value={search}
          placeholder={value ? "Usuario seleccionado" : "Buscar usuario…"}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setSearch(event.target.value)
            setOpen(true)
          }}
          className="h-9 w-full rounded-lg border border-input bg-transparent py-1 pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              onChange(undefined)
              setSearch("")
              setOpen(false)
            }}
            className="absolute right-0 top-1/2 size-8 -translate-y-1/2 text-muted-foreground"
            aria-label="Limpiar usuario"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
        {open ? (
          <div id="report-user-list" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-card shadow-md">
            {isFetching ? <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p> : null}
            {!isFetching && users.length === 0 && debounced.trim().length >= 2 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</p>
            ) : null}
            {users.length > 0 ? (
              <ul className="py-1" role="listbox">
                {users.map((user) => (
                  <li key={user.id} role="option" aria-selected={value === user.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        onChange(user.id)
                        setSearch(user.fullName)
                        setOpen(false)
                      }}
                    >
                      <span className="block font-medium">{user.fullName}</span>
                      <span className="block text-xs text-muted-foreground">{user.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
