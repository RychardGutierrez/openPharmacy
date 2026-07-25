"use client"

import { LoaderCircle } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { User } from "@/features/users/types"

export interface UserDeactivateDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (user: User) => void
  isPending?: boolean
}

/**
 * Confirmation dialog for toggling a user's active status. The action
 * is a soft delete (deactivate) or restore (activate) — history is
 * preserved visually by keeping the user in the list.
 */
export function UserDeactivateDialog({
  user,
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: UserDeactivateDialogProps) {
  if (!user) return null
  const isActive = user.active

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isActive ? "Deactivate user" : "Activate user"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isActive
              ? `Deactivating ${user.fullName} will prevent them from signing in. Their history will be preserved.`
              : `Activating ${user.fullName} will restore their access to the system.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault()
              onConfirm(user)
            }}
          >
            {isPending ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden="true" />
                <span>Working…</span>
              </>
            ) : (
              <span>{isActive ? "Deactivate" : "Activate"}</span>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
