'use client'

import { Card, PasswordInput, Button, Text, Stack } from '@mantine/core'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const schema = z.object({
  senhaAtual: z.string().min(3, 'Senha atual é obrigatória'),
  novaSenha: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
  confirmarSenha: z.string().min(6, 'Confirme a nova senha'),
}).refine((data) => data.novaSenha === data.confirmarSenha, {
  message: 'As senhas não conferem',
  path: ['confirmarSenha'],
})

type FormValues = z.infer<typeof schema>

export default function AlterarSenhaObrigatoriaPage() {
  const router = useRouter()
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { senhaAtual: '', novaSenha: '', confirmarSenha: '' },
  })

  async function onSubmit(data: FormValues) {
    try {
      await api.put('/auth/alterar-senha', {
        senhaAtual: data.senhaAtual,
        novaSenha: data.novaSenha,
      })

      // Atualizar o usuário no localStorage para não redirecionar novamente
      const userStr = localStorage.getItem('visiofab-wms-user')
      if (userStr) {
        const user = JSON.parse(userStr)
        user.primeiroLogin = false
        localStorage.setItem('visiofab-wms-user', JSON.stringify(user))
      }

      notifications.show({ title: 'Sucesso', message: 'Senha alterada com sucesso!', color: 'green' })
      router.push('/selecionar-empresa')
    } catch {
      notifications.show({ title: 'Erro', message: 'Não foi possível alterar a senha. Verifique a senha atual.', color: 'red' })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card shadow="md" padding="xl" radius="md" className="w-full max-w-md">
        <Stack gap="md" align="center" mb="xl">
          <Text size="xl" fw={700} c="primary">Vizor WMS</Text>
          <Text size="sm" c="dimmed">Primeiro Acesso — Altere sua senha</Text>
          <Text size="xs" c="dimmed" ta="center">
            Sua conta foi criada com uma senha temporária. Por segurança, defina uma nova senha antes de continuar.
          </Text>
        </Stack>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack gap="md">
            <Controller name="senhaAtual" control={control} render={({ field }) => (
              <PasswordInput label="Senha atual (temporária)" placeholder="Informe a senha recebida" error={errors.senhaAtual?.message} {...field} />
            )} />
            <Controller name="novaSenha" control={control} render={({ field }) => (
              <PasswordInput label="Nova senha" placeholder="Mínimo 6 caracteres" error={errors.novaSenha?.message} {...field} />
            )} />
            <Controller name="confirmarSenha" control={control} render={({ field }) => (
              <PasswordInput label="Confirmar nova senha" placeholder="Repita a nova senha" error={errors.confirmarSenha?.message} {...field} />
            )} />
            <Button type="submit" fullWidth loading={isSubmitting} mt="sm">Alterar Senha e Continuar</Button>
          </Stack>
        </form>
      </Card>
    </div>
  )
}
