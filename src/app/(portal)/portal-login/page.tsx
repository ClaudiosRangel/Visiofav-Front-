'use client'

import { useState, useEffect } from 'react'
import {
  Card, TextInput, PasswordInput, Button, Text, Group, ThemeIcon, Stack, Alert,
} from '@mantine/core'
import { IconBuildingWarehouse, IconAlertCircle } from '@tabler/icons-react'
import { portalApi } from '@/lib/portalApi'

export default function PortalLoginPage() {
  useEffect(() => { document.title = 'Portal 3PL - Login' }, [])

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      const { data } = await portalApi.post('/portal/auth/login', { email, senha })
      localStorage.setItem('visiofab-portal-token', data.token)
      window.location.href = '/dashboard'
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Email ou senha inválidos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
      <Card shadow="lg" padding="xl" radius="md" className="w-full max-w-md">
        <Group justify="center" mb="lg">
          <ThemeIcon size={56} radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
            <IconBuildingWarehouse size={28} />
          </ThemeIcon>
        </Group>

        <Text size="xl" fw={700} ta="center" mb={4}>Portal 3PL</Text>
        <Text size="sm" c="dimmed" ta="center" mb="xl">
          Acesse para gerenciar seu estoque e solicitações
        </Text>

        {erro && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
            {erro}
          </Alert>
        )}

        <form onSubmit={handleLogin}>
          <Stack gap="sm">
            <TextInput
              label="Email"
              placeholder="seu@email.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Senha"
              placeholder="Sua senha"
              value={senha}
              onChange={(e) => setSenha(e.currentTarget.value)}
              required
            />
            <Button type="submit" fullWidth mt="md" loading={loading} disabled={!email || !senha}>
              Entrar
            </Button>
          </Stack>
        </form>
      </Card>
    </div>
  )
}
