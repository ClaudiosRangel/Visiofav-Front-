'use client'

import { useEffect, useState } from 'react'
import { Card, Switch, TextInput, Button, Stack, Group, Text, Divider } from '@mantine/core'
import { IconPlugConnected } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useConfigIntegracao, useSalvarConfigIntegracao } from '@/data/hooks/useConfigIntegracao'

export function IntegracaoSection({ inline }: { inline?: boolean }) {
  const { data: config, isLoading } = useConfigIntegracao()
  const salvar = useSalvarConfigIntegracao()

  const [integracaoAtiva, setIntegracaoAtiva] = useState(false)
  const [sistemaExterno, setSistemaExterno] = useState('')

  useEffect(() => {
    if (config) {
      setIntegracaoAtiva(config.integracaoAtiva)
      setSistemaExterno(config.sistemaExterno || '')
    }
  }, [config])

  async function handleSalvar() {
    try {
      await salvar.mutateAsync({
        integracaoAtiva,
        sistemaExterno: integracaoAtiva ? sistemaExterno : null,
      })
      notifications.show({ title: 'Sucesso', message: 'Configuração de integração salva', color: 'green' })
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || 'Erro ao salvar configuração de integração'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    }
  }

  if (isLoading) return null

  const content = (
    <Stack gap="md">
      <Group gap="sm">
        <IconPlugConnected size={20} className="text-teal-600" />
        <Text fw={500}>Integração com Sistema Externo</Text>
      </Group>
      <Text size="xs" c="dimmed">
        Ative para habilitar a integração com um sistema externo de gestão de notas fiscais.
      </Text>

      <Switch
        checked={integracaoAtiva}
        onChange={(e) => setIntegracaoAtiva(e.currentTarget.checked)}
        label={integracaoAtiva ? 'Ativa' : 'Inativa'}
        color="teal"
      />

      <TextInput
        label="Nome do Sistema Externo"
        placeholder="Ex: SAP, TOTVS, Sankhya"
        maxLength={100}
        disabled={!integracaoAtiva}
        value={sistemaExterno}
        onChange={(e) => setSistemaExterno(e.currentTarget.value)}
      />

      <Button
        onClick={handleSalvar}
        loading={salvar.isPending}
        color="teal"
      >
        Salvar Integração
      </Button>
    </Stack>
  )

  if (inline) return content

  return (
    <Card shadow="sm" padding="lg" radius="md" className="max-w-xl" mt="lg">
      {content}
    </Card>
  )
}
