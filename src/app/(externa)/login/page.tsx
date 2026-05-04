'use client'

import { Card, TextInput, PasswordInput, Button, Text, Group, Stack } from '@mantine/core'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const schema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(3, 'Senha é obrigatória'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', senha: '' },
  })

  async function onSubmit(data: FormValues) {
    try {
      const response = await api.post('/auth/login', data)
      localStorage.setItem('visiofab-wms-token', response.data.token)
      localStorage.setItem('visiofab-wms-user', JSON.stringify(response.data.usuario))
      // Limpar empresa anterior para forçar nova seleção
      localStorage.removeItem('visiofab-wms-empresa-id')
      router.push('/selecionar-empresa')
    } catch {
      notifications.show({ title: 'Erro', message: 'Email ou senha inválidos', color: 'red' })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card shadow="md" padding="xl" radius="md" className="w-full max-w-md">
        <Stack gap="md" align="center" mb="xl">
          <Text size="xl" fw={700} c="primary">VisioFab WMS</Text>
          <Text size="sm" c="dimmed">Sistema de Gerenciamento de Armazém</Text>
        </Stack>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack gap="md">
            <Controller name="email" control={control} render={({ field }) => (
              <TextInput label="Email" placeholder="admin@visiofab.com" error={errors.email?.message} {...field} />
            )} />
            <Controller name="senha" control={control} render={({ field }) => (
              <PasswordInput label="Senha" placeholder="Sua senha" error={errors.senha?.message} {...field} />
            )} />
            <Button type="submit" fullWidth loading={isSubmitting} mt="sm">Entrar</Button>
          </Stack>
        </form>

        <Text size="xs" c="dimmed" ta="center" mt="lg">
          Login padrão: admin@visiofab.com / 123456
        </Text>
      </Card>
    </div>
  )
}
