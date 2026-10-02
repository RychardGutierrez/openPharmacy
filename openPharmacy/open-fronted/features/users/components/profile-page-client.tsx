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
  currentPassword: z.string().min(1, "La contraseña actual es obligatoria"),
  newPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128),
  confirmPassword: z.string().min(8, "Confirma tu nueva contraseña").max(128),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
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

  if (isLoading || !profile) return <p className="text-sm text-muted-foreground">Cargando perfil...</p>

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">Mantén seguros los datos y el acceso a tu cuenta.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle>Datos personales</CardTitle><CardDescription>Aquí solo puedes cambiar tu nombre.</CardDescription></CardHeader>
          <CardContent>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit((values) => updateProfile.mutate(values))} className="flex flex-col gap-5">
                <FormField control={profileForm.control} name="fullName" render={({ field }) => <FormItem><FormLabel>Nombre completo</FormLabel><FormControl><Input autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ReadOnly label="Correo electrónico" value={profile.email} />
                  <ReadOnly label="Rol" value={USER_ROLE_LABELS[profile.role]} />
                  <ReadOnly label="CI" value={profile.ci} />
                  <ReadOnly label="Número de registro" value={profile.regNumber || "No registrado"} />
                </div>
                <Button type="submit" disabled={updateProfile.isPending} className="w-fit">{updateProfile.isPending ? <><LoaderCircle className="animate-spin" /> Guardando...</> : "Guardar cambios"}</Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" />Cambiar contraseña</CardTitle><CardDescription>Todas las demás sesiones se cerrarán después de cambiarla.</CardDescription></CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit((values) => changePassword.mutate(values))} className="flex flex-col gap-4">
                <PasswordField form={passwordForm} name="currentPassword" label="Contraseña actual" />
                <PasswordField form={passwordForm} name="newPassword" label="Nueva contraseña" autoComplete="new-password" />
                <PasswordField form={passwordForm} name="confirmPassword" label="Confirmar nueva contraseña" autoComplete="new-password" />
                <Button type="submit" disabled={changePassword.isPending}>{changePassword.isPending ? <><LoaderCircle className="animate-spin" /> Actualizando...</> : "Actualizar contraseña"}</Button>
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
