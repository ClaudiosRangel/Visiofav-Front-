'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Text,
  Group,
  Button,
  ActionIcon,
  Menu,
  Modal,
  TextInput,
  Textarea,
  Table,
  Checkbox,
  Pagination,
  Card,
  LoadingOverlay,
  Select,
  Stack,
  Paper,
  Badge,
  ScrollArea,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import {
  IconPlus,
  IconDotsVertical,
  IconFileTypePdf,
  IconFileCode,
  IconCopy,
  IconX,
  IconEdit,
  IconSend,
  IconMail,
  IconSearch,
  IconHistory,
} from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { StatusBadge } from '@/components/fiscal/StatusBadge'
import { useCte } from '@/data/hooks/fiscal/useCte'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebouncedValue } from '@mantine/hooks'
import { api } from '@/lib/api'
import Link from 'next/link'

interface CteItem {
  id: string
  numero: number
  serie: number
  tomadorRazao: string | null
  destRazao: string | null
  valorTotal: number
  status: string
  dataEmissao: string
  dataAutorizacao: string | null
  chaveAcesso: string | null
  origemDestino: string | null
}

// =============================================================================
// Menu de ações individuais (⋮)
// =============================================================================

function AcoesMenu({ item }: { item: CteItem }) {
  const { baixarDacte, baixarXml } = useCte()
  const cancelarMutation = useCte().useCancelar()
  const transmitirMutation = useCte().useTransmitir()
  const consultarSefazMutation = useCte().useConsultarSefaz()
  const enviarEmailMutation = useCte().useEnviarEmail()
  const router = useRouter()
  const [cancelarAberto, setCancelarAberto] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [cceAberto, setCceAberto] = useState(false)
  const [textoCorrecao, setTextoCorrecao] = useState('')
  const [emailAberto, setEmailAberto] = useState(false)
  const [emails, setEmails] = useState('')
  const [eventosAberto, setEventosAberto] = useState(false)
  const [eventos, setEventos] = useState<any[]>([])
  const [eventosLoading, setEventosLoading] = useState(false)
  const [consultaSefazAberto, setConsultaSefazAberto] = useState(false)
  const [consultaSefazResult, setConsultaSefazResult] = useState<{ cStat: number; xMotivo: string; protocolo: string | null; dataRecebimento: string | null } | null>(null)
  const cartaCorrecaoMutation = useCte().useCartaCorrecao()

  function handleTransmitir(id: string) {
    transmitirMutation.mutate(id, {
      onSuccess: (response: any) => {
        if (response?.sucesso) {
          notifications.show({ title: 'CT-e Autorizado', message: `Protocolo: ${response?.protocolo || 'N/A'}`, color: 'green' })
        } else {
          notifications.show({ title: 'CT-e Rejeitado', message: response?.motivoRejeicao || response?.message || 'Rejeitado', color: 'red', autoClose: false })
        }
      },
      onError: (err: any) => {
        const data = err?.response?.data
        const msg = data?.mensagem || data?.message || 'Erro ao transmitir'
        const erros = data?.detalhes?.erros
        const errosStr = erros && Array.isArray(erros) ? '\n• ' + erros.join('\n• ') : ''
        notifications.show({ title: 'Erro na Transmissão', message: `${msg}${errosStr}`, color: 'red', autoClose: false })
      },
    })
  }

  async function handleExcluir(id: string) {
    if (!confirm('Tem certeza que deseja excluir este CT-e?')) return
    try {
      await api.delete(`/fiscal/cte/${id}`)
      notifications.show({ title: 'Excluído', message: 'CT-e removido.', color: 'green' })
      window.location.reload()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Não foi possível excluir', color: 'red' })
    }
  }

  async function handleVisualizarXml(id: string) {
    try {
      const response = await api.get(`/fiscal/cte/${id}/preview-xml`, { responseType: 'blob' })
      window.open(URL.createObjectURL(new Blob([response.data], { type: 'application/xml' })), '_blank')
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro ao gerar XML', color: 'red' })
    }
  }

  async function handleDacte() {
    try {
      const response = await baixarDacte(item.id)
      window.open(URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' })), '_blank')
    } catch {
      notifications.show({ title: 'Erro', message: 'Não foi possível gerar o DACTE', color: 'red' })
    }
  }

  async function handleXml() {
    try {
      const response = await baixarXml(item.id)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([response.data], { type: 'application/xml' }))
      a.download = `CTe-${item.serie}-${item.numero}.xml`
      a.click()
    } catch {
      notifications.show({ title: 'Erro', message: 'XML não disponível', color: 'red' })
    }
  }

  function handleCancelar() {
    if (justificativa.length < 15) { notifications.show({ title: 'Erro', message: 'Mín. 15 caracteres', color: 'red' }); return }
    cancelarMutation.mutate({ id: item.id, justificativa }, {
      onSuccess: () => { notifications.show({ title: 'Sucesso', message: 'CT-e cancelado', color: 'green' }); setCancelarAberto(false) },
      onError: (err: any) => {
        const data = err?.response?.data
        const msg = data?.message || data?.mensagem || 'Falha ao cancelar'
        const erros = data?.erros?.map((e: any) => `${e.descricao} (cStat: ${e.codigo})`).join('\n') || ''
        notifications.show({ title: 'Falha no Cancelamento', message: `${msg}${erros ? '\n' + erros : ''}`, color: 'red', autoClose: false })
      },
    })
  }

  function handleCartaCorrecao() {
    if (textoCorrecao.length < 15) { notifications.show({ title: 'Erro', message: 'Mín. 15 caracteres', color: 'red' }); return }
    cartaCorrecaoMutation.mutate({ id: item.id, textoCorrecao }, {
      onSuccess: () => { notifications.show({ title: 'Sucesso', message: 'CC-e registrada', color: 'green' }); setCceAberto(false) },
      onError: (err: any) => {
        const data = err?.response?.data
        const msg = data?.message || data?.mensagem || 'Falha na CC-e'
        notifications.show({ title: 'Falha na Carta de Correção', message: msg, color: 'red', autoClose: false })
      },
    })
  }

  function handleEnviarEmail() {
    const lista = emails.split(',').map(e => e.trim()).filter(Boolean)
    if (lista.length === 0) { notifications.show({ title: 'Erro', message: 'Informe ao menos um e-mail', color: 'red' }); return }
    enviarEmailMutation.mutate({ id: item.id, emails: lista }, {
      onSuccess: () => { notifications.show({ title: 'Sucesso', message: 'E-mail enviado', color: 'green' }); setEmailAberto(false) },
      onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
    })
  }

  async function handleEventos() {
    setEventosAberto(true)
    setEventosLoading(true)
    try {
      const { data } = await api.get(`/fiscal/cte/${item.id}`)
      setEventos(data.eventos || [])
    } catch {
      setEventos([])
    } finally {
      setEventosLoading(false)
    }
  }

  return (
    <>
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <ActionIcon variant="subtle"><IconDotsVertical size={16} /></ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {['DIGITADA', 'PENDENTE', 'REJEITADO'].includes(item.status) && (
            <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => router.push(`/fiscal/cte/nova?editar=${item.id}`)}>Editar</Menu.Item>
          )}
          {['DIGITADA', 'PENDENTE', 'REJEITADO'].includes(item.status) && (
            <Menu.Item leftSection={<IconSend size={14} />} color="blue" onClick={() => handleTransmitir(item.id)}>Transmitir</Menu.Item>
          )}
          {['DIGITADA', 'PENDENTE', 'REJEITADO'].includes(item.status) && (
            <Menu.Item leftSection={<IconFileCode size={14} />} onClick={() => handleVisualizarXml(item.id)}>Preview XML</Menu.Item>
          )}
          {['AUTORIZADO', 'CANCELADO'].includes(item.status) && (
            <Menu.Item leftSection={<IconFileTypePdf size={14} />} onClick={handleDacte}>DACTE (PDF)</Menu.Item>
          )}
          {item.status !== 'PENDENTE' && (
            <Menu.Item leftSection={<IconFileCode size={14} />} onClick={handleXml}>Baixar XML</Menu.Item>
          )}
          {['AUTORIZADO', 'CANCELADO'].includes(item.status) && (
            <Menu.Item leftSection={<IconMail size={14} />} onClick={() => setEmailAberto(true)}>Enviar por e-mail</Menu.Item>
          )}
          {['AUTORIZADO', 'CANCELADO'].includes(item.status) && (
            <Menu.Item leftSection={<IconHistory size={14} />} onClick={handleEventos}>Eventos</Menu.Item>
          )}
          {['AUTORIZADO', 'CANCELADO', 'PENDENTE'].includes(item.status) && item.chaveAcesso && (
            <Menu.Item leftSection={<IconSearch size={14} />} onClick={() => {
              consultarSefazMutation.mutate(item.id, {
                onSuccess: (result) => { setConsultaSefazResult(result); setConsultaSefazAberto(true) },
                onError: (err: any) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao consultar', color: 'red' }),
              })
            }} disabled={consultarSefazMutation.isPending}>
              {consultarSefazMutation.isPending ? 'Consultando...' : 'Consultar SEFAZ'}
            </Menu.Item>
          )}
          {item.status === 'AUTORIZADO' && (
            <>
              <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => setCceAberto(true)}>Carta de Correção</Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<IconX size={14} />} onClick={() => setCancelarAberto(true)}>Cancelar</Menu.Item>
            </>
          )}
          <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => router.push(`/fiscal/cte/nova?duplicar=${item.id}`)}>Duplicar</Menu.Item>
          {['DIGITADA', 'PENDENTE', 'REJEITADO'].includes(item.status) && (
            <><Menu.Divider /><Menu.Item color="red" leftSection={<IconX size={14} />} onClick={() => handleExcluir(item.id)}>Excluir</Menu.Item></>
          )}
        </Menu.Dropdown>
      </Menu>

      <Modal opened={cancelarAberto} onClose={() => setCancelarAberto(false)} title="Cancelar CT-e">
        <Textarea label="Justificativa (min. 15 caracteres)" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={3} />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setCancelarAberto(false)}>Voltar</Button>
          <Button color="red" loading={cancelarMutation.isPending} onClick={handleCancelar}>Confirmar</Button>
        </Group>
      </Modal>

      <Modal opened={cceAberto} onClose={() => setCceAberto(false)} title="Carta de Correção (CC-e)">
        <Textarea label="Texto (min. 15 caracteres)" value={textoCorrecao} onChange={(e) => setTextoCorrecao(e.target.value)} rows={4} />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setCceAberto(false)}>Voltar</Button>
          <Button color="blue" loading={cartaCorrecaoMutation.isPending} onClick={handleCartaCorrecao}>Registrar</Button>
        </Group>
      </Modal>

      <Modal opened={emailAberto} onClose={() => setEmailAberto(false)} title="Enviar CT-e por e-mail">
        <TextInput label="E-mails (separados por vírgula)" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="email@exemplo.com" />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setEmailAberto(false)}>Cancelar</Button>
          <Button color="blue" loading={enviarEmailMutation.isPending} onClick={handleEnviarEmail}>Enviar</Button>
        </Group>
      </Modal>

      <Modal opened={eventosAberto} onClose={() => setEventosAberto(false)} title={`Eventos — CT-e nº ${item.numero}`} size="lg">
        {eventosLoading ? (
          <Text c="dimmed" ta="center" py="xl">Carregando...</Text>
        ) : eventos.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">Nenhum evento registrado</Text>
        ) : (
          <ScrollArea h={300}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Seq.</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Protocolo</Table.Th>
                  <Table.Th>Descrição</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {eventos.map((ev: any, idx: number) => (
                  <Table.Tr key={ev.id || idx}>
                    <Table.Td>{new Date(ev.dataEvento).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Table.Td>
                    <Table.Td>{ev.tipoEvento === '110111' ? 'Cancelamento' : ev.tipoEvento === '110110' ? 'CC-e' : ev.tipoEvento}</Table.Td>
                    <Table.Td>{ev.sequencia}</Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={ev.status === 'REGISTRADO' ? 'green' : 'red'}>
                        {ev.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td><Text size="xs">{ev.protocolo || '—'}</Text></Table.Td>
                    <Table.Td><Text size="xs" lineClamp={2}>{ev.justificativa || ev.textoCorrecao || '—'}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Modal>

      <Modal opened={consultaSefazAberto} onClose={() => setConsultaSefazAberto(false)} title={`Consulta SEFAZ — CT-e nº ${item.numero}`}>
        {consultaSefazResult && (
          <Stack gap="sm">
            <Group>
              <Text fw={600} size="sm">cStat:</Text>
              <Badge color={consultaSefazResult.cStat === 100 ? 'green' : consultaSefazResult.cStat === 101 ? 'orange' : 'blue'}>
                {consultaSefazResult.cStat}
              </Badge>
            </Group>
            <Group>
              <Text fw={600} size="sm">Motivo:</Text>
              <Text size="sm">{consultaSefazResult.xMotivo}</Text>
            </Group>
            {consultaSefazResult.protocolo && (
              <Group>
                <Text fw={600} size="sm">Protocolo:</Text>
                <Text size="sm">{consultaSefazResult.protocolo}</Text>
              </Group>
            )}
            {consultaSefazResult.dataRecebimento && (
              <Group>
                <Text fw={600} size="sm">Data Recebimento:</Text>
                <Text size="sm">{consultaSefazResult.dataRecebimento}</Text>
              </Group>
            )}
          </Stack>
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setConsultaSefazAberto(false)}>Fechar</Button>
        </Group>
      </Modal>
    </>
  )
}

// =============================================================================
// Página principal — Listagem com seleção em lote
// =============================================================================

export default function CtePage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - CT-e' }, [])

  const qc = useQueryClient()
  const transmitirLoteMutation = useCte().useTransmitirLote()
  const cancelarLoteMutation = useCte().useCancelarLote()
  const enviarEmailLoteMutation = useCte().useEnviarEmailLote()

  // === Filtros ===
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebouncedValue(search, 300)
  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)
  const [dataAutInicio, setDataAutInicio] = useState<Date | null>(null)
  const [dataAutFim, setDataAutFim] = useState<Date | null>(null)
  const limit = 20

  // === Seleção em lote ===
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [loteModalTipo, setLoteModalTipo] = useState<'transmitir' | 'cancelar' | 'email' | null>(null)
  const [loteJustificativa, setLoteJustificativa] = useState('')
  const [loteEmails, setLoteEmails] = useState('')
  const [loteProgresso, setLoteProgresso] = useState<{ total: number; processados: number } | null>(null)

  // === Query ===
  const params: Record<string, unknown> = { page, limit }
  if (status) params.status = status
  if (debouncedSearch) params.numero = debouncedSearch
  if (dataInicio) params.dataInicio = fmt(dataInicio)
  if (dataFim) params.dataFim = fmt(dataFim)
  if (dataAutInicio) params.dataAutorizacaoInicio = fmt(dataAutInicio)
  if (dataAutFim) params.dataAutorizacaoFim = fmt(dataAutFim)

  const { data: response, isLoading } = useQuery<{ data: CteItem[]; total: number; totalPages: number }>({
    queryKey: ['fiscal', 'cte', params],
    queryFn: async () => { const { data } = await api.get('/fiscal/cte', { params }); return data },
    staleTime: 1000 * 60 * 2,
  })

  const items = response?.data ?? []
  const totalPages = response?.totalPages ?? 1

  // === Helpers seleção ===
  const todosVisiveis = items.map(i => i.id)
  const todosSelecionados = todosVisiveis.length > 0 && todosVisiveis.every(id => selecionados.has(id))

  function toggleItem(id: string) {
    setSelecionados(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleTodos() {
    if (todosSelecionados) setSelecionados(prev => { const s = new Set(prev); todosVisiveis.forEach(id => s.delete(id)); return s })
    else setSelecionados(prev => { const s = new Set(prev); todosVisiveis.forEach(id => s.add(id)); return s })
  }
  function limparSelecao() { setSelecionados(new Set()) }

  // === Ações em lote ===
  async function executarLoteTransmitir() {
    const ids = Array.from(selecionados)
    transmitirLoteMutation.mutate(ids, {
      onSuccess: (result: any) => {
        const { resumo } = result
        notifications.show({
          title: 'Lote processado',
          message: `${resumo.autorizados} autorizado(s), ${resumo.rejeitados} rejeitado(s) de ${resumo.total}`,
          color: resumo.rejeitados > 0 ? 'yellow' : 'green',
          autoClose: false,
        })
        limparSelecao()
        setLoteModalTipo(null)
        qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] })
      },
      onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha no lote', color: 'red' }) },
    })
  }

  function executarLoteCancelar() {
    if (loteJustificativa.length < 15) { notifications.show({ title: 'Erro', message: 'Mín. 15 caracteres', color: 'red' }); return }
    const ids = Array.from(selecionados).filter(id => items.find(i => i.id === id)?.status === 'AUTORIZADO')
    cancelarLoteMutation.mutate({ ids, justificativa: loteJustificativa }, {
      onSuccess: (result: any) => {
        notifications.show({ title: 'Lote processado', message: `${result.resumo.cancelados} cancelado(s)`, color: 'green' })
        limparSelecao(); setLoteModalTipo(null)
        qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] })
      },
      onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
    })
  }

  function executarLoteEmail() {
    const lista = loteEmails.split(',').map(e => e.trim()).filter(Boolean)
    if (lista.length === 0) { notifications.show({ title: 'Erro', message: 'Informe e-mails', color: 'red' }); return }
    const ids = Array.from(selecionados).filter(id => ['AUTORIZADO', 'CANCELADO'].includes(items.find(i => i.id === id)?.status || ''))
    enviarEmailLoteMutation.mutate({ ids, emails: lista }, {
      onSuccess: (result: any) => {
        notifications.show({ title: 'Lote processado', message: `${result.resumo.enviados} enviado(s)`, color: 'green' })
        limparSelecao(); setLoteModalTipo(null)
      },
      onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
    })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Fiscal / CT-e</Text>
      <Text size="xl" fw={600} mb="lg">Conhecimento de Transporte Eletrônico (CT-e)</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        {/* Filtros */}
        <Group justify="space-between" mb="md" wrap="wrap">
          <Group gap="xs" wrap="wrap">
            <TextInput placeholder="Nº CT-e" leftSection={<IconSearch size={14} />} value={search}
              onChange={(e) => { setSearch(e.currentTarget.value); setPage(1) }} style={{ width: 120 }} />
            <Select placeholder="Status" data={[
              { value: 'DIGITADA', label: 'Digitada' },
              { value: 'AUTORIZADO', label: 'Autorizado' },
              { value: 'CANCELADO', label: 'Cancelado' },
              { value: 'REJEITADO', label: 'Rejeitado' },
              { value: 'PENDENTE', label: 'Pendente' },
              { value: 'CONTINGENCIA', label: 'Contingência' },
            ]} value={status} onChange={(v) => { setStatus(v); setPage(1) }} clearable style={{ width: 140 }} />
            <DateInput placeholder="Emissão de" value={dataInicio} onChange={(v) => { setDataInicio(v); setPage(1) }}
              clearable valueFormat="DD/MM/YYYY" style={{ width: 130 }} />
            <DateInput placeholder="Emissão até" value={dataFim} onChange={(v) => { setDataFim(v); setPage(1) }}
              clearable valueFormat="DD/MM/YYYY" style={{ width: 130 }} />
            <DateInput placeholder="Autoriz. de" value={dataAutInicio} onChange={(v) => { setDataAutInicio(v); setPage(1) }}
              clearable valueFormat="DD/MM/YYYY" style={{ width: 130 }} />
            <DateInput placeholder="Autoriz. até" value={dataAutFim} onChange={(v) => { setDataAutFim(v); setPage(1) }}
              clearable valueFormat="DD/MM/YYYY" style={{ width: 130 }} />
          </Group>
          <Group gap="xs">
            <Button component={Link} href="/fiscal/cte/importar" variant="light" size="xs" leftSection={<IconFileCode size={14} />}>Importar NF-e</Button>
            <Button component={Link} href="/fiscal/cte/nova" leftSection={<IconPlus size={14} />}>Novo CT-e</Button>
          </Group>
        </Group>

        {/* Barra de ações em lote */}
        {selecionados.size > 0 && (
          <Paper p="xs" mb="sm" withBorder style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
            <Group justify="space-between">
              <Text size="sm" fw={500}>{selecionados.size} selecionado(s)</Text>
              <Group gap="xs">
                <Button size="xs" variant="light" color="blue" onClick={() => setLoteModalTipo('transmitir')}
                  leftSection={<IconSend size={14} />}>Transmitir</Button>
                <Button size="xs" variant="light" color="teal" onClick={() => setLoteModalTipo('email')}
                  leftSection={<IconMail size={14} />}>Enviar e-mail</Button>
                <Button size="xs" variant="light" color="red" onClick={() => setLoteModalTipo('cancelar')}
                  leftSection={<IconX size={14} />}>Cancelar</Button>
                <Button size="xs" variant="subtle" onClick={limparSelecao}>Limpar seleção</Button>
              </Group>
            </Group>
          </Paper>
        )}

        {/* Tabela */}
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 36 }}>
                <Checkbox checked={todosSelecionados} indeterminate={selecionados.size > 0 && !todosSelecionados}
                  onChange={toggleTodos} />
              </Table.Th>
              <Table.Th>Número</Table.Th>
              <Table.Th>Série</Table.Th>
              <Table.Th>Origem → Destino</Table.Th>
              <Table.Th>Tomador/Destinatário</Table.Th>
              <Table.Th>Valor</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Dt. Emissão</Table.Th>
              <Table.Th>Dt. Autorização</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.length === 0 && !isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={10} style={{ textAlign: 'center', padding: '2rem' }}>
                  <Text c="dimmed">Nenhum CT-e encontrado</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              items.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td><Checkbox checked={selecionados.has(item.id)} onChange={() => toggleItem(item.id)} /></Table.Td>
                  <Table.Td>{item.numero}</Table.Td>
                  <Table.Td>{item.serie}</Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{item.origemDestino || '—'}</Text></Table.Td>
                  <Table.Td>{item.tomadorRazao || item.destRazao || '—'}</Table.Td>
                  <Table.Td>{item.valorTotal != null ? item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</Table.Td>
                  <Table.Td><StatusBadge status={item.status} /></Table.Td>
                  <Table.Td>{item.dataEmissao ? new Date(item.dataEmissao).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                  <Table.Td>{item.dataAutorizacao ? new Date(item.dataAutorizacao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</Table.Td>
                  <Table.Td><AcoesMenu item={item} /></Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </Group>
        )}
      </Card>

      {/* Modal: Transmitir em lote */}
      <Modal opened={loteModalTipo === 'transmitir'} onClose={() => setLoteModalTipo(null)} title="Transmitir em lote">
        <Text size="sm" mb="md">
          Serão transmitidos {Array.from(selecionados).filter(id => ['DIGITADA', 'PENDENTE', 'REJEITADO'].includes(items.find(i => i.id === id)?.status || '')).length} CT-e(s)
          com status DIGITADA, PENDENTE ou REJEITADO.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setLoteModalTipo(null)}>Cancelar</Button>
          <Button color="blue" loading={transmitirLoteMutation.isPending} onClick={executarLoteTransmitir}>Transmitir</Button>
        </Group>
      </Modal>

      {/* Modal: Cancelar em lote */}
      <Modal opened={loteModalTipo === 'cancelar'} onClose={() => setLoteModalTipo(null)} title="Cancelar em lote">
        <Text size="sm" mb="sm">
          Serão cancelados {Array.from(selecionados).filter(id => items.find(i => i.id === id)?.status === 'AUTORIZADO').length} CT-e(s) AUTORIZADOS.
        </Text>
        <Textarea label="Justificativa (min. 15 caracteres)" value={loteJustificativa}
          onChange={(e) => setLoteJustificativa(e.target.value)} rows={3} />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setLoteModalTipo(null)}>Voltar</Button>
          <Button color="red" loading={cancelarLoteMutation.isPending} onClick={executarLoteCancelar}>Cancelar selecionados</Button>
        </Group>
      </Modal>

      {/* Modal: Email em lote */}
      <Modal opened={loteModalTipo === 'email'} onClose={() => setLoteModalTipo(null)} title="Enviar por e-mail em lote">
        <Text size="sm" mb="sm">
          Serão enviados {Array.from(selecionados).filter(id => ['AUTORIZADO', 'CANCELADO'].includes(items.find(i => i.id === id)?.status || '')).length} CT-e(s) (XML + PDF).
        </Text>
        <TextInput label="E-mails (separados por vírgula)" value={loteEmails}
          onChange={(e) => setLoteEmails(e.target.value)} placeholder="email@exemplo.com" />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setLoteModalTipo(null)}>Cancelar</Button>
          <Button color="teal" loading={enviarEmailLoteMutation.isPending} onClick={executarLoteEmail}>Enviar</Button>
        </Group>
      </Modal>
    </div>
  )
}

// === Utilitário ===
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}
