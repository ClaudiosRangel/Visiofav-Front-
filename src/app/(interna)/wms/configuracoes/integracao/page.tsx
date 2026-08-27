'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Button, Select, TextInput, Switch, Badge,
  SimpleGrid, ThemeIcon, Alert, Divider,
} from '@mantine/core'
import {
  IconPlugConnected, IconPlugConnectedX, IconCloud,
  IconLock, IconRefresh, IconCheck, IconAlertCircle,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function IntegracaoWmsPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Configuração de Integração' }, [])
  const queryClient = useQueryClient()

  const [formDirty, setFormDirty] = useState(false)
  const [modoOperacao, setModoOperacao] = useState('ERP_COMPLETO')
  const [integracaoAtiva, setIntegracaoAtiva] = useState(false)
  const [sistemaExterno, setSistemaExterno] = useState('')
  const [urlCallbackErp, setUrlCallbackErp] = useState('')
  const [masterProduto, setMasterProduto] = useState('ERP_EXTERNO')
  const [sincronizacaoEstoque, setSincronizacaoEstoque] = useState('WMS_PARA_ERP')
  const [autenticacaoOperador, setAutenticacaoOperador] = useState('PIN_TERMINAL')
  const [produtoExigeCamposFiscais, setProdutoExigeCamposFiscais] = useState(false)
  const [permiteCriarProdutoUI, setPermiteCriarProdutoUI] = useState(false)

  // Carregar configuração atual
  const { data: config, isLoading } = useQuery<any>({
    queryKey: ['wms-standalone-config'],
    queryFn: async () => { const { data } = await api.get('/wms-standalone/config'); return data },
  })

  useEffect(() => {
    if (config) {
      setModoOperacao(config.modoOperacao || 'ERP_COMPLETO')
      setIntegracaoAtiva(config.integracaoAtiva || false)
      setSistemaExterno(config.sistemaExterno || '')
      setUrlCallbackErp(config.urlCallbackErp || '')
      setMasterProduto(config.masterProduto || 'ERP_EXTERNO')
      setSincronizacaoEstoque(config.sincronizacaoEstoque || 'WMS_PARA_ERP')
      setAutenticacaoOperador(config.autenticacaoOperador || 'PIN_TERMINAL')
      setProdutoExigeCamposFiscais(config.produtoExigeCamposFiscais || false)
      setPermiteCriarProdutoUI(config.permiteCriarProdutoUI || false)
      setFormDirty(false)
    }
  }, [config])

  // Salvar configuração
  const salvar = useMutation({
    mutationFn: async () => {
      const { data } = await api.put('/wms-standalone/config', {
        modoOperacao,
        integracaoAtiva,
        sistemaExterno: sistemaExterno || null,
        urlCallbackErp: urlCallbackErp || null,
        masterProduto,
        sincronizacaoEstoque,
        autenticacaoOperador,
        produtoExigeCamposFiscais,
        permiteCriarProdutoUI,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wms-standalone-config'] })
      setFormDirty(false)
      notifications.show({ title: '✅ Configuração salva', message: 'Alterações aplicadas com sucesso', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  // Bloquear/desbloquear integração
  const toggleIntegracao = useMutation({
    mutationFn: async () => {
      const endpoint = integracaoAtiva ? '/wms-standalone/config/bloquear' : '/wms-standalone/config/desbloquear'
      const { data } = await api.patch(endpoint)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wms-standalone-config'] })
      setIntegracaoAtiva(data.integracaoAtiva)
      notifications.show({
        title: data.integracaoAtiva ? '✅ Integração ativada' : '⚠️ Integração bloqueada',
        message: data.integracaoAtiva ? 'ERP externo pode se comunicar com o WMS' : 'Comunicação com ERP externo interrompida',
        color: data.integracaoAtiva ? 'green' : 'orange',
      })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  const isStandalone = modoOperacao === 'WMS_STANDALONE'

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Configurações / Integração</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Configuração de Integração WMS</Text>
        <Badge size="lg" color={isStandalone ? 'blue' : 'gray'} variant="filled">
          {isStandalone ? 'WMS Standalone' : 'ERP Completo'}
        </Badge>
      </Group>

      {/* Status rápido */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <Card withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Modo de Operação</Text>
              <Text size="lg" fw={700}>{isStandalone ? 'Standalone' : 'ERP Completo'}</Text>
            </div>
            <ThemeIcon color={isStandalone ? 'blue' : 'gray'} variant="light" size={40} radius="md">
              <IconCloud size={20} />
            </ThemeIcon>
          </Group>
        </Card>
        <Card withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Integração</Text>
              <Text size="lg" fw={700} c={integracaoAtiva ? 'green' : 'red'}>
                {integracaoAtiva ? 'Ativa' : 'Inativa'}
              </Text>
            </div>
            <ThemeIcon color={integracaoAtiva ? 'green' : 'red'} variant="light" size={40} radius="md">
              {integracaoAtiva ? <IconPlugConnected size={20} /> : <IconPlugConnectedX size={20} />}
            </ThemeIcon>
          </Group>
        </Card>
        <Card withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Sistema Externo</Text>
              <Text size="lg" fw={700}>{sistemaExterno || '—'}</Text>
            </div>
            <ThemeIcon color="violet" variant="light" size={40} radius="md">
              <IconLock size={20} />
            </ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      {modoOperacao === 'ERP_COMPLETO' && (
        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light" mb="lg">
          A empresa está operando no modo <strong>ERP Completo</strong>. O WMS funciona como módulo interno do Vizor.
          Para habilitar integração com ERP externo, altere o modo para <strong>WMS Standalone</strong>.
        </Alert>
      )}

      {/* Formulário */}
      <Card withBorder>
        <Text fw={600} mb="md">Configuração Geral</Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
          <Select label="Modo de Operação" description="Define como a empresa opera o WMS"
            data={[
              { value: 'ERP_COMPLETO', label: 'ERP Completo (módulo do Vizor)' },
              { value: 'WMS_STANDALONE', label: 'WMS Standalone (integrado com ERP externo)' },
            ]}
            value={modoOperacao} onChange={(v) => { setModoOperacao(v || 'ERP_COMPLETO'); setFormDirty(true) }} />

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
            value={sistemaExterno} onChange={(v) => { setSistemaExterno(v || ''); setFormDirty(true) }}
            clearable disabled={!isStandalone} />
        </SimpleGrid>

        {isStandalone && (
          <>
            <Divider my="md" label="Integração" />

            <Group mb="md">
              <Switch label="Integração Ativa" description="Liga/desliga a comunicação com o ERP externo"
                checked={integracaoAtiva} onChange={(e) => { setIntegracaoAtiva(e.currentTarget.checked); setFormDirty(true) }}
                size="md" color="green" />
              <Button variant="light" size="xs"
                color={integracaoAtiva ? 'red' : 'green'}
                leftSection={integracaoAtiva ? <IconPlugConnectedX size={14} /> : <IconPlugConnected size={14} />}
                onClick={() => toggleIntegracao.mutate()}
                loading={toggleIntegracao.isPending}>
                {integracaoAtiva ? 'Bloquear Agora' : 'Ativar Agora'}
              </Button>
            </Group>

            <TextInput label="URL de Callback (Webhook)" description="URL para onde o WMS envia notificações de eventos ao ERP"
              value={urlCallbackErp} onChange={(e) => { setUrlCallbackErp(e.target.value); setFormDirty(true) }}
              placeholder="https://erp.empresa.com.br/api/webhooks/wms" mb="md" />

            <Divider my="md" label="Comportamento" />

            <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
              <Select label="Master de Produto" description="Quem cadastra/altera produtos"
                data={[
                  { value: 'ERP_EXTERNO', label: 'ERP Externo (WMS recebe, read-only na UI)' },
                  { value: 'WMS', label: 'WMS (cria e edita localmente)' },
                  { value: 'DUAL', label: 'Dual (ambos podem criar/editar)' },
                ]}
                value={masterProduto} onChange={(v) => { setMasterProduto(v || 'ERP_EXTERNO'); setFormDirty(true) }} />

              <Select label="Sincronização de Estoque" description="Direção da sincronização"
                data={[
                  { value: 'WMS_PARA_ERP', label: 'WMS → ERP (WMS é o dono do estoque)' },
                  { value: 'BIDIRECIONAL', label: 'Bidirecional (ambos ajustam)' },
                ]}
                value={sincronizacaoEstoque} onChange={(v) => { setSincronizacaoEstoque(v || 'WMS_PARA_ERP'); setFormDirty(true) }} />

              <Select label="Autenticação de Operadores" description="Como operadores do chão logam"
                data={[
                  { value: 'PIN_TERMINAL', label: 'PIN + Terminal (como Checkout)' },
                  { value: 'LOGIN_SENHA', label: 'Login + Senha (JWT)' },
                  { value: 'SSO_EXTERNO', label: 'SSO do cliente (LDAP/AD)' },
                ]}
                value={autenticacaoOperador} onChange={(v) => { setAutenticacaoOperador(v || 'PIN_TERMINAL'); setFormDirty(true) }} />
            </SimpleGrid>

            <Divider my="md" label="Restrições" />

            <Group mb="md">
              <Switch label="Produto exige campos fiscais" description="Se desativado, NCM/CFOP/CST são opcionais"
                checked={produtoExigeCamposFiscais} onChange={(e) => { setProdutoExigeCamposFiscais(e.currentTarget.checked); setFormDirty(true) }} />
              <Switch label="Permite criar produto pela UI" description="Se desativado, produtos só vêm da API de integração"
                checked={permiteCriarProdutoUI} onChange={(e) => { setPermiteCriarProdutoUI(e.currentTarget.checked); setFormDirty(true) }} />
            </Group>
          </>
        )}

        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => queryClient.invalidateQueries({ queryKey: ['wms-standalone-config'] })}
            leftSection={<IconRefresh size={16} />}>
            Resetar
          </Button>
          <Button onClick={() => salvar.mutate()} loading={salvar.isPending}
            disabled={!formDirty} leftSection={<IconCheck size={16} />}>
            Salvar Configuração
          </Button>
        </Group>
      </Card>
    </div>
  )
}
