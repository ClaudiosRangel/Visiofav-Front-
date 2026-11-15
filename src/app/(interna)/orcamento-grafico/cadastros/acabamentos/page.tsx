'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  Modal, TextInput, Select, NumberInput, ActionIcon, ScrollArea, Divider, SimpleGrid, Pagination,
  Checkbox, Paper, TagsInput, Tabs, Textarea, MultiSelect,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import { relacoesApi, mensagemErroApi } from '../_shared/cadastros-graficos.api'

// ============================================================================
// Cadastro de ACABAMENTOS do Orçamento Gráfico (paridade relatório Calcgraf).
// Substitui a lista fixa de 5 acabamentos do wizard. A `naturezaCusto` define
// como o custo entra no orçamento:
//   HORA_MAQUINA → entra no Custo de Transformação (centro × tempo × custo-hora)
//   MATERIAL_KG / MATERIAL_UN → entra no Material Direto (variável × preço)
//   CUSTO_FIXO   → valor fixo no Material Direto (ex.: faca/matriz)
// ============================================================================

interface Acabamento {
  id: string
  codigo: string
  nome: string
  tipoAtividade: string
  planoProduto: string
  naturezaCusto: string
  precoUnitario: number | null
  custoHora: number | null
  producaoHora: number | null
  quantAcertos: number | null
  tempoPorAcertoMin: number | null
  tempoPrimeiroAcertoMin: number | null
  unidadeBase: string | null
  exigeRestricao: boolean
  // P16 — materiais informativos por atividade (lista de nomes). Só texto.
  materiais?: string[] | null
  // Campos novos (opcionais) — spec orcamento-grafico-cadastros-relacoes
  acondicionamento?: boolean | null
  textoProposta?: string | null
  exibirNomePlano?: boolean | null
  caracteristicas?: Record<string, unknown> | null
  status: boolean
}

interface Restricao {
  id: string
  acabamentoGraficoId: string
  empresaId: string
  nome: string
  tempoAcertoMin: number | string
  tempoOperacaoMin: number | string
  exibirNaProposta?: boolean | null
  centroProducaoId?: string | null
  criadoEm: string
}

interface RestricaoForm {
  nome: string
  tempoAcertoMin: number | ''
  tempoOperacaoMin: number | ''
  exibirNaProposta: boolean
  centroProducaoId: string | null
}

const RESTRICAO_FORM_INICIAL: RestricaoForm = {
  nome: '', tempoAcertoMin: '', tempoOperacaoMin: '', exibirNaProposta: false, centroProducaoId: null,
}

interface FormData {
  codigo: string
  nome: string
  tipoAtividade: string
  planoProduto: string
  naturezaCusto: string
  precoUnitario: number | ''
  custoHora: number | ''
  producaoHora: number | ''
  quantAcertos: number | ''
  tempoPorAcertoMin: number | ''
  tempoPrimeiroAcertoMin: number | ''
  unidadeBase: string
  exigeRestricao: boolean
  // P16 — materiais informativos (lista de nomes). Editado como TagsInput.
  materiais: string[]
  acondicionamento: boolean
  textoProposta: string
  exibirNomePlano: boolean
  caracteristicas: string // JSON em texto (vazio = não informado)
}

const FORM_INICIAL: FormData = {
  codigo: '',
  nome: '',
  tipoAtividade: 'ACABAMENTO',
  planoProduto: 'PLANO',
  naturezaCusto: 'HORA_MAQUINA',
  precoUnitario: '',
  custoHora: '',
  producaoHora: '',
  quantAcertos: '',
  tempoPorAcertoMin: '',
  tempoPrimeiroAcertoMin: '',
  unidadeBase: 'FOLHA',
  exigeRestricao: false,
  materiais: [],
  acondicionamento: false,
  textoProposta: '',
  exibirNomePlano: false,
  caracteristicas: '',
}

const NATUREZAS = [
  { value: 'HORA_MAQUINA', label: 'Hora-máquina (Custo de Transformação)' },
  { value: 'MATERIAL_KG', label: 'Material por kg (Material Direto)' },
  { value: 'MATERIAL_UN', label: 'Material por unidade (Material Direto)' },
  { value: 'CUSTO_FIXO', label: 'Custo fixo (ex.: faca/matriz)' },
]
const naturezaLabel = (v: string) => NATUREZAS.find((n) => n.value === v)?.label.split(' (')[0] || v

export default function AcabamentosPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Acabamentos' }, [])

  const [data, setData] = useState<Acabamento[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Acabamento | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  // Restrições (sub-opções) do acabamento em edição
  const [restricoes, setRestricoes] = useState<Restricao[]>([])
  const [carregandoRestricoes, setCarregandoRestricoes] = useState(false)
  const [novaRestricao, setNovaRestricao] = useState<RestricaoForm>(RESTRICAO_FORM_INICIAL)
  const [restricaoEditId, setRestricaoEditId] = useState<string | null>(null)
  const [salvandoRestricao, setSalvandoRestricao] = useState(false)
  const [aba, setAba] = useState<string>('dados')
  const [centros, setCentros] = useState<{ value: string; label: string }[]>([])
  // Materiais permitidos (relação ATIVIDADE→MATERIAL)
  const [materiaisOpcoes, setMateriaisOpcoes] = useState<{ value: string; label: string }[]>([])
  const [materiaisSel, setMateriaisSel] = useState<string[]>([])
  const [carregandoMateriais, setCarregandoMateriais] = useState(false)
  const [salvandoMateriais, setSalvandoMateriais] = useState(false)
  // Paginação (50 itens/página)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const LIMIT = 50

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/orcamento-grafico/acabamentos', {
        params: { page, limit: LIMIT, busca: busca || undefined },
      })
      setData(res.data.data || res.data || [])
      setTotal(res.data.total || 0)
      setTotalPages(res.data.totalPages || 1)
    } catch (err: any) {
      notifications.show({ title: 'Erro ao carregar', message: err?.response?.data?.message || 'Falha ao buscar acabamentos', color: 'red' })
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [busca, page]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [busca])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setAba('dados')
    setModalAberto(true)
  }

  const n = (v: number | null): number | '' => (v == null ? '' : Number(v))

  function abrirEdicao(item: Acabamento) {
    setEditando(item)
    setForm({
      codigo: item.codigo,
      nome: item.nome,
      tipoAtividade: item.tipoAtividade || 'ACABAMENTO',
      planoProduto: item.planoProduto || 'PLANO',
      naturezaCusto: item.naturezaCusto || 'HORA_MAQUINA',
      precoUnitario: n(item.precoUnitario),
      custoHora: n(item.custoHora),
      producaoHora: n(item.producaoHora),
      quantAcertos: n(item.quantAcertos),
      tempoPorAcertoMin: n(item.tempoPorAcertoMin),
      tempoPrimeiroAcertoMin: n(item.tempoPrimeiroAcertoMin),
      unidadeBase: item.unidadeBase || 'FOLHA',
      exigeRestricao: item.exigeRestricao ?? false,
      materiais: Array.isArray(item.materiais) ? item.materiais : [],
      acondicionamento: !!item.acondicionamento,
      textoProposta: item.textoProposta ?? '',
      exibirNomePlano: !!item.exibirNomePlano,
      caracteristicas: item.caracteristicas ? JSON.stringify(item.caracteristicas, null, 2) : '',
    })
    setAba('dados')
    setModalAberto(true)
  }

  // Carregar restrições do acabamento ao abrir a edição (precisa do id)
  useEffect(() => {
    if (!modalAberto || !editando) {
      setRestricoes([])
      setNovaRestricao(RESTRICAO_FORM_INICIAL)
      setRestricaoEditId(null)
      setMateriaisSel([])
      return
    }
    carregarRestricoes(editando.id)
    carregarMateriaisPermitidos(editando.id)
  }, [modalAberto, editando]) // eslint-disable-line react-hooks/exhaustive-deps

  // Centros de produção (para vincular restrição) — carregados uma vez
  useEffect(() => {
    api.get('/centros-producao', { params: { limit: 100, status: 'true' } })
      .then(({ data }) => {
        const items = data.data || data || []
        setCentros(items.map((c: any) => ({ value: c.id, label: `${c.codigo ?? ''} ${c.descricao ?? c.nome ?? ''}`.trim() })))
      })
      .catch(() => setCentros([]))
  }, [])

  async function carregarMateriaisPermitidos(acabamentoId: string) {
    setCarregandoMateriais(true)
    try {
      const [mats, rels] = await Promise.all([
        api.get('/orcamento-grafico/materiais-acabamento', { params: { situacao: 'todas' } }),
        relacoesApi.listar({ tipoOrigem: 'ATIVIDADE', idOrigem: acabamentoId, tipoDestino: 'MATERIAL' }),
      ])
      const lista = mats.data.data || mats.data || []
      setMateriaisOpcoes(lista.map((m: any) => ({ value: m.id, label: `${m.codigo} — ${m.nome}` })))
      setMateriaisSel(rels.map((r) => r.idDestino))
    } catch (err) {
      notifications.show({ title: 'Erro ao carregar materiais', message: mensagemErroApi(err, 'Falha ao buscar materiais permitidos'), color: 'red' })
    } finally { setCarregandoMateriais(false) }
  }

  async function salvarMateriaisPermitidos() {
    if (!editando) return
    setSalvandoMateriais(true)
    try {
      await relacoesApi.salvar({ tipoOrigem: 'ATIVIDADE', idOrigem: editando.id, tipoDestino: 'MATERIAL', ids: materiaisSel })
      notifications.show({ title: 'Salvo', message: 'Materiais permitidos atualizados', color: 'green' })
    } catch (err) {
      notifications.show({ title: 'Erro ao salvar', message: mensagemErroApi(err, 'Falha ao salvar materiais permitidos'), color: 'red' })
    } finally { setSalvandoMateriais(false) }
  }

  async function carregarRestricoes(acabamentoId: string) {
    setCarregandoRestricoes(true)
    try {
      const res = await api.get(`/orcamento-grafico/acabamentos/${acabamentoId}/restricoes`)
      setRestricoes(res.data.data || res.data || [])
    } catch (err: any) {
      notifications.show({ title: 'Erro ao carregar restrições', message: err?.response?.data?.message || 'Falha ao buscar restrições', color: 'red' })
    } finally { setCarregandoRestricoes(false) }
  }

  async function adicionarRestricao() {
    if (!editando) return
    if (!novaRestricao.nome.trim()) { notifications.show({ title: 'Erro', message: 'Nome da restrição obrigatório', color: 'red' }); return }
    setSalvandoRestricao(true)
    try {
      const body = {
        nome: novaRestricao.nome.trim(),
        tempoAcertoMin: novaRestricao.tempoAcertoMin === '' ? 0 : Number(novaRestricao.tempoAcertoMin),
        tempoOperacaoMin: novaRestricao.tempoOperacaoMin === '' ? 0 : Number(novaRestricao.tempoOperacaoMin),
        exibirNaProposta: novaRestricao.exibirNaProposta,
        centroProducaoId: novaRestricao.centroProducaoId,
      }
      if (restricaoEditId) {
        await api.put(`/orcamento-grafico/acabamentos/${editando.id}/restricoes/${restricaoEditId}`, body)
      } else {
        await api.post(`/orcamento-grafico/acabamentos/${editando.id}/restricoes`, body)
      }
      notifications.show({ title: restricaoEditId ? 'Restrição atualizada' : 'Restrição adicionada', message: `"${body.nome}" salva`, color: 'green' })
      setNovaRestricao(RESTRICAO_FORM_INICIAL)
      setRestricaoEditId(null)
      carregarRestricoes(editando.id)
    } catch (err: any) {
      notifications.show({ title: 'Erro ao adicionar', message: err?.response?.data?.message || 'Falha ao criar restrição', color: 'red' })
    } finally { setSalvandoRestricao(false) }
  }

  function editarRestricao(r: Restricao) {
    setRestricaoEditId(r.id)
    setNovaRestricao({
      nome: r.nome,
      tempoAcertoMin: Number(r.tempoAcertoMin),
      tempoOperacaoMin: Number(r.tempoOperacaoMin),
      exibirNaProposta: !!r.exibirNaProposta,
      centroProducaoId: r.centroProducaoId ?? null,
    })
  }

  async function excluirRestricao(r: Restricao) {
    if (!editando) return
    if (!confirm(`Excluir a restrição "${r.nome}"?`)) return
    try {
      await api.delete(`/orcamento-grafico/acabamentos/${editando.id}/restricoes/${r.id}`)
      notifications.show({ title: 'Restrição excluída', message: `"${r.nome}" removida`, color: 'yellow' })
      carregarRestricoes(editando.id)
    } catch (err: any) {
      notifications.show({ title: 'Erro ao excluir', message: err?.response?.data?.message || 'Falha ao excluir restrição', color: 'red' })
    }
  }

  async function salvar() {
    if (!form.codigo.trim()) { notifications.show({ title: 'Erro', message: 'Código obrigatório', color: 'red' }); return }
    if (!form.nome.trim()) { notifications.show({ title: 'Erro', message: 'Nome obrigatório', color: 'red' }); return }

    const numOrNull = (v: number | '') => (v === '' ? null : Number(v))
    let caracteristicas: Record<string, unknown> | null = null
    if (form.caracteristicas.trim()) {
      try {
        const parsed = JSON.parse(form.caracteristicas)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('não é objeto')
        caracteristicas = parsed
      } catch {
        notifications.show({ title: 'Erro', message: 'Características: informe um objeto JSON válido', color: 'red' })
        return
      }
    }
    setSalvando(true)
    try {
      const payload = {
        codigo: form.codigo.trim(),
        nome: form.nome.trim(),
        tipoAtividade: form.tipoAtividade,
        planoProduto: form.planoProduto,
        naturezaCusto: form.naturezaCusto,
        precoUnitario: numOrNull(form.precoUnitario),
        custoHora: numOrNull(form.custoHora),
        producaoHora: numOrNull(form.producaoHora),
        quantAcertos: numOrNull(form.quantAcertos),
        tempoPorAcertoMin: numOrNull(form.tempoPorAcertoMin),
        tempoPrimeiroAcertoMin: numOrNull(form.tempoPrimeiroAcertoMin),
        unidadeBase: form.naturezaCusto === 'HORA_MAQUINA' ? form.unidadeBase : null,
        exigeRestricao: form.exigeRestricao,
        // P16 — materiais informativos (lista de nomes). Sem efeito no cálculo.
        materiais: form.materiais.map((m) => m.trim()).filter((m) => m.length > 0),
        acondicionamento: form.acondicionamento,
        textoProposta: form.textoProposta.trim() ? form.textoProposta.trim() : null,
        exibirNomePlano: form.exibirNomePlano,
        caracteristicas,
      }
      if (editando) {
        await api.put(`/orcamento-grafico/acabamentos/${editando.id}`, payload)
      } else {
        await api.post('/orcamento-grafico/acabamentos', payload)
      }
      notifications.show({ title: 'Salvo', message: `Acabamento ${editando ? 'atualizado' : 'criado'} com sucesso`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro ao salvar', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    } finally { setSalvando(false) }
  }

  async function excluir(item: Acabamento) {
    if (!confirm(`Deseja inativar "${item.nome}"?`)) return
    try {
      await api.delete(`/orcamento-grafico/acabamentos/${item.id}`)
      notifications.show({ title: 'Inativado', message: `"${item.nome}" foi inativado`, color: 'yellow' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao inativar', color: 'red' })
    }
  }

  const isHoraMaquina = form.naturezaCusto === 'HORA_MAQUINA'
  const isMaterial = form.naturezaCusto === 'MATERIAL_KG' || form.naturezaCusto === 'MATERIAL_UN'
  const isFixo = form.naturezaCusto === 'CUSTO_FIXO'

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Acabamentos</Title>
          <Text size="sm" c="dimmed">
            {total} {total === 1 ? 'acabamento' : 'acabamentos'} (hora-máquina, material por kg/un, custo fixo).
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Acabamento</Button>
      </Group>

      <TextInput
        placeholder="Buscar por código ou nome..."
        value={busca}
        onChange={(e) => setBusca(e.currentTarget.value)}
      />

      {loading ? <Center py="xl"><Loader /></Center> : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Natureza</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500}>{item.codigo}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <span>{item.nome}</span>
                      {item.exigeRestricao && (
                        <Badge size="xs" variant="light" color="orange">Exige restrição</Badge>
                      )}
                      {item.acondicionamento && (
                        <Badge size="xs" variant="light" color="grape">Acondicionamento</Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td><Badge variant="light" color={item.tipoAtividade === 'IMPRESSAO' ? 'blue' : 'gray'}>{item.tipoAtividade}</Badge></Table.Td>
                  <Table.Td><Badge variant="light" color="teal">{naturezaLabel(item.naturezaCusto)}</Badge></Table.Td>
                  <Table.Td>
                    <Badge color={item.status ? 'green' : 'red'}>{item.status ? 'Ativo' : 'Inativo'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" onClick={() => abrirEdicao(item)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      {item.status && (
                        <ActionIcon variant="subtle" color="red" onClick={() => excluir(item)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed" py="md">Nenhum acabamento encontrado. Crie manualmente.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {totalPages > 1 && (
        <Group justify="center">
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}

      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Acabamento' : 'Novo Acabamento'}
        centered
        size="lg"
      >
        <Stack gap="md">
          {editando && (
            <Tabs value={aba} onChange={(v) => setAba(v || 'dados')}>
              <Tabs.List>
                <Tabs.Tab value="dados">Dados</Tabs.Tab>
                <Tabs.Tab value="restricoes">Restrições</Tabs.Tab>
                <Tabs.Tab value="materiais">Materiais</Tabs.Tab>
              </Tabs.List>
            </Tabs>
          )}
          {aba === 'dados' && (<>
          <Group grow>
            <TextInput
              label="Código"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })}
              required
              maxLength={40}
              placeholder="Ex: CG-ACAB-8"
            />
            <Select
              label="Tipo"
              data={[{ value: 'ACABAMENTO', label: 'Acabamento' }, { value: 'IMPRESSAO', label: 'Impressão' }]}
              value={form.tipoAtividade}
              onChange={(v) => setForm({ ...form, tipoAtividade: v || 'ACABAMENTO' })}
            />
          </Group>
          <TextInput
            label="Nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })}
            required
            maxLength={200}
            placeholder="Ex: Cortadeira (Grande)"
          />
          <Group grow>
            <Select
              label="Natureza de custo"
              data={NATUREZAS}
              value={form.naturezaCusto}
              onChange={(v) => setForm({ ...form, naturezaCusto: v || 'HORA_MAQUINA' })}
            />
            <Select
              label="Plano/Produto"
              data={[{ value: 'PLANO', label: 'Plano' }, { value: 'PRODUTO', label: 'Produto' }]}
              value={form.planoProduto}
              onChange={(v) => setForm({ ...form, planoProduto: v || 'PLANO' })}
            />
          </Group>

          <Checkbox
            label="Exige escolha de restrição no orçamento"
            description="Quando marcado, o orçamento exige escolher uma sub-opção (restrição) para este acabamento."
            checked={form.exigeRestricao}
            onChange={(e) => setForm({ ...form, exigeRestricao: e.currentTarget.checked })}
          />
          <Checkbox
            label="Acondicionamento"
            description="Marca esta atividade como acondicionamento (embalagem do produto pronto)."
            checked={form.acondicionamento}
            onChange={(e) => setForm({ ...form, acondicionamento: e.currentTarget.checked })}
          />
          <Checkbox
            label="Exibir nome do plano na proposta"
            checked={form.exibirNomePlano}
            onChange={(e) => setForm({ ...form, exibirNomePlano: e.currentTarget.checked })}
          />
          <Textarea
            label="Texto na proposta"
            value={form.textoProposta}
            onChange={(e) => setForm({ ...form, textoProposta: e.currentTarget.value })}
            autosize
            minRows={2}
            maxLength={5000}
          />
          <Textarea
            label="Características (JSON)"
            description="Opcional. Objeto JSON, ex.: {&quot;chave&quot;: &quot;valor&quot;}. Deixe vazio para não informar."
            value={form.caracteristicas}
            onChange={(e) => setForm({ ...form, caracteristicas: e.currentTarget.value })}
            autosize
            minRows={2}
            styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
          />

          <Divider label="Parâmetros de custo" labelPosition="left" />

          {isMaterial && (
            <NumberInput
              label={form.naturezaCusto === 'MATERIAL_KG' ? 'Preço por kg (R$)' : 'Preço por unidade (R$)'}
              value={form.precoUnitario}
              onChange={(v) => setForm({ ...form, precoUnitario: typeof v === 'number' ? v : '' })}
              min={0}
              decimalScale={4}
            />
          )}

          {isFixo && (
            <NumberInput
              label="Valor fixo (R$)"
              description="Custo que não escala com a tiragem (ex.: faca/matriz)"
              value={form.precoUnitario}
              onChange={(v) => setForm({ ...form, precoUnitario: typeof v === 'number' ? v : '' })}
              min={0}
              decimalScale={2}
            />
          )}

          {isHoraMaquina && (
            <>
              <SimpleGrid cols={2}>
                <NumberInput
                  label="Custo-hora (R$/h)"
                  value={form.custoHora}
                  onChange={(v) => setForm({ ...form, custoHora: typeof v === 'number' ? v : '' })}
                  min={0}
                  decimalScale={2}
                />
                <NumberInput
                  label="Produção (un/h)"
                  value={form.producaoHora}
                  onChange={(v) => setForm({ ...form, producaoHora: typeof v === 'number' ? v : '' })}
                  min={0}
                  decimalScale={2}
                />
              </SimpleGrid>
              <SimpleGrid cols={3}>
                <NumberInput
                  label="Qtd. acertos"
                  value={form.quantAcertos}
                  onChange={(v) => setForm({ ...form, quantAcertos: typeof v === 'number' ? v : '' })}
                  min={0}
                />
                <NumberInput
                  label="Tempo/acerto (min)"
                  value={form.tempoPorAcertoMin}
                  onChange={(v) => setForm({ ...form, tempoPorAcertoMin: typeof v === 'number' ? v : '' })}
                  min={0}
                  decimalScale={2}
                />
                <NumberInput
                  label="1º acerto (min)"
                  value={form.tempoPrimeiroAcertoMin}
                  onChange={(v) => setForm({ ...form, tempoPrimeiroAcertoMin: typeof v === 'number' ? v : '' })}
                  min={0}
                  decimalScale={2}
                />
              </SimpleGrid>
              <Select
                label="Unidade base (produção)"
                description="FOLHA processa folhas impressas; PRODUTO processa a tiragem"
                data={[{ value: 'FOLHA', label: 'Folha' }, { value: 'PRODUTO', label: 'Produto (tiragem)' }]}
                value={form.unidadeBase}
                onChange={(v) => setForm({ ...form, unidadeBase: v || 'FOLHA' })}
              />
            </>
          )}

          <Divider label="Materiais (informativos)" labelPosition="left" />
          <TagsInput
            label="Materiais desta atividade"
            description="Lista de materiais informativos (ex.: Cola Branca, Cola Quente). Apenas descritivo — não altera o cálculo/preço. Digite e pressione Enter para adicionar."
            placeholder="Digite o material e pressione Enter"
            value={form.materiais}
            onChange={(v) => setForm({ ...form, materiais: v })}
            clearable
          />
          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar Alterações' : 'Criar Acabamento'}
          </Button>
          </>)}

          {editando && aba === 'materiais' && (
            <>
              <Text size="xs" c="dimmed">
                Materiais permitidos para esta atividade (relação Atividade → Material).
              </Text>
              {carregandoMateriais ? (
                <Center py="sm"><Loader size="sm" /></Center>
              ) : (
                <MultiSelect
                  label="Materiais permitidos"
                  data={materiaisOpcoes}
                  value={materiaisSel}
                  onChange={setMateriaisSel}
                  searchable
                  clearable
                  placeholder="Selecione os materiais"
                  nothingFoundMessage="Nenhum material encontrado"
                />
              )}
              <Button onClick={salvarMateriaisPermitidos} fullWidth loading={salvandoMateriais} disabled={carregandoMateriais}>
                Salvar materiais
              </Button>
            </>
          )}

          {editando && aba === 'restricoes' && (
            <>
              <Divider label="Restrições (sub-opções)" labelPosition="left" />
              <Text size="xs" c="dimmed">
                Sub-opções deste acabamento. Cada restrição ajusta os tempos de acerto/operação quando
                escolhida no orçamento.
              </Text>

              {carregandoRestricoes ? (
                <Center py="sm"><Loader size="sm" /></Center>
              ) : (
                <Stack gap="xs">
                  {restricoes.length === 0 && (
                    <Text size="sm" c="dimmed">Nenhuma restrição cadastrada.</Text>
                  )}
                  {restricoes.map((r) => (
                    <Paper key={r.id} p="xs" withBorder>
                      <Group justify="space-between" wrap="nowrap">
                        <div style={{ minWidth: 0 }}>
                          <Text size="sm" fw={500} truncate>{r.nome}</Text>
                          <Text size="xs" c="dimmed">
                            Acerto: {Number(r.tempoAcertoMin)} min · Operação: {Number(r.tempoOperacaoMin)} min
                            {r.exibirNaProposta ? ' · Exibe na proposta' : ''}
                            {r.centroProducaoId ? ` · Centro: ${centros.find((c) => c.value === r.centroProducaoId)?.label ?? '—'}` : ''}
                          </Text>
                        </div>
                        <Group gap={4} wrap="nowrap">
                          <ActionIcon variant="subtle" onClick={() => editarRestricao(r)}>
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon variant="subtle" color="red" onClick={() => excluirRestricao(r)}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}

              <Paper p="sm" withBorder bg="var(--mantine-color-default-hover)">
                <Stack gap="xs">
                  <Text size="sm" fw={500}>{restricaoEditId ? 'Editar restrição' : 'Adicionar restrição'}</Text>
                  <TextInput
                    label="Nome"
                    value={novaRestricao.nome}
                    onChange={(e) => setNovaRestricao({ ...novaRestricao, nome: e.currentTarget.value })}
                    maxLength={100}
                    placeholder="Ex: Com braille"
                  />
                  <SimpleGrid cols={2}>
                    <NumberInput
                      label="Acerto (min)"
                      value={novaRestricao.tempoAcertoMin}
                      onChange={(v) => setNovaRestricao({ ...novaRestricao, tempoAcertoMin: typeof v === 'number' ? v : '' })}
                      min={0}
                      max={999}
                      decimalScale={2}
                    />
                    <NumberInput
                      label="Operação (min)"
                      value={novaRestricao.tempoOperacaoMin}
                      onChange={(v) => setNovaRestricao({ ...novaRestricao, tempoOperacaoMin: typeof v === 'number' ? v : '' })}
                      min={0}
                      max={999}
                      decimalScale={2}
                    />
                  </SimpleGrid>
                  <Select
                    label="Centro de produção"
                    data={centros}
                    value={novaRestricao.centroProducaoId}
                    onChange={(v) => setNovaRestricao({ ...novaRestricao, centroProducaoId: v })}
                    searchable
                    clearable
                    placeholder="Opcional"
                  />
                  <Checkbox
                    label="Exibir na proposta"
                    checked={novaRestricao.exibirNaProposta}
                    onChange={(e) => setNovaRestricao({ ...novaRestricao, exibirNaProposta: e.currentTarget.checked })}
                  />
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={restricaoEditId ? <IconEdit size={14} /> : <IconPlus size={14} />}
                      onClick={adicionarRestricao}
                      loading={salvandoRestricao}
                    >
                      {restricaoEditId ? 'Salvar restrição' : 'Adicionar restrição'}
                    </Button>
                    {restricaoEditId && (
                      <Button
                        size="xs"
                        variant="subtle"
                        color="gray"
                        onClick={() => { setRestricaoEditId(null); setNovaRestricao(RESTRICAO_FORM_INICIAL) }}
                      >
                        Cancelar edição
                      </Button>
                    )}
                  </Group>
                </Stack>
              </Paper>
            </>
          )}
        </Stack>
      </Modal>
    </Stack>
  )
}
