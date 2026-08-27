'use client'

import { useEffect, useState } from 'react'
import { Switch, TextInput, Button, Stack, Group, Text, Divider, Loader, Select, Badge, Card, SimpleGrid, Alert } from '@mantine/core'
import { IconPlugConnected, IconMail, IconCloud, IconLock, IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useConfigIntegracao, useSalvarConfigIntegracao } from '@/data/hooks/useConfigIntegracao'
import { useConfigEmailFiscal, useSalvarConfigEmailFiscal } from '@/data/hooks/useConfigEmailFiscal'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function IntegracaoTabContent() {
  const queryClient = useQueryClient()

  // Integração (conferência/CC-e — existente)
  const { data: configInteg, isLoading: loadingInteg } = useConfigIntegracao()
  const salvarInteg = useSalvarConfigIntegracao()
  const [integracaoAtiva, setIntegracaoAtiva] = useState(false)
  const [sistemaExterno, setSistemaExterno] = useState('')

  // E-mail Fiscal
  const { data: configEmail, isLoading: loadingEmail } = useConfigEmailFiscal()
  const salvarEmail = useSalvarConfigEmailFiscal()
  const [email, setEmail] = useState('')

  // WMS Standalone
  const { data: configWms, isLoading: loadingWms } = useQuery<any>({
    queryKey: ['wms-standalone-config'],
    queryFn: async () => { const { data } = await api.get('/wms-standalone/config'); return data },
  })
  const [wmsModo, setWmsModo] = useState('ERP_COMPLETO')
  const [wmsIntegAtiva, setWmsIntegAtiva] = useState(false)
  const [wmsSistema, setWmsSistema] = useState('')
  const [wmsUrl, setWmsUrl] = useState('')
  const [wmsMaster, setWmsMaster] = useState('ERP_EXTERNO')
  const [wmsSinc, setWmsSinc] = useState('WMS_PARA_ERP')

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

  useEffect(() => {
    if (configWms) {
      setWmsModo(configWms.modoOperacao || 'ERP_COMPLETO')
      setWmsIntegAtiva(configWms.integracaoAtiva || false)
      setWmsSistema(configWms.sistemaExterno || '')
      setWmsUrl(configWms.urlCallbackErp || '')
      setWmsMaster(configWms.masterProduto || 'ERP_EXTERNO')
      setWmsSinc(configWms.sincronizacaoEstoque || 'WMS_PARA_ERP')
    }
  }, [configWms])

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

  const salvarWms = useMutation({
    mutationFn: async () => {
      const { data } = await api.put('/wms-standalone/config', {
        modoOperacao: wmsModo,
        integracaoAtiva: wmsIntegAtiva,
        sistemaExterno: wmsSistema || null,
        urlCallbackErp: wmsUrl || null,
        masterProduto: wmsMaster,
        sincronizacaoEstoque: wmsSinc,
        autenticacaoOperador: 'PIN_TERMINAL',
        produtoExigeCamposFiscais: false,
        permiteCriarProdutoUI: false,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wms-standalone-config'] })
      notifications.show({ title: '✅ Salvo', message: 'Configuração WMS Standalone salva', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  const toggleWmsInteg = useMutation({
    mutationFn: async () => {
      const endpoint = wmsIntegAtiva ? '/wms-standalone/config/bloquear' : '/wms-standalone/config/desbloquear'
      const { data } = await api.patch(endpoint)
      return data
    },
    onSuccess: (data) => {
      setWmsIntegAtiva(data.integracaoAtiva)
      queryClient.invalidateQueries({ queryKey: ['wms-standalone-config'] })
      notifications.show({
        title: data.integracaoAtiva ? '✅ Integração WMS ativada' : '⚠️ Integração WMS bloqueada',
        message: data.integracaoAtiva ? 'ERP externo pode comunicar com WMS' : 'Comunicação bloqueada',
        color: data.integracaoAtiva ? 'green' : 'orange',
      })
    },
  })

  if (loadingInteg || loadingEmail || loadingWms) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size="sm" />
      </div>
    )
  }

  const isStandalone = wmsModo === 'WMS_STANDALONE'

  return (
    <div className="flex flex-col gap-6">
      {/* ═══ WMS Standalone ═══ */}
      <div>
        <Group gap="sm" mb="xs">
          <IconCloud size={18} className="text-blue-600" />
          <Text size="sm" fw={600}>Integração WMS com ERP Externo</Text>
          {isStandalone && <Badge size="sm" color="blue">Standalone</Badge>}
        </Group>
        <Text size="xs" c="dimmed" mb="md">
          Configure o WMS para operar de forma independente, integrado a um ERP externo (SAP, TOTVS, Sankhya, etc.).
          Quando ativo, operadores acessam o WMS diretamente sem depender do ERP Vizor.
        </Text>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Select label="Modo de Operação" description="ERP Completo = WMS como módulo do Vizor. Standalone = WMS independente."
            data={[
              { value: 'ERP_COMPLETO', label: 'ERP Completo (módulo do Vizor)' },
              { value: 'WMS_STANDALONE', label: 'WMS Standalone (integrado com ERP externo)' },
            ]}
            value={wmsModo} onChange={(v) => setWmsModo(v || 'ERP_COMPLETO')} />
          <Select label="Sistema Externo" description="ERP integrado (informativo)"
            data={[
              { value: 'SAP', label: 'SAP' },
              { value: 'TOTVS', label: 'TOTVS (Protheus/Datasul)' },
              { value: 'SANKHYA', label: 'Sankhya' },
              { value: 'OMIE', label: 'Omie' },
              { value: 'BLING', label: 'Bling' },
              { value: 'SENIOR', label: 'Senior' },
              { value: 'OUTRO', label: 'Outro' },
            ]}
            value={wmsSistema} onChange={(v) => setWmsSistema(v || '')} clearable disabled={!isStandalone} />
        </div>

        {isStandalone && (
          <>
            <Group mb="md">
              <Switch label="Integração Ativa" checked={wmsIntegAtiva}
                onChange={(e) => setWmsIntegAtiva(e.currentTarget.checked)} color="green" />
              <Button variant="light" size="xs" color={wmsIntegAtiva ? 'red' : 'green'}
                onClick={() => toggleWmsInteg.mutate()} loading={toggleWmsInteg.isPending}>
                {wmsIntegAtiva ? 'Bloquear Agora' : 'Ativar Agora'}
              </Button>
            </Group>
            <TextInput label="URL de Callback (Webhook)" description="URL para onde o WMS envia notificações ao ERP"
              value={wmsUrl} onChange={(e) => setWmsUrl(e.target.value)}
              placeholder="https://erp.empresa.com/webhooks/wms" mb="sm" />
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Select label="Master de Produto"
                data={[
                  { value: 'ERP_EXTERNO', label: 'ERP Externo (read-only na UI)' },
                  { value: 'WMS', label: 'WMS (cria localmente)' },
                  { value: 'DUAL', label: 'Dual (ambos)' },
                ]}
                value={wmsMaster} onChange={(v) => setWmsMaster(v || 'ERP_EXTERNO')} />
              <Select label="Sincronização de Estoque"
                data={[
                  { value: 'WMS_PARA_ERP', label: 'WMS → ERP (WMS é o dono)' },
                  { value: 'BIDIRECIONAL', label: 'Bidirecional' },
                ]}
                value={wmsSinc} onChange={(v) => setWmsSinc(v || 'WMS_PARA_ERP')} />
            </div>

            <Alert icon={<IconAlertCircle size={14} />} color="blue" variant="light" mb="md">
              URL de acesso direto ao WMS: <strong>http://localhost:3000/wms-app/login</strong>
            </Alert>
          </>
        )}

        <Group justify="flex-end">
          <Button onClick={() => salvarWms.mutate()} loading={salvarWms.isPending} size="sm">
            Salvar Configuração WMS
          </Button>
        </Group>
      </div>

      <Divider />

      {/* ═══ Integração Conferência/CC-e (existente) ═══ */}
      <div>
        <Group gap="sm" mb="xs">
          <IconPlugConnected size={18} className="text-teal-600" />
          <Text size="sm" fw={600}>Integração com Sistema Externo (Conferência)</Text>
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
          <Button onClick={handleSalvarIntegracao} loading={salvarInteg.isPending} size="sm">
            Salvar Integração
          </Button>
        </Group>
      </div>

      <Divider />

      {/* ═══ E-mail Fiscal ═══ */}
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
          <Button onClick={handleSalvarEmail} loading={salvarEmail.isPending} size="sm">
            Salvar E-mail
          </Button>
        </Group>
      </div>
    </div>
  )
}
