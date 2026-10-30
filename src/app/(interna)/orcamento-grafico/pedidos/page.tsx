'use client'

/**
 * Pedidos / Propostas — gestão central do Comercial (revisão do usuário, ponto 3).
 *
 * É a ENTRADA unificada de TODAS as origens: solicitações de representantes
 * (portal) que viraram orçamento E lançamentos diretos de clientes (e-mail/
 * telefone/outros canais) feitos internamente. Todas convergem para o
 * `OrcamentoGrafico`, então esta tela consome a listagem paginada
 * `GET /orcamento-grafico` e enriquece com:
 *   - estágio no funil (derivado do status: lançamento → proposta → aprovação
 *     do cliente → conversão em pedido);
 *   - ações de gestão: abrir, ENVIAR PROPOSTA ao cliente (PDF/e-mail com o
 *     template e o LOGO da empresa) e encaminhar para conversão em pedido.
 *
 * Só vai para PCP/Faturamento depois de passar por todo o processo (orçar,
 * aprovar cliente, conferir cálculo) — a conversão em pedido é feita na tela
 * "Orçamentos a Converter" (que já tem o gate de margem / amostra).
 */
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Title, Stack, Group, Table, Badge, Text, Loader, Center, Button, Paper,
  TextInput, Select, Menu, Modal, Textarea, ScrollArea, Pagination, Tooltip,
} from '@mantine/core'
import {
  IconSearch, IconFilter, IconRefresh, IconExternalLink, IconFileText,
  IconMail, IconDownload, IconShoppingCartPlus,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Tipos (shape de GET /orcamento-grafico)
// ============================================================================

interface Proposta {
  id: string
  numero: number
  versao: number
  clienteNome?: string | null
  clienteId?: string | null
  vendedorId?: string | null
  tipoEmbalagem?: { descricao: string } | null
  quantidade: number
  precoVenda?: number | string | null
  status: string
  etapaCalculo?: string | null // AGUARDANDO | EM_CALCULO | VALIDAR | VALIDADO | null
  tipo?: string | null // NOVO | REPETICAO
  criadoEm: string
}

interface PaginatedResponse {
  data: Proposta[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface TemplateProposta {
  id: string
  nome: string
  isDefault: boolean
}

// ============================================================================
// Estágio no funil (derivado do status do orçamento)
// ============================================================================

const ESTAGIO_CONFIG: Record<string, { color: string; label: string; etapa: string }> = {
  RASCUNHO: { color: 'gray', label: 'Rascunho', etapa: 'Em cálculo' },
  ENVIADO: { color: 'blue', label: 'Enviado', etapa: 'Aguardando cliente' },
  APROVADO: { color: 'green', label: 'Aprovado', etapa: 'Pronto p/ converter' },
  CONVERTIDO: { color: 'teal', label: 'Convertido', etapa: 'Em produção/faturamento' },
  RECUSADO: { color: 'red', label: 'Recusado', etapa: 'Encerrado' },
  VENCIDO: { color: 'orange', label: 'Vencido', etapa: 'Reabrir/renovar' },
}

// Quando em RASCUNHO, a sub-etapa do cálculo diz onde o orçamento está no funil.
const ETAPA_CALCULO_CONFIG: Record<string, { color: string; label: string }> = {
  AGUARDANDO: { color: 'yellow', label: 'A orçar' },
  EM_CALCULO: { color: 'indigo', label: 'Em cálculo' },
  VALIDAR: { color: 'orange', label: 'Validar cálculo' },
  VALIDADO: { color: 'green', label: 'Validado — enviar proposta' },
}

function EstagioBadge({ status, etapa }: { status: string; etapa?: string | null }) {
  // Em RASCUNHO, prioriza a sub-etapa do cálculo (mais informativa p/ o funil).
  if (status === 'RASCUNHO' && etapa && ETAPA_CALCULO_CONFIG[etapa]) {
    const e = ETAPA_CALCULO_CONFIG[etapa]
    return <Badge color={e.color} variant="light">{e.label}</Badge>
  }
  const cfg = ESTAGIO_CONFIG[status] || { color: 'gray', label: status, etapa: '' }
  return (
    <Group gap={6} wrap="nowrap">
      <Badge color={cfg.color}>{cfg.label}</Badge>
      {cfg.etapa && <Text size="xs" c="dimmed">{cfg.etapa}</Text>}
    </Group>
  )
}

// ============================================================================
// Formatadores
// ============================================================================

function brl(val: number | string | null | undefined): string {
  if (val == null) return '—'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '—'
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

// ============================================================================
// Página
// ============================================================================

export default function PedidosPropostasPage() {
  const router = useRouter()
  useEffect(() => { document.title = 'Pedidos / Propostas' }, [])

  const [data, setData] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<string | null>(null)

  // Templates de proposta (para o envio)
  const [templates, setTemplates] = useState<TemplateProposta[]>([])
  const [templateId, setTemplateId] = useState<string | null>(null)

  // Modal de envio de proposta por e-mail
  const [envioAlvo, setEnvioAlvo] = useState<Proposta | null>(null)
  const [emailDestino, setEmailDestino] = useState('')
  const [emailMensagem, setEmailMensagem] = useState('')
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [baixando, setBaixando] = useState<string | null>(null)

  const LIMIT = 50

  // Carrega templates uma vez (default pré-selecionado)
  useEffect(() => {
    api.get('/orcamento-grafico/templates-proposta')
      .then(({ data }) => {
        const lista: TemplateProposta[] = Array.isArray(data) ? data : []
        setTemplates(lista)
        const def = lista.find((t) => t.isDefault)
        if (def) setTemplateId(def.id)
      })
      .catch(() => setTemplates([]))
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: LIMIT }
      if (busca.trim()) params.busca = busca.trim()
      if (statusFiltro) params.status = statusFiltro

      const res = await api.get('/orcamento-grafico', { params })
      const result: PaginatedResponse = res.data
      setData(result.data || [])
      setTotal(result.total || 0)
      setTotalPages(result.totalPages || 1)
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao carregar',
        message: err?.response?.data?.message || 'Falha ao buscar pedidos/propostas',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }, [page, busca, statusFiltro])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { setPage(1) }, [busca, statusFiltro])

  // ── Baixar proposta (PDF com logo + template escolhido) ──
  async function baixarProposta(prop: Proposta) {
    setBaixando(prop.id)
    try {
      const { data } = await api.get(`/orcamento-grafico/${prop.id}/proposta-pdf`, {
        responseType: 'blob',
        params: templateId ? { templateId } : {},
      })
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao gerar proposta', color: 'red' })
    } finally {
      setBaixando(null)
    }
  }

  // ── Enviar proposta por e-mail ──
  async function enviarEmail() {
    if (!envioAlvo) return
    if (!emailDestino.trim()) {
      notifications.show({ message: 'Informe o e-mail de destino.', color: 'red' })
      return
    }
    setEnviandoEmail(true)
    try {
      const { data } = await api.post(`/orcamento-grafico/${envioAlvo.id}/enviar-email`, {
        destinatario: emailDestino.trim(),
        mensagem: emailMensagem.trim() || undefined,
        templateId: templateId || undefined,
      })
      notifications.show({ title: 'Proposta', message: data?.message || 'Proposta enviada ao cliente.', color: 'green' })
      setEnvioAlvo(null)
      setEmailDestino('')
      setEmailMensagem('')
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao enviar e-mail', color: 'red' })
    } finally {
      setEnviandoEmail(false)
    }
  }

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <Title order={3}>Pedidos / Propostas</Title>
          <Text size="sm" c="dimmed">
            Gestão central de todas as origens (representantes e clientes diretos). {total} registro{total !== 1 ? 's' : ''}.
          </Text>
        </div>
        <Group gap="xs">
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={carregar}>Atualizar</Button>
          <Button leftSection={<IconFileText size={16} />} onClick={() => router.push('/orcamento-grafico/novo')}>
            Novo pedido / proposta
          </Button>
        </Group>
      </Group>

      {/* Filtros */}
      <Paper p="sm" withBorder>
        <Group gap="sm" align="flex-end" wrap="wrap">
          <TextInput
            placeholder="Buscar por número ou cliente..."
            leftSection={<IconSearch size={16} />}
            value={busca}
            onChange={(e) => setBusca(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <Select
            placeholder="Estágio / status"
            leftSection={<IconFilter size={16} />}
            data={[
              { value: 'RASCUNHO', label: 'Em cálculo (Rascunho)' },
              { value: 'ENVIADO', label: 'Aguardando cliente (Enviado)' },
              { value: 'APROVADO', label: 'Aprovado' },
              { value: 'RECUSADO', label: 'Recusado' },
              { value: 'VENCIDO', label: 'Vencido' },
            ]}
            value={statusFiltro}
            onChange={setStatusFiltro}
            clearable
            w={230}
          />
          {templates.length > 0 && (
            <Select
              placeholder="Template da proposta"
              data={templates.map((t) => ({ value: t.id, label: t.nome + (t.isDefault ? ' (padrão)' : '') }))}
              value={templateId}
              onChange={setTemplateId}
              w={210}
            />
          )}
        </Group>
      </Paper>

      {/* Tabela */}
      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nº</Table.Th>
                <Table.Th>Cliente</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th ta="right">Quantidade</Table.Th>
                <Table.Th ta="right">Valor</Table.Th>
                <Table.Th>Estágio</Table.Th>
                <Table.Th>Criado</Table.Th>
                <Table.Th>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((prop) => (
                <Table.Tr key={prop.id}>
                  <Table.Td fw={600}>
                    <Group gap={6} wrap="nowrap">
                      {prop.numero}
                      {prop.tipo === 'REPETICAO' && (
                        <Badge size="xs" color="violet" variant="light">Repetição</Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>{prop.clienteNome || '—'}</Table.Td>
                  <Table.Td>{prop.tipoEmbalagem?.descricao || '—'}</Table.Td>
                  <Table.Td ta="right">{prop.quantidade?.toLocaleString('pt-BR') || '—'}</Table.Td>
                  <Table.Td ta="right">{brl(prop.precoVenda)}</Table.Td>
                  <Table.Td><EstagioBadge status={prop.status} etapa={prop.etapaCalculo} /></Table.Td>
                  <Table.Td>{formatDate(prop.criadoEm)}</Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Tooltip label="Abrir">
                        <Button
                          size="compact-sm"
                          variant="subtle"
                          leftSection={<IconExternalLink size={15} />}
                          onClick={() => router.push(`/orcamento-grafico/${prop.id}`)}
                        >
                          Abrir
                        </Button>
                      </Tooltip>
                      <Menu shadow="md" position="bottom-end" withArrow>
                        <Menu.Target>
                          <Button size="compact-sm" variant="light" leftSection={<IconFileText size={15} />}>
                            Proposta
                          </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Label>Enviar ao cliente</Menu.Label>
                          <Menu.Item
                            leftSection={<IconDownload size={15} />}
                            onClick={() => baixarProposta(prop)}
                            disabled={baixando === prop.id}
                          >
                            Baixar PDF (com logo)
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconMail size={15} />}
                            onClick={() => { setEnvioAlvo(prop); setEmailDestino(''); setEmailMensagem('') }}
                          >
                            Enviar por e-mail
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                      {prop.status === 'APROVADO' && (
                        <Tooltip label="Converter em pedido (gate de margem/amostra)">
                          <Button
                            size="compact-sm"
                            color="teal"
                            leftSection={<IconShoppingCartPlus size={15} />}
                            onClick={() => router.push('/orcamento-grafico/a-converter')}
                          >
                            Converter
                          </Button>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text ta="center" c="dimmed" py="md">Nenhum pedido/proposta encontrado</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <Group justify="center">
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}

      {/* Modal — enviar proposta por e-mail */}
      <Modal
        opened={!!envioAlvo}
        onClose={() => setEnvioAlvo(null)}
        title={`Enviar proposta ${envioAlvo?.numero ?? ''} ao cliente`}
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Cliente: {envioAlvo?.clienteNome || '—'} · Valor: {brl(envioAlvo?.precoVenda)}
          </Text>
          {templates.length > 0 && (
            <Select
              label="Template da proposta"
              data={templates.map((t) => ({ value: t.id, label: t.nome + (t.isDefault ? ' (padrão)' : '') }))}
              value={templateId}
              onChange={setTemplateId}
            />
          )}
          <TextInput
            label="E-mail do destinatário"
            placeholder="cliente@empresa.com"
            value={emailDestino}
            onChange={(e) => setEmailDestino(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Mensagem (opcional)"
            placeholder="Segue nossa proposta comercial..."
            minRows={3}
            value={emailMensagem}
            onChange={(e) => setEmailMensagem(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEnvioAlvo(null)}>Cancelar</Button>
            <Button leftSection={<IconMail size={16} />} loading={enviandoEmail} onClick={enviarEmail}>
              Enviar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
