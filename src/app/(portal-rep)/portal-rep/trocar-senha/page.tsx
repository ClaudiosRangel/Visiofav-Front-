'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  PasswordInput,
  Button,
  Text,
  Stack,
  Center,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTrocarSenha } from '@/data/hooks/portal-rep-app/usePortalRepAuth'

export default function TrocarSenhaPage() {
  const router = useRouter()
  const trocarSenha = useTrocarSenha()

  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')

  const senhasNaoConferem = confirmacao.length > 0 && novaSenha !== confirmacao
  const formValido =
    senhaAtual.length > 0 &&
    novaSenha.length > 0 &&
    confirmacao.length > 0 &&
    !senhasNaoConferem

  async function handleSubmit(e: React.FormEvent) {
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
          router.replace('/portal-rep/dashboard')
        },
        onError: (error: Error & { response?: { data?: { message?: string } } }) => {
          const msg =
            (error as unknown as { response?: { data?: { message?: string } } })
              .response?.data?.message || 'Erro ao trocar senha. Tente novamente.'
          notifications.show({
            message: msg,
            color: 'red',
          })
        },
      }
    )
  }

  return (
    <Center mih="100vh" p="md">
      <Card w="100%" maw={400} shadow="sm" withBorder radius="md" p="xl">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Title order={3} ta="center">
              Trocar Senha
            </Title>

            <Text size="sm" c="dimmed" ta="center">
              Sua senha é temporária. Crie uma nova senha para continuar.
            </Text>

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
    </Center>
  )
}
