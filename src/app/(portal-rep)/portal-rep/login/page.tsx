'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  TextInput,
  PasswordInput,
  Button,
  Text,
  Stack,
  Center,
  Title,
  Alert,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useLogin } from '@/data/hooks/portal-rep-app/usePortalRepAuth'

export default function PortalRepLoginPage() {
  const router = useRouter()
  const loginMutation = useLogin()

  console.log('[portal-rep-login] versão: 2024-08-24-v2, baseURL do hook ativo')

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    loginMutation.mutate(
      {
        email: email.trim(),
        senha,
        empresaId: empresaId.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          console.log('[portal-rep-login] onSuccess:', JSON.stringify(data).substring(0, 100))
          if (data.representante.senhaTemporaria) {
            router.replace('/portal-rep/trocar-senha')
          } else {
            router.replace('/portal-rep/dashboard')
          }
        },
        onError: (error: any) => {
          console.error('[portal-rep-login] onError:', error?.response?.status, error?.response?.data, error?.message)
          const status = error?.response?.status
          const code = error?.response?.data?.code

          if (status === 401 && code === 'CONTA_BLOQUEADA') {
            setErro(
              'Sua conta está temporariamente bloqueada devido a tentativas de login malsucedidas. Tente novamente mais tarde.'
            )
          } else {
            setErro('E-mail ou senha inválidos. Verifique suas credenciais e tente novamente.')
          }
        },
      }
    )
  }

  return (
    <Center mih="100vh" p="md">
      <Card w="100%" maw={400} p="xl">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Title order={2} ta="center" c="green">
              Portal do Representante
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              Faça login para acessar sua conta
            </Text>

            {erro && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="red"
                variant="light"
              >
                {erro}
              </Alert>
            )}

            <TextInput
              label="E-mail"
              placeholder="seu@email.com"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              autoComplete="email"
            />

            <PasswordInput
              label="Senha"
              placeholder="Digite sua senha"
              required
              value={senha}
              onChange={(e) => setSenha(e.currentTarget.value)}
              autoComplete="current-password"
            />

            <TextInput
              label="Empresa (opcional)"
              placeholder="ID da empresa"
              value={empresaId}
              onChange={(e) => setEmpresaId(e.currentTarget.value)}
            />

            <Button
              type="submit"
              fullWidth
              loading={loginMutation.isPending}
              disabled={loginMutation.isPending}
            >
              Entrar
            </Button>
          </Stack>
        </form>
      </Card>
    </Center>
  )
}
