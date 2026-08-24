'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Title,
  Text,
  Divider,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTrocarSenha, useLogout } from '@/data/hooks/portal-rep-app/usePortalRepAuth'

interface TokenPayload {
  nome?: string
  email?: string
  empresa?: string
  empresaNome?: string
  [key: string]: unknown
}

function decodeTokenPayload(): TokenPayload | null {
  try {
    const token = localStorage.getItem('portal-rep-token')
    if (!token) return null
    const base64Payload = token.split('.')[1]
    if (!base64Payload) return null
    const decoded = atob(base64Payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded) as TokenPayload
  } catch {
    return null
  }
}

export default function PerfilPage() {
  const trocarSenha = useTrocarSenha()
  const { logout } = useLogout()

  const [payload, setPayload] = useState<TokenPayload | null>(null)
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')

  useEffect(() => {
    setPayload(decodeTokenPayload())
  }, [])

  const senhasNaoConferem = confirmacao.length > 0 && novaSenha !== confirmacao
  const formValido =
    senhaAtual.length > 0 &&
    novaSenha.length > 0 &&
    confirmacao.length > 0 &&
    !senhasNaoConferem

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formValido) return

    trocarSenha.mutate(
      { senhaAtual, novaSenha },
      {
        onSuccess: () => {
          notifications.show({
            message: 'Senha alterada com sucesso!',
            color: 'green',
          })
          setSenhaAtual('')
          setNovaSenha('')
          setConfirmacao('')
        },
        onError: (error: Error & { response?: { data?: { message?: string } } }) => {
          const msg =
            (error as unknown as { response?: { data?: { message?: string } } })
              .response?.data?.message || 'Erro ao alterar senha. Tente novamente.'
          notifications.show({
            message: msg,
            color: 'red',
          })
        },
      }
    )
  }

  return (
    <Stack gap="lg" p="md" maw={500} mx="auto">
      <Title order={2}>Meu Perfil</Title>

      <Card shadow="xs" withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Title order={4}>Dados pessoais</Title>
          <TextInput
            label="Nome"
            value={payload?.nome || '—'}
            readOnly
            variant="filled"
          />
          <TextInput
            label="E-mail"
            value={payload?.email || '—'}
            readOnly
            variant="filled"
          />
          <TextInput
            label="Empresa"
            value={payload?.empresaNome || payload?.empresa || '—'}
            readOnly
            variant="filled"
          />
        </Stack>
      </Card>

      <Card shadow="xs" withBorder radius="md" p="lg">
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Title order={4}>Alterar senha</Title>

            <PasswordInput
              label="Senha atual"
              placeholder="Digite sua senha atual"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.currentTarget.value)}
              required
            />

            <PasswordInput
              label="Nova senha"
              placeholder="Digite a nova senha"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.currentTarget.value)}
              required
            />

            <PasswordInput
              label="Confirmar nova senha"
              placeholder="Confirme a nova senha"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.currentTarget.value)}
              error={senhasNaoConferem ? 'As senhas não conferem' : undefined}
              required
            />

            <Button
              type="submit"
              fullWidth
              loading={trocarSenha.isPending}
              disabled={!formValido}
            >
              Alterar Senha
            </Button>
          </Stack>
        </form>
      </Card>

      <Divider />

      <Button
        variant="outline"
        color="red"
        fullWidth
        onClick={logout}
      >
        Sair
      </Button>
    </Stack>
  )
}
