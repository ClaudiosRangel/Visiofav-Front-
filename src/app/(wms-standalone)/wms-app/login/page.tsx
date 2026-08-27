'use client'

import { useState } from 'react'
import { Card, TextInput, PasswordInput, Button, Text, Tabs, Center, Stack, Alert } from '@mantine/core'
import { IconLock, IconUser, IconAlertCircle } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

export default function WmsLoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  // PIN login
  const [empresaId, setEmpresaId] = useState('')
  const [matricula, setMatricula] = useState('')
  const [pin, setPin] = useState('')

  // Senha login
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  async function loginPin() {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch(`${API_URL}/wms-auth/login-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula, pin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erro no login')

      localStorage.setItem('wms-token', data.token)
      localStorage.setItem('wms-empresa-id', data.empresaId)
      router.replace('/wms-app/dashboard')
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loginSenha() {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch(`${API_URL}/wms-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erro no login')

      localStorage.setItem('wms-token', data.token)
      localStorage.setItem('wms-empresa-id', data.empresaId)
      router.replace('/wms-app/dashboard')
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <Card shadow="xl" radius="lg" withBorder className="w-full max-w-md">
        <Center mb="lg">
          <Stack align="center" gap={4}>
            <Text size="xl" fw={700} c="blue">Vizor WMS</Text>
            <Text size="sm" c="dimmed">Acesso ao Sistema de Armazém</Text>
          </Stack>
        </Center>

        {erro && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md" onClose={() => setErro('')} withCloseButton>
            {erro}
          </Alert>
        )}

        <Tabs defaultValue="pin">
          <Tabs.List grow mb="md">
            <Tabs.Tab value="pin" leftSection={<IconLock size={14} />}>PIN</Tabs.Tab>
            <Tabs.Tab value="senha" leftSection={<IconUser size={14} />}>Login</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="pin">
            <Stack gap="sm">
              <TextInput label="Matrícula" value={matricula} onChange={(e) => setMatricula(e.target.value)}
                placeholder="Sua matrícula de operador" required />
              <PasswordInput label="PIN" value={pin} onChange={(e) => setPin(e.target.value)}
                placeholder="****" maxLength={8} required />
              <Button fullWidth size="md" onClick={loginPin} loading={loading}
                leftSection={<IconLock size={16} />} mt="sm">
                Entrar com PIN
              </Button>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="senha">
            <Stack gap="sm">
              <TextInput label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com" type="email" required />
              <PasswordInput label="Senha" value={senha} onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha" required />
              <Button fullWidth size="md" onClick={loginSenha} loading={loading}
                leftSection={<IconUser size={16} />} mt="sm">
                Entrar
              </Button>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Text size="xs" c="dimmed" ta="center" mt="lg">
          Acesso exclusivo para operadores WMS com integração ativa
        </Text>
      </Card>
    </div>
  )
}
