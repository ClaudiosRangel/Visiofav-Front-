'use client'

import { useState, useEffect } from 'react'
import { Card, Group, Text, Badge, Button, Select, TextInput, Switch, SimpleGrid, ThemeIcon, Divider, Alert } from '@mantine/core'
import { IconSettings, IconPlugConnected, IconPlugConnectedX, IconCheck, IconRefresh, IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

function wmsHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('wms-token')}`, 'Content-Type': 'application/json' }
}

export default function ConfiguracoesStandalonePage() {
  useEffect(() => { document.title = 'Vizor WMS - Configurações' }, [])
  const queryClient = useQueryClient()

  const [modoOperacao, setModoOperacao] = useState('WMS_STANDALONE')
  const [integracaoAtiva, setIntegracaoAtiva] = useState(false)
  const [sistemaExterno, setSistemaExterno] = useState('')
  const [urlCallback, setUrlCallback] = useState('')
  const [masterProduto, setMasterProduto] = useState('ERP_EXTERNO')
  const [sincEstoque, setSincEstoque] = useState('WMS_PARA_ERP')

  const { data: config } = useQuery<any>({
    queryKey: ['wms-standalone', 'config'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/wms-standalone/config`, { headers: wmsHeaders() })
      if (!res.ok) return null
      return res.json()
    },
  })

  useEffect(() => {
    if (config) {
      setModoOperacao(config.modoOperacao || 'WMS_STANDALONE')
      setIntegracaoAtiva(config.integracaoAtiva || false)
      setSistemaExterno(config.sistemaExterno || '')
      setUrlCallback(config.urlCallbackErp || '')
      setMasterProduto(config.masterProduto || 'ERP_EXTERNO')
      setSincEstoque(config.sincronizacaoEstoque || 'WMS_PARA_ERP')
    }
  }, [config])

  const salvar = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/wms-standalone/config`, {
        method: 'PUT', headers: wmsHeaders(),
        body: JSON.stringify({ modoOperacao, integracaoAtiva, sistemaExterno: sistemaExterno || null, urlCallbackErp: urlCallback || null, masterProduto, sincronizacaoEstoque: sincEstoque, autenticacaoOperador: 'PIN_TERMINAL', produtoExigeCamposFiscais: false, permiteCriarProdutoUI: false }),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wms-standalone', 'config'] })
      notifications.show({ title: '✅ Salvo', message: 'Configuração atualizada', color: 'green' })
    },
    onError: (err: any) => notifications.show({ title: 'Erro', message: err.message, color: 'red' }),
  })

  const toggleIntegracao = useMutation({
    mutationFn: async () => {
      const endpoint = integracaoAtiva ? '/wms-standalone/config/bloquear' : '/wms-standalone/config/desbloquear'
      const res = await fetch(`${API_URL}${endpoint}`, { method: 'PATCH', headers: wmsHeaders() })
      return res.json()
    },
    onSuccess: (data) => {
      setIntegracaoAtiva(data.integracaoAtiva)
      queryClient.invalidateQueries({ queryKey: ['wms-standalone', 'config'] })
      notifications.show({ title: data.integracaoAtiva ? '✅ Ativada' : '⚠️ Bloqueada', message: data.integracaoAtiva ? 'Integração ativa' : 'Integração bloqueada', color: data.integracaoAtiva ? 'green' : 'orange' })
    },
  })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Configurações</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Configurações do WMS</Text>
        <Badge size="lg" color={integracaoAtiva ? 'green' : 'red'} variant="dot">
          {integracaoAtiva ? 'Integração Ativa' : 'Integração Inativa'}
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Modo</Text>
          <Text size="lg" fw={700}>Standalone</Text>
        </Card>
        <Card withBorder>
          <Group justify="space-between">
            <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Integração</Text><Text size="lg" fw={700} c={integracaoAtiva ? 'green' : 'red'}>{integracaoAtiva ? 'Ativa' : 'Bloqueada'}</Text></div>
            <ThemeIcon color={integracaoAtiva ? 'green' : 'red'} variant="light" size={40} radius="md">{integracaoAtiva ? <IconPlugConnected size={20} /> : <IconPlugConnectedX size={20} />}</ThemeIcon>
          </Group>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Sistema Externo</Text>
          <Text size="lg" fw={700}>{sistemaExterno || '—'}</Text>
        </Card>
      </SimpleGrid>

      <Card withBorder>
        <Text fw={600} mb="md">Configuração de Integração</Text>
        <Group mb="md">
          <Switch label="Integração Ativa" checked={integracaoAtiva} onChange={(e) => setIntegracaoAtiva(e.currentTarget.checked)} color="green" />
          <Button variant="light" size="xs" color={integracaoAtiva ? 'red' : 'green'} onClick={() => toggleIntegracao.mutate()}>
            {integracaoAtiva ? 'Bloquear Agora' : 'Ativar Agora'}
          </Button>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
          <Select label="Sistema Externo" data={[{value:'SAP',label:'SAP'},{value:'TOTVS',label:'TOTVS'},{value:'SANKHYA',label:'Sankhya'},{value:'OMIE',label:'Omie'},{value:'BLING',label:'Bling'},{value:'OUTRO',label:'Outro'}]} value={sistemaExterno} onChange={(v) => setSistemaExterno(v || '')} clearable />
          <Select label="Master de Produto" data={[{value:'ERP_EXTERNO',label:'ERP Externo (read-only)'},{value:'WMS',label:'WMS (cria localmente)'},{value:'DUAL',label:'Dual'}]} value={masterProduto} onChange={(v) => setMasterProduto(v || 'ERP_EXTERNO')} />
        </SimpleGrid>
        <TextInput label="URL Callback (Webhook)" value={urlCallback} onChange={(e) => setUrlCallback(e.target.value)} placeholder="https://erp.empresa.com/webhooks/wms" mb="md" />
        <Select label="Sincronização de Estoque" data={[{value:'WMS_PARA_ERP',label:'WMS → ERP (WMS é o dono)'},{value:'BIDIRECIONAL',label:'Bidirecional'}]} value={sincEstoque} onChange={(v) => setSincEstoque(v || 'WMS_PARA_ERP')} mb="md" />
        <Group justify="flex-end">
          <Button leftSection={<IconCheck size={16} />} onClick={() => salvar.mutate()} loading={salvar.isPending}>Salvar</Button>
        </Group>
      </Card>
    </div>
  )
}
