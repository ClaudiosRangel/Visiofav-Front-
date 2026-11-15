'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center, Modal, TextInput,
  Select, NumberInput, ActionIcon, ScrollArea, Pagination, Switch, MultiSelect, Textarea,
  Alert, SimpleGrid,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { itensDiversosApi, mensagemErroApi } from '../_shared/cadastros-graficos.api'
import type {
  ItemDiversoGrafico, ItemDiversoGraficoInput, OrigemItemDiverso, SituacaoFiltro,
} from '../_shared/cadastros-graficos.types'
import AvisoSemInfluencia from '../_shared/AvisoSemInfluencia'

// ============================================================================
// Itens Diversos — cadastro de itens de custo adicionais do orçamento gráfico,
// com vínculo a atividades (acabamentos).
// ============================================================================

const LIMITE = 20

const ORIGENS: { value: OrigemItemDiverso; label: string }[] = [
  { value: 'CENTRO_DE_CUSTO', label: 'Centro de custo' },
  { value: 'SERVICO_EXTERNO', label: 'Serviço externo' },
  { value: 'PRE_IMPRESSAO', label: 'Pré-impressão' },
  { value: 'TINTA', label: 'Tinta' },
  { value: 'MATRIZ_IMPRESSAO', label: 'Matriz de impressão' },
]

const SITUACOES = [
  { value: 'ativo', label: 'Ativos' },
  { value: 'inativo', label: 'Inativos' },
  { value: 'todos', label: 'Todos' },
]

function rotuloOrigem(v: string) {
  return ORIGENS.find((o) => o.value === v)?.label ?? v
}

type NumCampo = number | ''

interface FormState {
  nome: string
  origem: OrigemItemDiverso
  sigla: string
  automatico: boolean
  tipoCalculo: string
  aplicadoSobre: string
  quantidadeAceite: NumCampo
  quantidadePorUnidade: NumCampo
  quantidadeMinima: NumCampo
  custoInformado: NumCampo
  quebraPerc: NumCampo
  porCaderno: boolean
  calculoPorQtdCores: boolean
  acompanhaMontImpressao: boolean
  itemRevenda: boolean
  pendenciaAutomaticaPcp: boolean
  textoProposta: string
  status: boolean
  atividadeIds: string[]
}

const FORM_INICIAL: FormState = {
  nome: '',
  origem: 'CENTRO_DE_CUSTO',
  sigla: '',
  automatico: false,
  tipoCalculo: '',
  aplicadoSobre: '',
  quantidadeAceite: '',
  quantidadePorUnidade: '',
  quantidadeMinima: '',
  custoInformado: '',
  quebraPerc: '',
  porCaderno: false,
  calculoPorQtdCores: false,
  acompanhaMontImpressao: false,
  itemRevenda: false,
  pendenciaAutomaticaPcp: false,
  textoProposta: '',
  status: true,
  atividadeIds: [],
}

function paraNum(v: unknown): NumCampo {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? n : ''
}

function numOuNull(v: NumCampo): number | null {
  return v === '' ? null : v
}

interface OpcaoAtividade { value: string; label: string }

export default function ItensDiversosPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Itens Diversos' }, [])

  const [itens, setItens] = useState<ItemDiversoGrafico[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [busca, setBusca] = useState('')
  const [origem, setOrigem] = useState<string | null>(null)
  const [situacao, setSituacao] = useState<SituacaoFiltro>('ativo')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<ItemDiversoGrafico | null>(null)
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [carregandoItem, setCarregandoItem] = useState(false)

  const [atividades, setAtividades] = useState<OpcaoAtividade[]>([])
  const [carregandoAtividades, setCarregandoAtividades] = useState(false)

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE))

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const r = await itensDiversosApi.listar({
        pagina,
        limite: LIMITE,
        busca: busca.trim() || undefined,
        origem: origem || undefined,
        status: situacao,
      })
      setItens(r.itens ?? [])
      setTotal(r.total ?? 0)
    } catch (err) {
      setErro(mensagemErroApi(err, 'Falha ao carregar itens diversos'))
    } finally {
      setLoading(false)
    }
  }, [pagina, busca, origem, situacao])

  useEffect(() => {
    const t = setTimeout(carregar, 250)
    return () => clearTimeout(t)
  }, [carregar])

  useEffect(() => { setPagina(1) }, [busca, origem, situacao])

  // Atividades = acabamentos do orçamento gráfico (mesma rota da tela de Acabamentos).
  async function carregarAtividades() {
    if (atividades.length > 0) return
    setCarregandoAtividades(true)
    try {
      const res = await api.get('/orcamento-grafico/acabamentos', { params: { page: 1, limit: 500 } })
      const lista: Array<{ id: string; nome: string; codigo?: string | null }> =
        res.data?.data ?? (Array.isArray(res.data) ? res.data : [])
      setAtividades(lista.map((a) => ({ value: a.id, label: a.nome })))
    } catch (err) {
      notifications.show({
        title: 'Atividades',
        message: mensagemErroApi(err, 'Não foi possível carregar as atividades'),
        color: 'red',
      })
    } finally {
      setCarregandoAtividades(false)
    }
  }

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setModalAberto(true)
    carregarAtividades()
  }

  async function abrirEdicao(item: ItemDiversoGrafico) {
    setEditando(item)
    setForm({
      ...FORM_INICIAL,
      nome: item.nome,
      origem: item.origem,
      status: item.status,
    })
    setModalAberto(true)
    carregarAtividades()
    setCarregandoItem(true)
    try {
      const d = await itensDiversosApi.obter(item.id)
      setForm({
        nome: d.nome,
        origem: d.origem,
        sigla: d.sigla ?? '',
        automatico: d.automatico,
        tipoCalculo: d.tipoCalculo ?? '',
        aplicadoSobre: d.aplicadoSobre ?? '',
        quantidadeAceite: paraNum(d.quantidadeAceite),
        quantidadePorUnidade: paraNum(d.quantidadePorUnidade),
        quantidadeMinima: paraNum(d.quantidadeMinima),
        custoInformado: paraNum(d.custoInformado),
        quebraPerc: paraNum(d.quebraPerc),
        porCaderno: d.porCaderno,
        calculoPorQtdCores: d.calculoPorQtdCores,
        acompanhaMontImpressao: d.acompanhaMontImpressao,
        itemRevenda: d.itemRevenda,
        pendenciaAutomaticaPcp: d.pendenciaAutomaticaPcp,
        textoProposta: d.textoProposta ?? '',
        status: d.status,
        atividadeIds: d.atividadeIds ?? [],
      })
    } catch (err) {
      notifications.show({ title: 'Erro', message: mensagemErroApi(err, 'Falha ao abrir o item'), color: 'red' })
      setModalAberto(false)
    } finally {
      setCarregandoItem(false)
    }
  }

  async function salvar() {
    if (!form.nome.trim()) {
      notifications.show({ title: 'Atenção', message: 'Informe o nome', color: 'red' })
      return
    }
    const payload: ItemDiversoGraficoInput = {
      nome: form.nome.trim(),
      origem: form.origem,
      sigla: form.sigla.trim() || null,
      automatico: form.automatico,
      tipoCalculo: form.tipoCalculo.trim() || null,
      aplicadoSobre: form.aplicadoSobre.trim() || null,
      quantidadeAceite: numOuNull(form.quantidadeAceite),
      quantidadePorUnidade: numOuNull(form.quantidadePorUnidade),
      quantidadeMinima: numOuNull(form.quantidadeMinima),
      custoInformado: numOuNull(form.custoInformado),
      quebraPerc: numOuNull(form.quebraPerc),
      porCaderno: form.porCaderno,
      calculoPorQtdCores: form.calculoPorQtdCores,
      acompanhaMontImpressao: form.acompanhaMontImpressao,
      itemRevenda: form.itemRevenda,
      pendenciaAutomaticaPcp: form.pendenciaAutomaticaPcp,
      textoProposta: form.textoProposta.trim() || null,
      status: form.status,
      atividadeIds: form.atividadeIds,
    }
    setSalvando(true)
    try {
      if (editando) await itensDiversosApi.atualizar(editando.id, payload)
      else await itensDiversosApi.criar(payload)
      notifications.show({
        title: 'Salvo',
        message: `Item ${editando ? 'atualizado' : 'criado'} com sucesso`,
        color: 'green',
      })
      setModalAberto(false)
      carregar()
    } catch (err) {
      notifications.show({ title: 'Erro ao salvar', message: mensagemErroApi(err, 'Falha ao salvar'), color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  async function inativar(item: ItemDiversoGrafico) {
    if (!confirm(`Deseja inativar "${item.nome}"?`)) return
    try {
      await itensDiversosApi.inativar(item.id)
      notifications.show({ title: 'Inativado', message: `"${item.nome}" foi inativado`, color: 'yellow' })
      carregar()
    } catch (err) {
      notifications.show({ title: 'Erro', message: mensagemErroApi(err, 'Falha ao inativar'), color: 'red' })
    }
  }

  function setNum<K extends keyof FormState>(campo: K) {
    return (v: string | number) => setForm((f) => ({ ...f, [campo]: v === '' ? '' : Number(v) }))
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3}>Itens Diversos</Title>
          <Text size="sm" c="dimmed">
            {total} {total === 1 ? 'item' : 'itens'} cadastrados
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Item</Button>
      </Group>

      <AvisoSemInfluencia>
        Este cadastro ainda não influencia o cálculo do orçamento nem o PCP. Os itens e seus vínculos com
        atividades ficam registrados para uso nas próximas etapas.
      </AvisoSemInfluencia>

      <Group grow align="flex-end">
        <TextInput
          placeholder="Buscar por nome ou sigla..."
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
        />
        <Select
          placeholder="Origem"
          clearable
          data={ORIGENS}
          value={origem}
          onChange={setOrigem}
        />
        <Select
          allowDeselect={false}
          data={SITUACOES}
          value={situacao}
          onChange={(v) => setSituacao((v as SituacaoFiltro) || 'ativo')}
        />
      </Group>

      {erro && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Erro ao carregar">
          <Group justify="space-between">
            <Text size="sm">{erro}</Text>
            <Button size="xs" variant="light" onClick={carregar}>Tentar novamente</Button>
          </Group>
        </Alert>
      )}

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Sigla</Table.Th>
                <Table.Th>Origem</Table.Th>
                <Table.Th>Automático</Table.Th>
                <Table.Th>Situação</Table.Th>
                <Table.Th w={90}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itens.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500}>{item.nome}</Table.Td>
                  <Table.Td c="dimmed">{item.sigla || '—'}</Table.Td>
                  <Table.Td><Badge variant="light">{rotuloOrigem(item.origem)}</Badge></Table.Td>
                  <Table.Td>{item.automatico ? 'Sim' : 'Não'}</Table.Td>
                  <Table.Td>
                    <Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon variant="subtle" aria-label="Editar" onClick={() => abrirEdicao(item)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      {item.status && (
                        <ActionIcon variant="subtle" color="red" aria-label="Inativar" onClick={() => inativar(item)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {itens.length === 0 && !erro && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed" py="md">Nenhum item encontrado</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {totalPaginas > 1 && (
        <Group justify="center">
          <Pagination total={totalPaginas} value={pagina} onChange={setPagina} />
        </Group>
      )}

      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Item Diverso' : 'Novo Item Diverso'}
        size="lg"
        centered
      >
        {carregandoItem ? (
          <Center py="xl"><Loader /></Center>
        ) : (
          <Stack gap="md">
            <Group grow align="flex-start">
              <TextInput
                label="Nome"
                required
                maxLength={200}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })}
              />
              <TextInput
                label="Sigla"
                maxLength={30}
                value={form.sigla}
                onChange={(e) => setForm({ ...form, sigla: e.currentTarget.value })}
              />
            </Group>

            <Select
              label="Origem"
              required
              allowDeselect={false}
              data={ORIGENS}
              value={form.origem}
              onChange={(v) => setForm({ ...form, origem: (v as OrigemItemDiverso) || 'CENTRO_DE_CUSTO' })}
            />

            <MultiSelect
              label="Atividades vinculadas"
              description="Atividades (acabamentos) em que este item é aplicado"
              placeholder={carregandoAtividades ? 'Carregando...' : 'Pesquisar atividade'}
              searchable
              clearable
              nothingFoundMessage="Nenhuma atividade encontrada"
              data={atividades}
              value={form.atividadeIds}
              onChange={(v) => setForm({ ...form, atividadeIds: v })}
              disabled={carregandoAtividades}
              maxDropdownHeight={240}
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Tipo de cálculo"
                maxLength={60}
                value={form.tipoCalculo}
                onChange={(e) => setForm({ ...form, tipoCalculo: e.currentTarget.value })}
              />
              <TextInput
                label="Aplicado sobre"
                maxLength={60}
                value={form.aplicadoSobre}
                onChange={(e) => setForm({ ...form, aplicadoSobre: e.currentTarget.value })}
              />
              <NumberInput
                label="Quantidade de aceite"
                min={0}
                decimalScale={4}
                value={form.quantidadeAceite}
                onChange={setNum('quantidadeAceite')}
              />
              <NumberInput
                label="Quantidade por unidade"
                min={0}
                decimalScale={4}
                value={form.quantidadePorUnidade}
                onChange={setNum('quantidadePorUnidade')}
              />
              <NumberInput
                label="Quantidade mínima"
                min={0}
                decimalScale={4}
                value={form.quantidadeMinima}
                onChange={setNum('quantidadeMinima')}
              />
              <NumberInput
                label="Custo informado (R$)"
                min={0}
                decimalScale={4}
                value={form.custoInformado}
                onChange={setNum('custoInformado')}
              />
              <NumberInput
                label="Quebra (%)"
                min={0}
                max={100}
                decimalScale={2}
                value={form.quebraPerc}
                onChange={setNum('quebraPerc')}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Switch label="Automático" checked={form.automatico}
                onChange={(e) => setForm({ ...form, automatico: e.currentTarget.checked })} />
              <Switch label="Por caderno" checked={form.porCaderno}
                onChange={(e) => setForm({ ...form, porCaderno: e.currentTarget.checked })} />
              <Switch label="Cálculo por quantidade de cores" checked={form.calculoPorQtdCores}
                onChange={(e) => setForm({ ...form, calculoPorQtdCores: e.currentTarget.checked })} />
              <Switch label="Acompanha montagem da impressão" checked={form.acompanhaMontImpressao}
                onChange={(e) => setForm({ ...form, acompanhaMontImpressao: e.currentTarget.checked })} />
              <Switch label="Item de revenda" checked={form.itemRevenda}
                onChange={(e) => setForm({ ...form, itemRevenda: e.currentTarget.checked })} />
              <Switch label="Pendência automática no PCP" checked={form.pendenciaAutomaticaPcp}
                onChange={(e) => setForm({ ...form, pendenciaAutomaticaPcp: e.currentTarget.checked })} />
              <Switch label="Ativo" checked={form.status}
                onChange={(e) => setForm({ ...form, status: e.currentTarget.checked })} />
            </SimpleGrid>

            <Textarea
              label="Texto na proposta"
              autosize
              minRows={2}
              maxRows={6}
              value={form.textoProposta}
              onChange={(e) => setForm({ ...form, textoProposta: e.currentTarget.value })}
            />

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setModalAberto(false)}>Cancelar</Button>
              <Button onClick={salvar} loading={salvando}>
                {editando ? 'Salvar Alterações' : 'Criar Item'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
