'use client'

import { useEffect, useState } from 'react'
import { Switch, TextInput, Button, Stack, Group, Text, Divider, Loader } from '@mantine/core'
import { IconPlugConnected, IconMail } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useConfigIntegracao, useSalvarConfigIntegracao } from '@/data/hooks/useConfigIntegracao'
import { useConfigEmailFiscal, useSalvarConfigEmailFiscal } from '@/data/hooks/useConfigEmailFiscal'

export function IntegracaoTabContent() {
  // Integração
  const { data: configInteg, isLoading: loadingInteg } = useConfigIntegracao()
  const salvarInteg = useSalvarConfigIntegracao()
  const [integracaoAtiva, setIntegracaoAtiva] = useState(false)
  const [sistemaExterno, setSistemaExterno] = useState('')

  // E-mail Fiscal
  const { data: configEmail, isLoading: loadingEmail } = useConfigEmailFiscal()
  const salvarEmail = useSalvarConfigEmailFiscal()
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (configInteg) {
      setIntegracaoAtiva(configInteg.integracaoAtiva)
      setSistemaExterno(configInteg.sistemaExterno || '')
    }
  }, [configInteg])

  useEffect(() => {
    if (configEmail) {
      setEmail(configEmail.email || '')
    }
  }, [configEmail])

  async function handleSalvarIntegracao() {
    try {
      await salvarInteg.mutateAsync({
        integracaoAtiva,
        sistemaExterno: integracaoAtiva ? sistemaExterno : null,
      })
      notifications.show({ title: 'Sucesso', message: 'Configuração de integração salva', color: 'green' })
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Erro ao salvar'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    }
  }

  async function handleSalvarEmail() {
    try {
      await salvarEmail.mutateAsync({ email })
      notifications.show({ title: 'Sucesso', message: 'E-mail fiscal salvo', color: 'green' })
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Erro ao salvar'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    }
  }

  if (loadingInteg || loadingEmail) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size="sm" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Integração com Sistema Externo */}
      <div>
        <Group gap="sm" mb="xs">
          <IconPlugConnected size={18} className="text-teal-600" />
          <Text size="sm" fw={600}>Integração com Sistema Externo</Text>
        </Group>
        <Text size="xs" c="dimmed" mb="md">
          Ative para habilitar a integração com um sistema ERP externo para consumo de pendências CC-e.
        </Text>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col justify-center">
            <Switch
              checked={integracaoAtiva}
              onChange={(e) => setIntegracaoAtiva(e.currentTarget.checked)}
              label={integracaoAtiva ? 'Integração Ativa' : 'Integração Inativa'}
              color="teal"
            />
          </div>
          <TextInput
            label="Nome do Sistema Externo"
            placeholder="Ex: SAP, TOTVS, Sankhya"
            maxLength={100}
            disabled={!integracaoAtiva}
            value={sistemaExterno}
            onChange={(e) => setSistemaExterno(e.currentTarget.value)}
          />
        </div>

        <Group justify="flex-end" mt="md">
          <Button
            onClick={handleSalvarIntegracao}
            loading={salvarInteg.isPending}
            size="sm"
          >
            Salvar Integração
          </Button>
        </Group>
      </div>

      <Divider />

      {/* E-mail do Setor Fiscal */}
      <div>
        <Group gap="sm" mb="xs">
          <IconMail size={18} className="text-teal-600" />
          <Text size="sm" fw={600}>E-mail do Setor Fiscal</Text>
        </Group>
        <Text size="xs" c="dimmed" mb="md">
          Endereço de e-mail que receberá notificações de divergência quando não houver integração ativa.
        </Text>

        <TextInput
          label="E-mail"
          placeholder="fiscal@empresa.com.br"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          className="max-w-md"
        />

        <Group justify="flex-end" mt="md">
          <Button
            onClick={handleSalvarEmail}
            loading={salvarEmail.isPending}
            size="sm"
          >
            Salvar E-mail
          </Button>
        </Group>
      </div>
    </div>
  )
}
