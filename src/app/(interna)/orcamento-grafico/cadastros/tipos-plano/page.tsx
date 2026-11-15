'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center, Modal, TextInput,
  Select, NumberInput, ActionIcon, ScrollArea, SegmentedControl, SimpleGrid, Switch, Alert, Tooltip,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconLock, IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { tiposPlanoApi, mensagemErroApi } from '../_shared/cadastros-graficos.api'
import type {
  TipoPlanoGrafico, TipoPlanoGraficoInput, SituacaoFiltro,
  CalculoAutomaticoFormato, PrimeiraMedida, OcorrenciasPlano,
} from '../_shared/cadastros-graficos.types'

// ============================================================================
// Tipos de Plano — cadastro dos tipos de plano do orçamento (Miolo, Capa, etc.).
// Plano "fixo" é do sistema: mostra badge e não pode ser excluído (inativado).
// ============================================================================

interface LinhaOpcao { id: string; nome: string }

interface FormTipoPlano {
  codigo: string
  nome: string
  linhaProdutoId: string | null
  miolo: boolean
  calculoAutomaticoFormato: CalculoAutomaticoFormato
  primeiraMedida: PrimeiraMedida
  somarOrelhas: boolean
  somarLombada: boolean
  ocorrencias: OcorrenciasPlano
  quebraPadrao: number | ''
  corteDuploMin: number | ''
  gramaturaPadrao: number | ''
  usarPinca: boolean
  fibraDefault: string
  frenteIgualVerso: boolean
  caderno: boolean
  margem1Mm: number | ''
  margem2Mm: number | ''
  formato: string
  status: boolean
}

const FORM_INICIAL: FormTipoPlano = {
  codigo: '', nome: '', linhaProdutoId: null, miolo: false,
  calculoAutomaticoFormato: 'SIM', primeiraMedida: 'LF', somarOrelhas: false, somarLombada: false,
  ocorrencias: 'UMA', quebraPadrao: '', corteDuploMin: '', gramaturaPadrao: '', usarPinca: false,
  fibraDefault: '', frenteIgualVerso: false, caderno: false, margem1Mm: 0, margem2Mm: 0, formato: '', status: true,
}

const OPC_CALCULO = [
  { value: 'SIM', label: 'Sim' },
  { value: 'NAO', label: 'Não' },
  { value: 'OPCIONAL', label: 'Opcional' },
]
const OPC_MEDIDA = [
  { value: 'LF', label: 'Largura final (LF)' },
  { value: 'LFX2', label: 'Largura final × 2 (LFX2)' },
  { value: 'LOMBADA', label: 'Lombada' },
]
const OPC_OCORRENCIAS = [
  { value: 'UMA', label: 'Uma' },
  { value: 'DUAS', label: 'Duas' },
  { value: 'LIVRE', label: 'Livre' },
]

const num = (v: unknown): number | '' => (v === null || v === undefined || v === '' ? '' : Number(v))
const numOuNull = (v: number | ''): number | null => (v === '' ? null : v)

export default function TiposPlanoPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Tipos de Plano' }, [])

  const [data, setData] = useState<TipoPlanoGrafico[]>([])
  const [linhas, setLinhas] = useState<LinhaOpcao[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<SituacaoFiltro>('ativo')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<TipoPlanoGrafico | null>(null)
  const [form, setForm] = useState<FormTipoPlano>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      setData(await tiposPlanoApi.listar({ situacao, busca: busca || undefined }))
    } catch (err) {
      const msg = mensagemErroApi(err, 'Falha ao buscar tipos de plano')
      setErro(msg)
      notifications.show({ title: 'Erro ao carregar', message: msg, color: 'red' })
    } finally { setLoading(false) }
  }, [situacao, busca])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    api.get('/orcamento-grafico/linhas-produto', { params: { situacao: 'ativa' } })
      .then(({ data: d }) => setLinhas((d.data || d || []).map((l: any) => ({ id: l.id, nome: l.nome }))))
      .catch(() => setLinhas([]))
  }, [])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setModalAberto(true)
  }

  function abrirEdicao(item: TipoPlanoGrafico) {
    setEditando(item)
    setForm({
      codigo: item.codigo,
      nome: item.nome,
      linhaProdutoId: item.linhaProdutoId,
      miolo: item.miolo,
      calculoAutomaticoFormato: item.calculoAutomaticoFormato,
      primeiraMedida: item.primeiraMedida,
      somarOrelhas: item.somarOrelhas,
      somarLombada: item.somarLombada,
      ocorrencias: item.ocorrencias,
      quebraPadrao: num(item.quebraPadrao),
      corteDuploMin: num(item.corteDuploMin),
      gramaturaPadrao: num(item.gramaturaPadrao),
      usarPinca: item.usarPinca,
      fibraDefault: item.fibraDefault ?? '',
      frenteIgualVerso: item.frenteIgualVerso,
      caderno: item.caderno,
      margem1Mm: num(item.margem1Mm),
      margem2Mm: num(item.margem2Mm),
      formato: item.formato ?? '',
      status: item.status,
    })
    setModalAberto(true)
  }

  async function salvar() {
    if (!form.codigo.trim()) { notifications.show({ title: 'Erro', message: 'Código obrigatório', color: 'red' }); return }
    if (!form.nome.trim()) { notifications.show({ title: 'Erro', message: 'Nome obrigatório', color: 'red' }); return }
    setSalvando(true)
    try {
      const payload: TipoPlanoGraficoInput = {
        codigo: form.codigo.trim(),
        nome: form.nome.trim(),
        linhaProdutoId: form.linhaProdutoId,
        miolo: form.miolo,
        calculoAutomaticoFormato: form.calculoAutomaticoFormato,
        primeiraMedida: form.primeiraMedida,
        somarOrelhas: form.somarOrelhas,
        somarLombada: form.somarLombada,
        ocorrencias: form.ocorrencias,
        quebraPadrao: numOuNull(form.quebraPadrao),
        corteDuploMin: numOuNull(form.corteDuploMin),
        gramaturaPadrao: numOuNull(form.gramaturaPadrao),
        usarPinca: form.usarPinca,
        fibraDefault: form.fibraDefault.trim() || null,
        frenteIgualVerso: form.frenteIgualVerso,
        caderno: form.caderno,
        margem1Mm: form.margem1Mm === '' ? 0 : form.margem1Mm,
        margem2Mm: form.margem2Mm === '' ? 0 : form.margem2Mm,
        formato: form.formato.trim() || null,
        status: form.status,
      }
      if (editando) await tiposPlanoApi.atualizar(editando.id, payload)
      else await tiposPlanoApi.criar(payload)
      notifications.show({ title: 'Salvo', message: `Tipo de plano ${editando ? 'atualizado' : 'criado'} com sucesso`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err) {
      notifications.show({ title: 'Erro ao salvar', message: mensagemErroApi(err, 'Falha ao salvar'), color: 'red' })
    } finally { setSalvando(false) }
  }

  async function inativar(item: TipoPlanoGrafico) {
    if (item.fixo) return
    if (!confirm(`Deseja inativar "${item.nome}"?`)) return
    try {
      await tiposPlanoApi.inativar(item.id)
      notifications.show({ title: 'Inativado', message: `"${item.nome}" foi inativado`, color: 'yellow' })
      carregar()
    } catch (err) {
      notifications.show({ title: 'Erro', message: mensagemErroApi(err, 'Falha ao inativar'), color: 'red' })
    }
  }

  const set = <K extends keyof FormTipoPlano>(k: K, v: FormTipoPlano[K]) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Tipos de Plano</Title>
          <Text size="sm" c="dimmed">
            Define como cada plano do produto (miolo, capa, etc.) calcula formato, quebra e medidas.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Tipo de Plano</Button>
      </Group>

      <Group>
        <TextInput
          style={{ flex: 1 }}
          placeholder="Buscar por código ou nome..."
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
        />
        <SegmentedControl
          value={situacao}
          onChange={(v) => setSituacao(v as SituacaoFiltro)}
          data={[
            { value: 'ativo', label: 'Ativos' },
            { value: 'inativo', label: 'Inativos' },
            { value: 'todos', label: 'Todos' },
          ]}
        />
      </Group>

      {erro && !loading && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Não foi possível carregar">
          {erro}
        </Alert>
      )}

      {loading ? <Center py="xl"><Loader /></Center> : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Cálculo do formato</Table.Th>
                <Table.Th>Ocorrências</Table.Th>
                <Table.Th>Situação</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500}>{item.codigo}</Table.Td>
                  <Table.Td>{item.nome}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {item.fixo && (
                        <Badge variant="light" color="grape" leftSection={<IconLock size={10} />}>Fixo</Badge>
                      )}
                      {item.miolo && <Badge variant="light" color="cyan">Miolo</Badge>}
                      {item.caderno && <Badge variant="light" color="teal">Caderno</Badge>}
                      {!item.fixo && !item.miolo && !item.caderno && <Text c="dimmed" size="sm">—</Text>}
                    </Group>
                  </Table.Td>
                  <Table.Td>{OPC_CALCULO.find((o) => o.value === item.calculoAutomaticoFormato)?.label ?? item.calculoAutomaticoFormato}</Table.Td>
                  <Table.Td>{OPC_OCORRENCIAS.find((o) => o.value === item.ocorrencias)?.label ?? item.ocorrencias}</Table.Td>
                  <Table.Td>
                    <Badge color={item.status ? 'green' : 'red'}>{item.status ? 'Ativo' : 'Inativo'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon variant="subtle" onClick={() => abrirEdicao(item)} aria-label="Editar">
                        <IconEdit size={16} />
                      </ActionIcon>
                      {item.fixo ? (
                        <Tooltip label="Plano fixo do sistema não pode ser excluído">
                          <ActionIcon variant="subtle" color="gray" disabled aria-label="Não pode excluir">
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      ) : (
                        item.status && (
                          <ActionIcon variant="subtle" color="red" onClick={() => inativar(item)} aria-label="Inativar">
                            <IconTrash size={16} />
                          </ActionIcon>
                        )
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.length === 0 && !erro && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text ta="center" c="dimmed" py="md">Nenhum tipo de plano encontrado</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Tipo de Plano' : 'Novo Tipo de Plano'}
        size="xl"
        centered
      >
        <Stack gap="md">
          {editando?.fixo && (
            <Badge variant="light" color="grape" leftSection={<IconLock size={10} />} size="lg">
              Plano fixo do sistema
            </Badge>
          )}
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Código" value={form.codigo} onChange={(e) => set('codigo', e.currentTarget.value)} required maxLength={30} />
            <TextInput label="Nome" value={form.nome} onChange={(e) => set('nome', e.currentTarget.value)} required maxLength={120} style={{ gridColumn: 'span 2' }} />
          </SimpleGrid>
          <Select
            label="Linha de produto"
            placeholder="Todas / não vinculada"
            data={linhas.map((l) => ({ value: l.id, label: l.nome }))}
            value={form.linhaProdutoId}
            onChange={(v) => set('linhaProdutoId', v)}
            searchable
            clearable
          />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Select label="Cálculo automático do formato" data={OPC_CALCULO} value={form.calculoAutomaticoFormato} onChange={(v) => set('calculoAutomaticoFormato', (v as CalculoAutomaticoFormato) || 'SIM')} allowDeselect={false} />
            <Select label="Primeira medida" data={OPC_MEDIDA} value={form.primeiraMedida} onChange={(v) => set('primeiraMedida', (v as PrimeiraMedida) || 'LF')} allowDeselect={false} />
            <Select label="Ocorrências" data={OPC_OCORRENCIAS} value={form.ocorrencias} onChange={(v) => set('ocorrencias', (v as OcorrenciasPlano) || 'UMA')} allowDeselect={false} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <NumberInput label="Quebra padrão (%)" value={form.quebraPadrao} onChange={(v) => set('quebraPadrao', typeof v === 'number' ? v : '')} min={0} decimalScale={2} />
            <NumberInput label="Corte duplo mín." value={form.corteDuploMin} onChange={(v) => set('corteDuploMin', typeof v === 'number' ? v : '')} min={0} decimalScale={2} />
            <NumberInput label="Gramatura padrão" value={form.gramaturaPadrao} onChange={(v) => set('gramaturaPadrao', typeof v === 'number' ? v : '')} min={0} decimalScale={2} />
            <TextInput label="Fibra padrão" value={form.fibraDefault} onChange={(e) => set('fibraDefault', e.currentTarget.value)} maxLength={30} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 2, sm: 3 }}>
            <NumberInput label="Margem 1 (mm)" value={form.margem1Mm} onChange={(v) => set('margem1Mm', typeof v === 'number' ? v : '')} min={0} decimalScale={2} />
            <NumberInput label="Margem 2 (mm)" value={form.margem2Mm} onChange={(v) => set('margem2Mm', typeof v === 'number' ? v : '')} min={0} decimalScale={2} />
            <TextInput label="Formato" value={form.formato} onChange={(e) => set('formato', e.currentTarget.value)} maxLength={60} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Switch label="Miolo" checked={form.miolo} onChange={(e) => set('miolo', e.currentTarget.checked)} />
            <Switch label="Caderno" checked={form.caderno} onChange={(e) => set('caderno', e.currentTarget.checked)} />
            <Switch label="Frente igual ao verso" checked={form.frenteIgualVerso} onChange={(e) => set('frenteIgualVerso', e.currentTarget.checked)} />
            <Switch label="Somar orelhas" checked={form.somarOrelhas} onChange={(e) => set('somarOrelhas', e.currentTarget.checked)} />
            <Switch label="Somar lombada" checked={form.somarLombada} onChange={(e) => set('somarLombada', e.currentTarget.checked)} />
            <Switch label="Usar pinça" checked={form.usarPinca} onChange={(e) => set('usarPinca', e.currentTarget.checked)} />
          </SimpleGrid>
          <Switch label="Ativo" checked={form.status} onChange={(e) => set('status', e.currentTarget.checked)} />
          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar Alterações' : 'Criar Tipo de Plano'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
