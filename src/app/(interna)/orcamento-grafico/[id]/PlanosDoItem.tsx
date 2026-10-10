'use client'

/**
 * PlanosDoItem — editor dos "Planos do Cálculo" de UM item de orçamento gráfico
 * (Task 11 da spec orcamento-grafico-op-relatorio-paridade; Req 4.1, 4.2, 5.6).
 *
 * Um item pode ter vários planos (ex.: TAMPA, CAIXA, BOLSA / FRENTE+COSTA), cada
 * um com formato/cores/suporte/máquina próprios. O custo do item é a soma dos
 * planos (reconsolidação feita no backend a cada mutation).
 *
 * Rotas (prefixo /orcamento-grafico, via @/lib/api):
 *   POST   /:id/itens/:itemId/planos            → cria plano (201 + plano)
 *   PUT    /:id/itens/:itemId/planos/:planoId    → edita (mesmo body) + recálculo
 *   DELETE /:id/itens/:itemId/planos/:planoId    → remove
 *   POST   /:id/itens/:itemId/planos/:planoId/calcular → recalcula
 *
 * NÃO existe rota GET dedicada de planos e o GET /:id do orçamento ainda não
 * traz `itens[].planos`. Então a lista é mantida em estado local: hidratada do
 * campo `planosIniciais` (quando o backend passar a devolvê-lo no item) e
 * atualizada a partir do retorno de cada mutation. Após qualquer mutation o
 * componente chama `onChanged()` para a página recarregar o GET do orçamento
 * (totais do item/orçamento reconsolidados).
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Stack, Group, Button, Text, Table, Modal, TextInput, NumberInput, Select,
  Loader, ActionIcon, Tooltip, ScrollArea, Badge, Paper, SimpleGrid, Collapse,
} from '@mantine/core'
import {
  IconPlus, IconEdit, IconTrash, IconCalculator, IconArrowRight, IconHistory,
  IconChevronDown, IconChevronRight,
} from '@tabler/icons-react'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'

// ============================================================================
// Tipos
// ============================================================================

export interface PlanoCalculo {
  id: string
  sequencia: number
  nome: string
  suporteId?: string | null
  suporteProducaoId?: string | null
  gramatura?: number | string | null
  formatoLarguraMm: number | string
  formatoAlturaMm: number | string
  numCores: number
  maquinaId?: string | null
  montagemLinhas?: number | string | null
  montagemColunas?: number | string | null
  custoSuporte?: number | string | null
  custoImpressao?: number | string | null
  custoAcabamento?: number | string | null
  /** Rótulo "X → Y" quando o suporte de produção difere do orçado (null = sem troca). */
  rotuloTrocaSuporte?: string | null
}

/** Registro do histórico de trocas de suporte (GET .../historico-troca-suporte). */
export interface TrocaSuporte {
  id: string
  itemId: string
  planoId?: string | null
  suporteAnteriorId?: string | null
  suporteNovoId?: string | null
  suporteAnteriorNome?: string | null
  suporteNovoNome?: string | null
  usuarioId?: string | null
  trocadoEm: string
}

interface Props {
  orcamentoId: string
  itemId: string
  /** Planos vindos do GET do orçamento (quando disponível). Semeia o estado. */
  planosIniciais?: PlanoCalculo[] | null
  /** Suporte de produção já definido no nível do item (quando sem planos). */
  suporteProducaoItemInicial?: string | null
  /** Rótulo de troca no nível do item ("X → Y") vindo do GET, quando houver. */
  rotuloTrocaItemInicial?: string | null
  /** Edição permitida apenas em rascunho (mesma regra dos itens). */
  podeEditar: boolean
  /** Chamado após cada mutation para a página recarregar o orçamento. */
  onChanged: () => void
}

// Formulário do plano (campos do planoBodySchema do backend).
interface PlanoForm {
  nome: string
  suporteId: string | null
  gramatura: number | ''
  formatoLarguraMm: number | ''
  formatoAlturaMm: number | ''
  numCores: number | ''
  maquinaId: string | null
  montagemLinhas: number | ''
  montagemColunas: number | ''
}

const FORM_VAZIO: PlanoForm = {
  nome: '',
  suporteId: null,
  gramatura: '',
  formatoLarguraMm: '',
  formatoAlturaMm: '',
  numCores: 4,
  maquinaId: null,
  montagemLinhas: '',
  montagemColunas: '',
}

// ============================================================================
// Formatadores
// ============================================================================

function toNum(val: number | string | null | undefined): number {
  if (val == null) return 0
  const n = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(n) ? 0 : n
}

function formatCurrency(val: number | string | null | undefined): string {
  const num = toNum(val)
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Custo total do plano = suporte + impressão + acabamento. */
function custoTotalPlano(p: PlanoCalculo): number {
  return toNum(p.custoSuporte) + toNum(p.custoImpressao) + toNum(p.custoAcabamento)
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR')
}

// ============================================================================
// Componente
// ============================================================================

export default function PlanosDoItem({ orcamentoId, itemId, planosIniciais, suporteProducaoItemInicial, rotuloTrocaItemInicial, podeEditar, onChanged }: Props) {
  const [planos, setPlanos] = useState<PlanoCalculo[]>(planosIniciais ?? [])

  // Re-semeia quando o pai recarrega e passa novos planos (ex.: após onChanged).
  useEffect(() => {
    if (planosIniciais) setPlanos(planosIniciais)
  }, [planosIniciais])

  // ----- Suporte de produção: lista completa de suportes (sempre carregada) -----
  // Diferente da busca server-side do modal, aqui precisamos da lista disponível
  // para os Selects inline de cada linha (plano e nível de item), fora do modal.
  const [suportesProducao, setSuportesProducao] = useState<{ value: string; label: string }[]>([])
  const [trocandoSuporte, setTrocandoSuporte] = useState<string | null>(null)

  useEffect(() => {
    api.get('/orcamento-grafico/suportes', { params: { limit: 200 } })
      .then(({ data }) => {
        const items = (Array.isArray(data) ? data : data.data || []).map((s: any) => ({
          value: s.id,
          label: s.descricao || s.codigo || s.id,
        }))
        setSuportesProducao(items)
      })
      .catch(() => setSuportesProducao([]))
  }, [])

  // ----- Suporte de produção no nível do ITEM (quando não há planos) -----
  const [suporteProducaoItem, setSuporteProducaoItem] = useState<string | null>(suporteProducaoItemInicial ?? null)
  const [rotuloTrocaItem, setRotuloTrocaItem] = useState<string | null>(rotuloTrocaItemInicial ?? null)
  const [trocandoItem, setTrocandoItem] = useState(false)

  // Re-semeia o suporte/rótulo do item quando o pai recarrega.
  useEffect(() => {
    setSuporteProducaoItem(suporteProducaoItemInicial ?? null)
    setRotuloTrocaItem(rotuloTrocaItemInicial ?? null)
  }, [suporteProducaoItemInicial, rotuloTrocaItemInicial])

  // ----- Histórico de trocas de suporte (accordion por item) -----
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [historico, setHistorico] = useState<TrocaSuporte[]>([])
  const [historicoCarregado, setHistoricoCarregado] = useState(false)
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  // Modal de form (novo/editar)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<PlanoCalculo | null>(null)
  const [form, setForm] = useState<PlanoForm>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)

  // Remoção / recálculo
  const [planoParaRemover, setPlanoParaRemover] = useState<PlanoCalculo | null>(null)
  const [removendo, setRemovendo] = useState(false)
  const [recalculandoId, setRecalculandoId] = useState<string | null>(null)

  // ----- Fontes de dados dos Selects (suportes + máquinas de impressão) -----
  const [suportes, setSuportes] = useState<{ value: string; label: string }[]>([])
  const [termoSuporte, setTermoSuporte] = useState('')
  const [debouncedSuporte] = useDebouncedValue(termoSuporte, 300)
  const [loadingSuportes, setLoadingSuportes] = useState(false)

  const [maquinas, setMaquinas] = useState<{ value: string; label: string }[]>([])

  // Busca de suportes server-side (mesmo padrão do StepPapel).
  useEffect(() => {
    if (!modalAberto) return
    const termo = debouncedSuporte.trim()
    setLoadingSuportes(true)
    api.get('/orcamento-grafico/suportes', {
      params: { limit: 50, ...(termo.length >= 2 ? { busca: termo } : {}) },
    })
      .then(({ data }) => {
        const items = (Array.isArray(data) ? data : data.data || []).map((s: any) => ({
          value: s.id,
          label: s.descricao,
        }))
        setSuportes(items)
      })
      .catch(() => setSuportes([]))
      .finally(() => setLoadingSuportes(false))
  }, [debouncedSuporte, modalAberto])

  // Máquinas de impressão (centros de produção do tipo IMPRESSAO) — igual StepRevisao.
  useEffect(() => {
    if (!modalAberto) return
    api.get('/centros-producao', { params: { limit: 100 } })
      .then(({ data }) => {
        const items = (data.data || data || [])
          .filter((c: any) => c?.tipoProcesso?.codigo === 'IMPRESSAO' || /impress/i.test(c?.tipoProcesso?.descricao || ''))
          .map((c: any) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}` }))
        setMaquinas(items)
      })
      .catch(() => setMaquinas([]))
  }, [modalAberto])

  // Nome amigável do suporte para a coluna da tabela.
  const nomeSuporte = useCallback((id?: string | null): string => {
    if (!id) return '—'
    return suportes.find(s => s.value === id)?.label ?? '—'
  }, [suportes])

  // ----- Abertura do form -----
  const abrirNovo = () => {
    setEditando(null)
    setForm(FORM_VAZIO)
    setTermoSuporte('')
    setModalAberto(true)
  }

  const abrirEdicao = (p: PlanoCalculo) => {
    setEditando(p)
    setForm({
      nome: p.nome,
      suporteId: p.suporteId ?? null,
      gramatura: p.gramatura != null ? toNum(p.gramatura) : '',
      formatoLarguraMm: toNum(p.formatoLarguraMm),
      formatoAlturaMm: toNum(p.formatoAlturaMm),
      numCores: p.numCores,
      maquinaId: p.maquinaId ?? null,
      montagemLinhas: p.montagemLinhas != null ? toNum(p.montagemLinhas) : '',
      montagemColunas: p.montagemColunas != null ? toNum(p.montagemColunas) : '',
    })
    // Garante que o suporte selecionado apareça como option mesmo sem busca.
    if (p.suporteId) {
      setSuportes(prev => prev.some(s => s.value === p.suporteId)
        ? prev
        : [{ value: p.suporteId!, label: p.nome }, ...prev])
    }
    setTermoSuporte('')
    setModalAberto(true)
  }

  // ----- Montagem do payload (planoBodySchema) -----
  function montarPayload(): Record<string, unknown> | null {
    if (!form.nome.trim()) {
      notifications.show({ title: 'Validação', message: 'Informe o nome do plano.', color: 'red' })
      return null
    }
    if (!form.formatoLarguraMm || !form.formatoAlturaMm) {
      notifications.show({ title: 'Validação', message: 'Informe a largura e a altura do formato (mm).', color: 'red' })
      return null
    }
    return {
      nome: form.nome.trim(),
      suporteId: form.suporteId || undefined,
      gramatura: form.gramatura !== '' && Number(form.gramatura) > 0 ? Number(form.gramatura) : undefined,
      formatoLarguraMm: Number(form.formatoLarguraMm),
      formatoAlturaMm: Number(form.formatoAlturaMm),
      numCores: form.numCores === '' ? 0 : Number(form.numCores),
      maquinaId: form.maquinaId || undefined,
      montagemLinhas: form.montagemLinhas !== '' ? Number(form.montagemLinhas) : undefined,
      montagemColunas: form.montagemColunas !== '' ? Number(form.montagemColunas) : undefined,
    }
  }

  // ----- Salvar (POST ou PUT) -----
  const salvar = async () => {
    const payload = montarPayload()
    if (!payload) return
    setSalvando(true)
    try {
      if (editando) {
        const { data } = await api.put(
          `/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos/${editando.id}`,
          payload,
        )
        setPlanos(prev => prev.map(p => (p.id === editando.id ? data : p)))
        notifications.show({ title: 'Plano atualizado', message: 'Plano recalculado e item reconsolidado.', color: 'green' })
      } else {
        const { data } = await api.post(
          `/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos`,
          payload,
        )
        setPlanos(prev => [...prev, data])
        notifications.show({ title: 'Plano criado', message: 'Plano calculado e item reconsolidado.', color: 'green' })
      }
      setModalAberto(false)
      onChanged()
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao salvar plano',
        message: err?.response?.data?.message || 'Falha ao salvar o plano.',
        color: 'red',
      })
    } finally {
      setSalvando(false)
    }
  }

  // ----- Remover (DELETE) -----
  const confirmarRemocao = async () => {
    if (!planoParaRemover) return
    setRemovendo(true)
    try {
      await api.delete(`/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos/${planoParaRemover.id}`)
      setPlanos(prev => prev.filter(p => p.id !== planoParaRemover.id))
      notifications.show({ title: 'Plano removido', message: 'Item reconsolidado.', color: 'orange' })
      setPlanoParaRemover(null)
      onChanged()
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao remover',
        message: err?.response?.data?.message || 'Falha ao remover o plano.',
        color: 'red',
      })
    } finally {
      setRemovendo(false)
    }
  }

  // ----- Recalcular (POST .../calcular) -----
  const recalcular = async (p: PlanoCalculo) => {
    setRecalculandoId(p.id)
    try {
      const payload = {
        nome: p.nome,
        suporteId: p.suporteId || undefined,
        gramatura: p.gramatura != null && toNum(p.gramatura) > 0 ? toNum(p.gramatura) : undefined,
        formatoLarguraMm: toNum(p.formatoLarguraMm),
        formatoAlturaMm: toNum(p.formatoAlturaMm),
        numCores: p.numCores,
        maquinaId: p.maquinaId || undefined,
        montagemLinhas: p.montagemLinhas != null ? toNum(p.montagemLinhas) : undefined,
        montagemColunas: p.montagemColunas != null ? toNum(p.montagemColunas) : undefined,
      }
      const { data } = await api.post(
        `/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos/${p.id}/calcular`,
        payload,
      )
      const planoAtualizado: PlanoCalculo = data?.plano ?? data
      setPlanos(prev => prev.map(x => (x.id === p.id ? { ...x, ...planoAtualizado } : x)))
      notifications.show({ title: 'Plano recalculado', message: 'Item reconsolidado.', color: 'green' })
      onChanged()
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao recalcular',
        message: err?.response?.data?.message || 'Falha ao recalcular o plano.',
        color: 'red',
      })
    } finally {
      setRecalculandoId(null)
    }
  }

  // ----- Trocar suporte de produção de um PLANO -----
  const trocarSuportePlano = async (plano: PlanoCalculo, suporteProducaoId: string | null) => {
    if (!suporteProducaoId) return
    setTrocandoSuporte(plano.id)
    try {
      const { data } = await api.patch(
        `/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos/${plano.id}/suporte-producao`,
        { suporteProducaoId },
      )
      setPlanos(prev => prev.map(p => (p.id === plano.id
        ? { ...p, suporteProducaoId: data?.suporteNovoId ?? suporteProducaoId, rotuloTrocaSuporte: data?.rotuloTrocaSuporte ?? null }
        : p)))
      // Nova troca registrada → invalida histórico para recarregar ao abrir.
      setHistoricoCarregado(false)
      notifications.show({
        title: 'Suporte de produção atualizado',
        message: data?.rotuloTrocaSuporte
          ? `Troca registrada: ${data.rotuloTrocaSuporte}`
          : 'Suporte de produção igual ao orçado.',
        color: 'green',
      })
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao trocar suporte',
        message: err?.response?.data?.message || 'Falha ao atualizar o suporte de produção.',
        color: 'red',
      })
    } finally {
      setTrocandoSuporte(null)
    }
  }

  // ----- Trocar suporte de produção no nível do ITEM (sem planos) -----
  const trocarSuporteItem = async (suporteProducaoId: string | null) => {
    if (!suporteProducaoId) return
    setTrocandoItem(true)
    try {
      const { data } = await api.patch(
        `/orcamento-grafico/${orcamentoId}/itens/${itemId}/suporte-producao`,
        { suporteProducaoId },
      )
      setSuporteProducaoItem(data?.suporteNovoId ?? suporteProducaoId)
      setRotuloTrocaItem(data?.rotuloTrocaSuporte ?? null)
      setHistoricoCarregado(false)
      notifications.show({
        title: 'Suporte de produção atualizado',
        message: data?.rotuloTrocaSuporte
          ? `Troca registrada: ${data.rotuloTrocaSuporte}`
          : 'Suporte de produção igual ao orçado.',
        color: 'green',
      })
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao trocar suporte',
        message: err?.response?.data?.message || 'Falha ao atualizar o suporte de produção.',
        color: 'red',
      })
    } finally {
      setTrocandoItem(false)
    }
  }

  // ----- Histórico de trocas de suporte (carrega ao abrir) -----
  const toggleHistorico = async () => {
    const abrindo = !historicoAberto
    setHistoricoAberto(abrindo)
    if (abrindo && !historicoCarregado) {
      setLoadingHistorico(true)
      try {
        const { data } = await api.get(
          `/orcamento-grafico/${orcamentoId}/itens/${itemId}/historico-troca-suporte`,
        )
        setHistorico(Array.isArray(data) ? data : data?.data || [])
        setHistoricoCarregado(true)
      } catch (err: any) {
        notifications.show({
          title: 'Erro ao carregar histórico',
          message: err?.response?.data?.message || 'Falha ao buscar o histórico de trocas.',
          color: 'red',
        })
        setHistorico([])
      } finally {
        setLoadingHistorico(false)
      }
    }
  }

  const totalPlanos = planos.reduce((s, p) => s + custoTotalPlano(p), 0)
  const planosOrdenados = [...planos].sort((a, b) => a.sequencia - b.sequencia)

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={600} size="sm">Planos do Cálculo</Text>
        {podeEditar && (
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={abrirNovo}>
            Novo plano
          </Button>
        )}
      </Group>

      <ScrollArea>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={50}>Seq.</Table.Th>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Suporte orçado</Table.Th>
              <Table.Th w={260}>Suporte de produção</Table.Th>
              <Table.Th>Formato (L×A)</Table.Th>
              <Table.Th ta="center">Cores</Table.Th>
              <Table.Th ta="right">Custo do plano</Table.Th>
              <Table.Th w={120} ta="center">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {planosOrdenados.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td fw={600}>{p.sequencia}</Table.Td>
                <Table.Td>{p.nome}</Table.Td>
                <Table.Td>
                  <Text size="sm" c={p.suporteId ? undefined : 'dimmed'}>{nomeSuporte(p.suporteId)}</Text>
                </Table.Td>
                <Table.Td>
                  <Stack gap={4}>
                    <Select
                      size="xs"
                      placeholder="Selecione o suporte"
                      data={suportesProducao}
                      value={p.suporteProducaoId ?? p.suporteId ?? null}
                      onChange={(v) => trocarSuportePlano(p, v)}
                      disabled={!podeEditar || trocandoSuporte === p.id}
                      rightSection={trocandoSuporte === p.id ? <Loader size={12} /> : undefined}
                      searchable
                      comboboxProps={{ withinPortal: true }}
                    />
                    {p.rotuloTrocaSuporte && (
                      <Badge
                        color="orange"
                        variant="light"
                        size="sm"
                        leftSection={<IconArrowRight size={11} />}
                      >
                        Suporte alterado na produção: {p.rotuloTrocaSuporte}
                      </Badge>
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  {toNum(p.formatoLarguraMm).toLocaleString('pt-BR')} × {toNum(p.formatoAlturaMm).toLocaleString('pt-BR')} mm
                </Table.Td>
                <Table.Td ta="center">
                  <Badge variant="light" color="blue">{p.numCores}</Badge>
                </Table.Td>
                <Table.Td ta="right" fw={600}>{formatCurrency(custoTotalPlano(p))}</Table.Td>
                <Table.Td>
                  <Group gap={4} justify="center">
                    <Tooltip label="Recalcular plano">
                      <ActionIcon
                        variant="subtle"
                        color="teal"
                        loading={recalculandoId === p.id}
                        onClick={() => recalcular(p)}
                      >
                        <IconCalculator size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={podeEditar ? 'Editar plano' : 'Edição só em rascunho'}>
                      <ActionIcon variant="subtle" color="blue" onClick={() => abrirEdicao(p)} disabled={!podeEditar}>
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={podeEditar ? 'Remover plano' : 'Remoção só em rascunho'}>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setPlanoParaRemover(p)}
                        disabled={!podeEditar}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {planosOrdenados.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text ta="center" c="dimmed" py="sm" size="sm">
                    Nenhum plano neste item.{podeEditar ? ' Use "Novo plano" para adicionar.' : ''}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
          {planosOrdenados.length > 0 && (
            <Table.Tfoot>
              <Table.Tr>
                <Table.Td colSpan={6} ta="right" fw={700}>Total dos planos</Table.Td>
                <Table.Td ta="right" fw={700} c="red">{formatCurrency(totalPlanos)}</Table.Td>
                <Table.Td />
              </Table.Tr>
            </Table.Tfoot>
          )}
        </Table>
      </ScrollArea>

      {/* =================================================================== */}
      {/* Suporte de produção no NÍVEL DO ITEM (quando o item não tem planos)  */}
      {/* =================================================================== */}
      {planosOrdenados.length === 0 && (
        <Paper p="sm" withBorder radius="sm">
          <Group gap="sm" align="flex-end" wrap="wrap">
            <Select
              label="Suporte de produção (item)"
              description="Suporte efetivamente usado na produção deste item"
              placeholder="Selecione o suporte"
              data={suportesProducao}
              value={suporteProducaoItem}
              onChange={trocarSuporteItem}
              disabled={!podeEditar || trocandoItem}
              rightSection={trocandoItem ? <Loader size={12} /> : undefined}
              searchable
              comboboxProps={{ withinPortal: true }}
              w={300}
            />
            {rotuloTrocaItem && (
              <Badge
                color="orange"
                variant="light"
                size="lg"
                leftSection={<IconArrowRight size={13} />}
              >
                Suporte alterado na produção: {rotuloTrocaItem}
              </Badge>
            )}
          </Group>
        </Paper>
      )}

      {/* =================================================================== */}
      {/* Histórico de trocas de suporte (sempre visível, carrega ao abrir)    */}
      {/* =================================================================== */}
      <Paper withBorder radius="sm">
        <Group
          justify="space-between"
          p="xs"
          style={{ cursor: 'pointer' }}
          onClick={toggleHistorico}
        >
          <Group gap={6}>
            <IconHistory size={16} />
            <Text size="sm" fw={600}>Histórico de trocas de suporte</Text>
          </Group>
          {historicoAberto ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
        </Group>
        <Collapse in={historicoAberto}>
          <div style={{ padding: 'var(--mantine-spacing-xs)' }}>
            {loadingHistorico ? (
              <Group justify="center" py="sm"><Loader size="sm" /></Group>
            ) : historico.length === 0 ? (
              <Text ta="center" c="dimmed" py="sm" size="sm">Nenhuma troca registrada</Text>
            ) : (
              <ScrollArea>
                <Table striped withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Data</Table.Th>
                      <Table.Th>Suporte anterior</Table.Th>
                      <Table.Th>Suporte novo</Table.Th>
                      <Table.Th>Usuário</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {historico.map((h) => (
                      <Table.Tr key={h.id}>
                        <Table.Td>{formatDateTime(h.trocadoEm)}</Table.Td>
                        <Table.Td>
                          <Text size="sm" c={h.suporteAnteriorNome ? undefined : 'dimmed'}>
                            {h.suporteAnteriorNome || '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            <IconArrowRight size={13} />
                            <Text size="sm">{h.suporteNovoNome || '—'}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c={h.usuarioId ? undefined : 'dimmed'}>{h.usuarioId || '—'}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </div>
        </Collapse>
      </Paper>

      {/* Modal de form (novo/editar plano) */}
      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? `Editar Plano #${editando.sequencia}` : 'Novo Plano'}
        size="lg"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Nome do plano"
            placeholder="Ex.: TAMPA, CAIXA, FRENTE"
            value={form.nome}
            onChange={(e) => setForm(f => ({ ...f, nome: e.currentTarget.value }))}
            required
            maxLength={60}
          />

          <Select
            label="Suporte (Papel/Cartão)"
            placeholder="Digite para buscar (ex.: Duplex 280)"
            data={suportes}
            value={form.suporteId}
            onChange={(v) => setForm(f => ({ ...f, suporteId: v }))}
            searchable
            searchValue={termoSuporte}
            onSearchChange={setTermoSuporte}
            filter={({ options }) => options}
            rightSection={loadingSuportes ? <Loader size={14} /> : null}
            nothingFoundMessage={
              loadingSuportes ? 'Buscando...' :
              termoSuporte.trim().length < 2 ? 'Digite ao menos 2 letras' :
              'Nenhum suporte encontrado'
            }
            comboboxProps={{ withinPortal: true }}
            clearable
          />

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <NumberInput
              label="Formato largura"
              placeholder="mm"
              suffix=" mm"
              value={form.formatoLarguraMm}
              onChange={(v) => setForm(f => ({ ...f, formatoLarguraMm: typeof v === 'number' ? v : '' }))}
              min={0}
              required
            />
            <NumberInput
              label="Formato altura"
              placeholder="mm"
              suffix=" mm"
              value={form.formatoAlturaMm}
              onChange={(v) => setForm(f => ({ ...f, formatoAlturaMm: typeof v === 'number' ? v : '' }))}
              min={0}
              required
            />
            <NumberInput
              label="Nº de cores"
              value={form.numCores}
              onChange={(v) => setForm(f => ({ ...f, numCores: typeof v === 'number' ? v : '' }))}
              min={0}
              max={12}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <NumberInput
              label="Gramatura"
              description="Opcional (g/m²)"
              placeholder="Ex.: 300"
              suffix=" g/m²"
              value={form.gramatura}
              onChange={(v) => setForm(f => ({ ...f, gramatura: typeof v === 'number' ? v : '' }))}
              min={0}
              max={2000}
            />
            <NumberInput
              label="Montagem (linhas)"
              placeholder="Opcional"
              value={form.montagemLinhas}
              onChange={(v) => setForm(f => ({ ...f, montagemLinhas: typeof v === 'number' ? v : '' }))}
              min={1}
            />
            <NumberInput
              label="Montagem (colunas)"
              placeholder="Opcional"
              value={form.montagemColunas}
              onChange={(v) => setForm(f => ({ ...f, montagemColunas: typeof v === 'number' ? v : '' }))}
              min={1}
            />
          </SimpleGrid>

          <Select
            label="Máquina de impressão"
            placeholder="Opcional — padrão do item"
            data={maquinas}
            value={form.maquinaId}
            onChange={(v) => setForm(f => ({ ...f, maquinaId: v }))}
            searchable
            clearable
            comboboxProps={{ withinPortal: true }}
          />

          {editando && (
            <Paper p="xs" withBorder bg="var(--mantine-color-gray-light)">
              <Group gap="lg">
                <Text size="xs" c="dimmed">Suporte: {formatCurrency(editando.custoSuporte)}</Text>
                <Text size="xs" c="dimmed">Impressão: {formatCurrency(editando.custoImpressao)}</Text>
                <Text size="xs" c="dimmed">Acabamento: {formatCurrency(editando.custoAcabamento)}</Text>
                <Text size="xs" fw={600}>Total: {formatCurrency(custoTotalPlano(editando))}</Text>
              </Group>
            </Paper>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvar} loading={salvando}>
              {editando ? 'Salvar plano' : 'Adicionar plano'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Confirmação de remoção */}
      <Modal
        opened={!!planoParaRemover}
        onClose={() => setPlanoParaRemover(null)}
        title="Remover Plano"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Remover o plano #{planoParaRemover?.sequencia} ({planoParaRemover?.nome})?
            O custo do item será reconsolidado.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPlanoParaRemover(null)} disabled={removendo}>
              Cancelar
            </Button>
            <Button color="red" onClick={confirmarRemocao} loading={removendo}>
              Remover
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
