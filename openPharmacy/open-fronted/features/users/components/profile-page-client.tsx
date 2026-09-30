"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { LoaderCircle, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useChangePassword, useProfile, useUpdateProfile } from "@/features/users/api/use-profile"
import { USER_ROLE_LABELS } from "@/features/users/types"

const profileSchema = z.object({ fullName: z.string().min(2, "Full name must be at least 2 characters").max(100) })
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
  confirmPassword: z.string().min(8, "Please confirm your new password").max(128),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type ProfileValues = z.infer<typeof profileSchema>
type PasswordValues = z.infer<typeof passwordSchema>

export function ProfilePageClient() {
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const profileForm = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { fullName: "" } })
  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } })

  useEffect(() => {
    if (profile) profileForm.reset({ fullName: profile.fullName })
  }, [profile, profileForm])

  if (isLoading || !profile) return <p className="text-sm text-muted-foreground">Loading profile...</p>

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My profile</h1>
        <p className="text-sm text-muted-foreground">Keep your account details and access secure.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle>Personal details</CardTitle><CardDescription>Only your name can be changed here.</CardDescription></CardHeader>
          <CardContent>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit((values) => updateProfile.mutate(values))} className="flex flex-col gap-5">
                <FormField control={profileForm.control} name="fullName" render={({ field }) => <FormItem><FormLabel>Full name</FormLabel><FormControl><Input autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ReadOnly label="Email" value={profile.email} />
                  <ReadOnly label="Role" value={USER_ROLE_LABELS[profile.role]} />
                  <ReadOnly label="CI" value={profile.ci} />
                  <ReadOnly label="Registration number" value={profile.regNumber || "Not provided"} />
                </div>
                <Button type="submit" disabled={updateProfile.isPending} className="w-fit">{updateProfile.isPending ? <><LoaderCircle className="animate-spin" /> Saving...</> : "Save changes"}</Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" />Change password</CardTitle><CardDescription>All other sessions will be signed out after a successful change.</CardDescription></CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit((values) => changePassword.mutate(values))} className="flex flex-col gap-4">
                <PasswordField form={passwordForm} name="currentPassword" label="Current password" />
                <PasswordField form={passwordForm} name="newPassword" label="New password" autoComplete="new-password" />
                <PasswordField form={passwordForm} name="confirmPassword" label="Confirm new password" autoComplete="new-password" />
                <Button type="submit" disabled={changePassword.isPending}>{changePassword.isPending ? <><LoaderCircle className="animate-spin" /> Updating...</> : "Update password"}</Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-2"><span className="text-sm font-medium">{label}</span><div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{value}</div></div>
}

function PasswordField({ form, name, label, autoComplete = "current-password" }: { form: ReturnType<typeof useForm<PasswordValues>>; name: keyof PasswordValues; label: string; autoComplete?: string }) {
  return <FormField control={form.control} name={name} render={({ field }) => <FormItem><FormLabel>{label}</FormLabel><FormControl><Input type="password" autoComplete={autoComplete} {...field} /></FormControl><FormMessage /></FormItem>} />
}
