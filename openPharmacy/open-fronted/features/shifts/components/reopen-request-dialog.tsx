"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { useRequestReopen } from "@/features/shifts/api/use-request-reopen"
import { reopenRequestFormSchema, type ReopenRequestFormValues } from "@/features/shifts/types"

export function ReopenRequestDialog({ shiftId, open, onOpenChange, onSuccess }: { shiftId: string; open: boolean; onOpenChange: (open: boolean) => void; onSuccess?: () => void }) {
  const mutation = useRequestReopen()
  const form = useForm<ReopenRequestFormValues>({ resolver: zodResolver(reopenRequestFormSchema), defaultValues: { reason: "" } })
  const reason = form.watch("reason")
  const submit = async (values: ReopenRequestFormValues) => {
    try {
      await mutation.mutateAsync({ shiftId, values })
      form.reset()
      onSuccess?.()
      onOpenChange(false)
    } catch {
      // The mutation toast contains the user-facing API error.
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Solicitar reapertura</DialogTitle><DialogDescription>Un administrador debe revisar esta solicitud.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} noValidate className="flex flex-col gap-4">
            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem><FormLabel>Motivo</FormLabel><FormControl><Textarea {...field} maxLength={500} placeholder="Describe el error de conteo o cierre..." /></FormControl><p className="text-xs text-muted-foreground" aria-live="polite">{reason.length}/500 caracteres</p><FormMessage /></FormItem>
            )} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}Enviar solicitud</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
