'use client'

/**
 * Requisições de Corte (RC) — tela do menu Ordem de Produção.
 *
 * A RC é CRIADA aqui (não mais no painel de Programação). Nasce em RASCUNHO e
 * segue os status da OP: RASCUNHO → PLANEJADA → PROGRAMADA → LIBERADA →
 * EM_PRODUCAO → CONCLUIDA (+ CANCELADA). Só aparece na fila da Programação
 * quando LIBERADA. Na criação escolhe-se a Cortadeira (centro) que vai entrar.
 *
 * Backend: /pcp/requisicoes-corte (CRUD) + /:id/status (transição administrativa).
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Title, Stack, Group, Button, Text, Loader, Center, Paper, Table, Badge,
  Modal, TextInput, Textarea, Select, ScrollArea, ActionIcon, Tooltip,
} from '@mantine/core'
import {
  IconPlus, IconTrash, IconPrinter, IconCircleCheck, IconRefresh,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Status (seguem a OP)
// ============================================================================
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  RASCUNHO: { color: 'gray', label: 'Rascunho' },
  PLANEJADA: { color: 'blue', label: 'Planejada' },
  PROGRAMADA: { color: 'cyan', label: 'Programada' },
  LIBERADA: { color: 'teal', label: 'Liberada' },
  EM_PRODUCAO: { color: 'orange', label: 'Em Produção' },
  CONCLUIDA: { color: 'green', label: 'Concluída' },
  CANCELADA: { color: 'red', label: 'Cancelada' },
}

// Próximo status administrativo possível (fluxo linear até LIBERADA).
const PROXIMO_STATUS: Record<string, string | null> = {
  RASCUNHO: 'PLANEJADA',
  PLANEJADA: 'PROGRAMADA',
  PROGRAMADA: 'LIBERADA',
  LIBERADA: null, // a partir daqui o avanço é operacional (chão de fábrica)
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] || { color: 'gray', label: status }
  return <Badge color={c.color} variant="light">{c.label}</Badge>
}

interface RC {
  id: string
  numero: string
  status: string
  requisitante: string
  fabricanteCartao: string
  nomeProduto: string
  centroProducaoId?: string | null
  dataSolicitacao?: string | null
  formatoCorte?: string | null
}

interface CentroOpt { value: string; label: string; codigo?: string }

const formInicial = {
  dataSolicitacao: new Date().toISOString().slice(0, 10),
  dataCorte: '',
  requisitante: '',
  fabricanteCartao: '',
  fornecedor: '',
  larguraBobinaCm: '',
  gramaturaG: '',
  tamanhoCorteCm: '',
  formatoCorte: '',
  qtdFolhasCortadeira: '',
  textoGuilhotina: '',
  qtdFolhasGuilhotina: '',
  nomeProduto: '',
  nomeServico: '',
  pesoKg: '',
  instrucoesRefile: '',
}

export default function RequisicoesCortePage() {
  const [lista, setLista] = useState<RC[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(formInicial)
  const [cortadeiras, setCortadeiras] = useState<CentroOpt[]>([])
  const [guilhotinas, setGuilhotinas] = useState<CentroOpt[]>([])
  const [cortadeiraId, setCortadeiraId] = useState<string | null>(null)
  const [guilhotinaId, setGuilhotinaId] = useState<string | null>(null)

  useEffect(() => { document.title = 'Requisições de Corte' }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/pcp/requisicoes-corte')
      setLista(Array.isArray(data) ? data : data?.data || [])
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao carregar requisições.', color: 'red' })
    } finally {
      setLoading(false)
    }
  }, [])

  // Centros: cortadeiras (para escolher onde entra) e guilhotinas (destino).
  const carregarCentros = useCallback(async () => {
    try {
      const { data } = await api.get('/centros-producao', { params: { limit: 200 } })
      const centros = (data?.data || data || []) as any[]
      const cort = centros
        .filter((c) => /cortadeira/i.test(c?.tipoProcesso?.codigo || '') || /cortadeira/i.test(c?.descricao || ''))
        .map((c) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}`, codigo: c.codigo }))
      const guil = centros
        .filter((c) => /guilhotina/i.test(c?.tipoProcesso?.codigo || '') || /guilhotina/i.test(c?.descricao || ''))
        .map((c) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}`, codigo: c.codigo }))
      setCortadeiras(cort)
      setGuilhotinas(guil)
    } catch {
      setCortadeiras([]); setGuilhotinas([])
    }
  }, [])

  useEffect(() => { carregar(); carregarCentros() }, [carregar, carregarCentros])

  const abrirNova = () => {
    setForm(formInicial)
    setCortadeiraId(null)
    // Guilhotina default = "Tigger/Trigger" se existir.
    const def = guilhotinas.find((g) => /tigger|trigger/i.test(g.label))?.value ?? null
    setGuilhotinaId(def)
    setModalAberto(true)
  }

  async function salvar(imprimir: boolean) {
    if (!form.requisitante.trim() || !form.fabricanteCartao.trim() || !form.nomeProduto.trim() || !form.nomeServico.trim()) {
      notifications.show({ title: 'Validação', message: 'Preencha Requisitante, Fabricante/Cartão, Nome do produto e Nome do serviço.', color: 'red' })
      return
    }
    if (!cortadeiraId) {
      notifications.show({ title: 'Validação', message: 'Selecione a Cortadeira que vai entrar.', color: 'red' })
      return
    }
    setSalvando(true)
    try {
      const dec = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(/\./g, '').replace(',', '.')))
      const int = (v: string) => (v.trim() === '' ? undefined : Math.round(Number(v.replace(/\./g, '').replace(',', '.'))))
      const payload = {
        centroProducaoId: cortadeiraId,
        dataSolicitacao: form.dataSolicitacao || undefined,
        dataCorte: form.dataCorte || undefined,
        requisitante: form.requisitante,
        fabricanteCartao: form.fabricanteCartao,
        fornecedor: form.fornecedor || undefined,
        larguraBobinaCm: dec(form.larguraBobinaCm),
        gramaturaG: dec(form.gramaturaG),
        tamanhoCorteCm: dec(form.tamanhoCorteCm),
        formatoCorte: form.formatoCorte || undefined,
        qtdFolhasCortadeira: int(form.qtdFolhasCortadeira),
        textoGuilhotina: form.textoGuilhotina || undefined,
        qtdFolhasGuilhotina: int(form.qtdFolhasGuilhotina),
        nomeProduto: form.nomeProduto,
        nomeServico: form.nomeServico,
        pesoKg: dec(form.pesoKg),
        instrucoesRefile: form.instrucoesRefile || undefined,
        guilhotinaDestinoId: guilhotinaId || undefined,
        // Nasce em RASCUNHO (o avanço de status é feito na própria tela).
        status: 'RASCUNHO',
      }
      const { data: rc } = await api.post('/pcp/requisicoes-corte', payload)
      notifications.show({ title: 'RC criada', message: `Requisição de corte Nº ${rc.numero} salva (Rascunho).`, color: 'green' })
      setModalAberto(false)
      await carregar()
      if (imprimir) {
        try {
          const pdf = await api.get(`/pcp/requisicoes-corte/${rc.id}/pdf`, { responseType: 'blob' })
          const url = URL.createObjectURL(new Blob([pdf.data], { type: 'application/pdf' }))
          window.open(url, '_blank')
          setTimeout(() => URL.revokeObjectURL(url), 60000)
        } catch { /* ignore */ }
      }
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar a requisição.', color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  async function avancarStatus(rc: RC) {
    const prox = PROXIMO_STATUS[rc.status]
    if (!prox) return
    try {
      await api.patch(`/pcp/requisicoes-corte/${rc.id}/status`, { status: prox })
      notifications.show({ title: 'Status atualizado', message: `RC ${rc.numero}: ${STATUS_CONFIG[prox]?.label || prox}.`, color: 'green' })
      await carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao mudar status.', color: 'red' })
    }
  }

  async function cancelar(rc: RC) {
    if (!confirm(`Cancelar a Requisição de Corte ${rc.numero}?`)) return
    try {
      await api.patch(`/pcp/requisicoes-corte/${rc.id}/status`, { status: 'CANCELADA' })
      notifications.show({ title: 'RC cancelada', message: `Requisição ${rc.numero} cancelada.`, color: 'orange' })
      await carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao cancelar.', color: 'red' })
    }
  }

  async function excluir(rc: RC) {
    if (!confirm(`Excluir a Requisição de Corte ${rc.numero}? Esta ação é definitiva.`)) return
    try {
      await api.delete(`/pcp/requisicoes-corte/${rc.id}`)
      notifications.show({ title: 'RC excluída', message: `Requisição ${rc.numero} removida.`, color: 'green' })
      await carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir.', color: 'red' })
    }
  }

  async function imprimir(rc: RC) {
    try {
      const pdf = await api.get(`/pcp/requisicoes-corte/${rc.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([pdf.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao gerar PDF.', color: 'red' })
    }
  }

  const nomeCortadeira = (id?: string | null) => cortadeiras.find((c) => c.value === id)?.label ?? '—'
  const fmtData = (d?: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—')

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Requisições de Corte</Title>
          <Text size="sm" c="dimmed">
            Criadas aqui (Ordem de Produção). Só entram na fila da Programação quando <strong>Liberadas</strong>.
          </Text>
        </div>
        <Group gap="xs">
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={carregar}>Atualizar</Button>
          <Button leftSection={<IconPlus size={16} />} onClick={abrirNova}>Nova Requisição de Corte</Button>
        </Group>
      </Group>

      <Paper withBorder p="md">
        {loading ? (
          <Center py="xl"><Loader /></Center>
        ) : lista.length === 0 ? (
          <Text ta="center" c="dimmed" py="md">Nenhuma requisição de corte. Use "Nova Requisição de Corte".</Text>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nº</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Requisitante</Table.Th>
                  <Table.Th>Fabricante / Cartão</Table.Th>
                  <Table.Th>Produto</Table.Th>
                  <Table.Th>Cortadeira</Table.Th>
                  <Table.Th>Solicitação</Table.Th>
                  <Table.Th ta="center">Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lista.map((rc) => {
                  const prox = PROXIMO_STATUS[rc.status]
                  const terminal = rc.status === 'CONCLUIDA' || rc.status === 'CANCELADA'
                  return (
                    <Table.Tr key={rc.id}>
                      <Table.Td fw={600}>{rc.numero}</Table.Td>
                      <Table.Td><StatusBadge status={rc.status} /></Table.Td>
                      <Table.Td>{rc.requisitante}</Table.Td>
                      <Table.Td>{rc.fabricanteCartao}</Table.Td>
                      <Table.Td><Text size="sm" lineClamp={1}>{rc.nomeProduto}</Text></Table.Td>
                      <Table.Td><Text size="sm" c="dimmed">{nomeCortadeira(rc.centroProducaoId)}</Text></Table.Td>
                      <Table.Td>{fmtData(rc.dataSolicitacao)}</Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="center" wrap="nowrap">
                          {prox && (
                            <Tooltip label={`Avançar para ${STATUS_CONFIG[prox]?.label || prox}`}>
                              <Button size="xs" variant="light" color="teal" leftSection={<IconCircleCheck size={14} />} onClick={() => avancarStatus(rc)}>
                                {STATUS_CONFIG[prox!]?.label}
                              </Button>
                            </Tooltip>
                          )}
                          <Tooltip label="Imprimir (1ª via)">
                            <ActionIcon variant="subtle" color="blue" onClick={() => imprimir(rc)}><IconPrinter size={16} /></ActionIcon>
                          </Tooltip>
                          {!terminal && (
                            <Tooltip label="Cancelar">
                              <ActionIcon variant="subtle" color="orange" onClick={() => cancelar(rc)}><IconCircleCheck size={16} style={{ transform: 'rotate(45deg)' }} /></ActionIcon>
                            </Tooltip>
                          )}
                          <Tooltip label="Excluir">
                            <ActionIcon variant="subtle" color="red" onClick={() => excluir(rc)}><IconTrash size={16} /></ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      {/* Modal: Nova Requisição de Corte (mesmo formulário de antes + Cortadeira) */}
      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title="Nova Requisição de Corte" centered size="lg">
        <Stack gap="sm">
          <Select
            label="Cortadeira (vai entrar)"
            description="Centro de produção onde o corte será executado. A RC aparece na fila dele quando liberada."
            placeholder="Selecione a cortadeira"
            data={cortadeiras}
            value={cortadeiraId}
            onChange={setCortadeiraId}
            searchable
            required
          />
          <Group grow>
            <TextInput label="Data da solicitação" type="date" value={form.dataSolicitacao} onChange={(e) => setForm({ ...form, dataSolicitacao: e.currentTarget.value })} />
            <TextInput label="Data do corte" type="date" value={form.dataCorte} onChange={(e) => setForm({ ...form, dataCorte: e.currentTarget.value })} />
          </Group>
          <TextInput label="Requisitante" required placeholder="Ex: CAIO RANGEL" value={form.requisitante} onChange={(e) => setForm({ ...form, requisitante: e.currentTarget.value })} />
          <Group grow>
            <TextInput label="Fabricante / Cartão" required placeholder="Ex: STORA ENZO" value={form.fabricanteCartao} onChange={(e) => setForm({ ...form, fabricanteCartao: e.currentTarget.value })} />
            <TextInput label="Fornecedor" placeholder="Opcional" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <TextInput label="Largura bobina (cm)" placeholder="Ex: 116,8" value={form.larguraBobinaCm} onChange={(e) => setForm({ ...form, larguraBobinaCm: e.currentTarget.value })} />
            <TextInput label="Gramatura (g)" placeholder="Ex: 231" value={form.gramaturaG} onChange={(e) => setForm({ ...form, gramaturaG: e.currentTarget.value })} />
            <TextInput label="Tamanho do corte (cm)" placeholder="Ex: 97,0" value={form.tamanhoCorteCm} onChange={(e) => setForm({ ...form, tamanhoCorteCm: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <TextInput label="Formato corte" placeholder="Ex: 116,8 x 97,0" value={form.formatoCorte} onChange={(e) => setForm({ ...form, formatoCorte: e.currentTarget.value })} />
            <TextInput label="Qtd folhas (cortadeira)" placeholder="Ex: 5834" value={form.qtdFolhasCortadeira} onChange={(e) => setForm({ ...form, qtdFolhasCortadeira: e.currentTarget.value })} />
          </Group>
          <Select
            label="Guilhotina destino"
            description="Para onde a RC segue quando o corte terminar (padrão: Guilhotina Tigger)."
            placeholder="Selecione a guilhotina"
            data={guilhotinas}
            value={guilhotinaId}
            onChange={setGuilhotinaId}
            clearable
            searchable
          />
          <Group grow>
            <TextInput label="Guilhotina (observação)" placeholder="Ex: Segue observação" value={form.textoGuilhotina} onChange={(e) => setForm({ ...form, textoGuilhotina: e.currentTarget.value })} />
            <TextInput label="Qtd folhas (guilhotina)" placeholder="Opcional" value={form.qtdFolhasGuilhotina} onChange={(e) => setForm({ ...form, qtdFolhasGuilhotina: e.currentTarget.value })} />
          </Group>
          <TextInput label="Nome do produto" required placeholder="Ex: CORTE PARA ACTUAL - STORA ENZO 231G - 116,8 CM" value={form.nomeProduto} onChange={(e) => setForm({ ...form, nomeProduto: e.currentTarget.value })} />
          <TextInput label="Nome do serviço" required placeholder="Ex: CORTE PARA ACTUAL - STORA ENZO 231G - 116,8 CM" value={form.nomeServico} onChange={(e) => setForm({ ...form, nomeServico: e.currentTarget.value })} />
          <TextInput label="Peso (kg)" placeholder="Ex: 1527,0" value={form.pesoKg} onChange={(e) => setForm({ ...form, pesoKg: e.currentTarget.value })} />
          <Textarea label="Instruções de refile" placeholder="Ex: REFILAR 5.824 FOLHAS 47,5 x 97,0 CM" minRows={2} autosize value={form.instrucoesRefile} onChange={(e) => setForm({ ...form, instrucoesRefile: e.currentTarget.value })} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => salvar(false)} loading={salvando}>Salvar</Button>
            <Button color="grape" onClick={() => salvar(true)} loading={salvando}>Salvar e Imprimir</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
