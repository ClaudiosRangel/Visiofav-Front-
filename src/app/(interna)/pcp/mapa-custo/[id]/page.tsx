'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Title, Stack, Group, Button, Badge, Text, Loader, Center, Tabs, Table,
  Modal, TextInput, NumberInput, Select, Switch, ActionIcon, Card, SimpleGrid,
} from '@mantine/core'
import {
  IconArrowLeft, IconPlus, IconEdit, IconTrash, IconCalculator, IconLock, IconUpload,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

/**
 * Editor do Mapa de Custos RKW (spec: mapa-custos-rkw).
 * Abas: Centros, Bens, Funcionários, Despesas, Chaves, Parâmetros, Resultado.
 */

const NATUREZAS = [
  { value: 'PRODUTIVO', label: 'Produtivo' },
  { value: 'AUXILIAR', label: 'Auxiliar' },
  { value: 'ADMINISTRACAO', label: 'Administração' },
]
const ESTADOS = [
  { value: 'OTIMO', label: 'Ótimo' },
  { value: 'BOM', label: 'Bom' },
  { value: 'REGULAR', label: 'Regular' },
]
const TIPOS_CHAVE = [
  { value: 'MANUAL', label: 'Manual (pesos fixos)' },
  { value: 'HEADCOUNT', label: 'Por nº de funcionários' },
  { value: 'ATIVO', label: 'Por valor dos bens' },
  { value: 'CENTRO', label: 'Centro único (100%)' },
  { value: 'FUNCIONARIO', label: 'Rateio de funcionário' },
]

const fmtMoeda = (v: unknown) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Mapa {
  id: string; competencia: string; descricao: string | null; status: 'RASCUNHO' | 'FECHADO'
  percEncargos: string; horasProdutivasBase: number; ajustePraticarPerc: string
  custoFixoTotal: string | null; taxaAdministrativa: string | null; totalFuncionarios: number | null
  ativoImobilizado: string | null; depreciacaoMensal: string | null
  centros: any[]; bens: any[]; funcionarios: any[]; despesas: any[]; chaves: any[]; resultados: any[]
}

export default function MapaCustoDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [mapa, setMapa] = useState<Mapa | null>(null)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<string | null>('centros')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/pcp/mapa-custo/${id}`)
      setMapa(res.data)
    } catch {
      notifications.show({ title: 'Erro', message: 'Mapa não encontrado', color: 'red' })
      router.push('/pcp/mapa-custo')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { document.title = `PCP - Mapa ${mapa?.competencia ?? ''}` }, [mapa?.competencia])

  const fechado = mapa?.status === 'FECHADO'

  async function calcular() {
    try {
      await api.post(`/pcp/mapa-custo/${id}/calcular`)
      notifications.show({ title: 'Cálculo concluído', message: 'Resultados atualizados.', color: 'green' })
      setAba('resultado')
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro no cálculo', message: err?.response?.data?.message || 'Falha', color: 'red' })
    }
  }

  async function fechar() {
    if (!window.confirm('Fechar o mapa? Ele ficará imutável (não editável).')) return
    try {
      await api.post(`/pcp/mapa-custo/${id}/fechar`)
      notifications.show({ title: 'Mapa fechado', message: '', color: 'blue' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    }
  }

  async function aplicarOrcamento() {
    try {
      const res = await api.post(`/pcp/mapa-custo/${id}/aplicar-orcamento`)
      notifications.show({
        title: 'Aplicado ao Orçamento',
        message: `${res.data.totalAplicados} centro(s) aplicado(s), ${res.data.totalPulados} pulado(s).`,
        color: 'green',
      })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    }
  }

  if (loading || !mapa) return <Center py="xl"><Loader /></Center>

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <ActionIcon variant="subtle" onClick={() => router.push('/pcp/mapa-custo')}><IconArrowLeft /></ActionIcon>
          <div>
            <Title order={3}>Mapa de Custos — {mapa.competencia}</Title>
            <Text size="sm" c="dimmed">{mapa.descricao || 'Sem descrição'}</Text>
          </div>
          <Badge color={fechado ? 'gray' : 'green'}>{fechado ? 'Fechado' : 'Rascunho'}</Badge>
        </Group>
        <Group>
          <Button leftSection={<IconCalculator size={16} />} onClick={calcular} variant="filled">Calcular</Button>
          <Button leftSection={<IconUpload size={16} />} onClick={aplicarOrcamento} variant="light">Aplicar ao Orçamento</Button>
          {!fechado && <Button leftSection={<IconLock size={16} />} onClick={fechar} color="gray" variant="outline">Fechar</Button>}
        </Group>
      </Group>

      <Tabs value={aba} onChange={setAba}>
        <Tabs.List>
          <Tabs.Tab value="centros">Centros ({mapa.centros.length})</Tabs.Tab>
          <Tabs.Tab value="bens">Bens ({mapa.bens.length})</Tabs.Tab>
          <Tabs.Tab value="funcionarios">Funcionários ({mapa.funcionarios.length})</Tabs.Tab>
          <Tabs.Tab value="despesas">Despesas ({mapa.despesas.length})</Tabs.Tab>
          <Tabs.Tab value="chaves">Chaves de Rateio ({mapa.chaves.length})</Tabs.Tab>
          <Tabs.Tab value="resultado">Resultado</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="centros" pt="md">
          <CentrosTab mapa={mapa} fechado={fechado} onChange={carregar} />
        </Tabs.Panel>
        <Tabs.Panel value="bens" pt="md">
          <BensTab mapa={mapa} fechado={fechado} onChange={carregar} />
        </Tabs.Panel>
        <Tabs.Panel value="funcionarios" pt="md">
          <FuncionariosTab mapa={mapa} fechado={fechado} onChange={carregar} />
        </Tabs.Panel>
        <Tabs.Panel value="despesas" pt="md">
          <DespesasTab mapa={mapa} fechado={fechado} onChange={carregar} />
        </Tabs.Panel>
        <Tabs.Panel value="chaves" pt="md">
          <ChavesTab mapa={mapa} fechado={fechado} onChange={carregar} />
        </Tabs.Panel>
        <Tabs.Panel value="resultado" pt="md">
          <ResultadoTab mapa={mapa} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

// helper genérico de exclusão
function useDelete(onChange: () => void) {
  return async (url: string) => {
    if (!window.confirm('Excluir este item?')) return
    try {
      await api.delete(url)
      onChange()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir', color: 'red' })
    }
  }
}

// ── Aba Centros ──────────────────────────────────────────────────────────
function CentrosTab({ mapa, fechado, onChange }: { mapa: Mapa; fechado: boolean; onChange: () => void }) {
  const del = useDelete(onChange)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState<any>(null)
  const [form, setForm] = useState<any>({ codigo: '', descricao: '', natureza: 'PRODUTIVO', unidadesProdutivas: 1, horasExtras: 0, chaveRateioId: null })

  function abrir(item?: any) {
    setEdit(item ?? null)
    setForm(item ? { codigo: item.codigo, descricao: item.descricao, natureza: item.natureza, unidadesProdutivas: item.unidadesProdutivas, horasExtras: item.horasExtras, chaveRateioId: item.chaveRateioId } : { codigo: '', descricao: '', natureza: 'PRODUTIVO', unidadesProdutivas: 1, horasExtras: 0, chaveRateioId: null })
    setModal(true)
  }
  async function salvar() {
    try {
      if (edit) await api.put(`/pcp/mapa-custo/${mapa.id}/centros/${edit.id}`, form)
      else await api.post(`/pcp/mapa-custo/${mapa.id}/centros`, form)
      setModal(false); onChange()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  return (
    <Stack gap="sm">
      {!fechado && <Group justify="flex-end"><Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => abrir()}>Novo Centro</Button></Group>}
      <Table striped>
        <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Natureza</Table.Th><Table.Th>Un.Prod</Table.Th><Table.Th>H.Extras</Table.Th><Table.Th>Horas Prod.</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {mapa.centros.map((c) => (
            <Table.Tr key={c.id}>
              <Table.Td fw={600}>{c.codigo}</Table.Td>
              <Table.Td>{c.descricao}</Table.Td>
              <Table.Td><Badge variant="light">{c.natureza}</Badge></Table.Td>
              <Table.Td>{c.unidadesProdutivas}</Table.Td>
              <Table.Td>{c.horasExtras}</Table.Td>
              <Table.Td>{c.horasProdutivas ?? '—'}</Table.Td>
              <Table.Td>{!fechado && <Group gap={4}><ActionIcon variant="subtle" onClick={() => abrir(c)}><IconEdit size={14} /></ActionIcon><ActionIcon variant="subtle" color="red" onClick={() => del(`/pcp/mapa-custo/${mapa.id}/centros/${c.id}`)}><IconTrash size={14} /></ActionIcon></Group>}</Table.Td>
            </Table.Tr>
          ))}
          {mapa.centros.length === 0 && <Table.Tr><Table.Td colSpan={7}><Text ta="center" c="dimmed" py="sm">Nenhum centro</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>

      <Modal opened={modal} onClose={() => setModal(false)} title={edit ? 'Editar Centro' : 'Novo Centro'} centered>
        <Stack gap="sm">
          <TextInput label="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })} required />
          <TextInput label="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })} required />
          <Select label="Natureza" data={NATUREZAS} value={form.natureza} onChange={(v) => setForm({ ...form, natureza: v })} />
          <Group grow>
            <NumberInput label="Unidades Produtivas" value={form.unidadesProdutivas} onChange={(v) => setForm({ ...form, unidadesProdutivas: Number(v) || 0 })} min={0} />
            <NumberInput label="Horas Extras" value={form.horasExtras} onChange={(v) => setForm({ ...form, horasExtras: Number(v) || 0 })} min={0} />
          </Group>
          {(form.natureza === 'AUXILIAR' || form.natureza === 'ADMINISTRACAO') && (
            <Select label="Chave de rateio (como distribui nos produtivos)" data={mapa.chaves.map((k) => ({ value: k.id, label: k.nome }))} value={form.chaveRateioId} onChange={(v) => setForm({ ...form, chaveRateioId: v })} clearable />
          )}
          <Button onClick={salvar} fullWidth>{edit ? 'Salvar' : 'Criar'}</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}

// ── Aba Bens ─────────────────────────────────────────────────────────────
function BensTab({ mapa, fechado, onChange }: { mapa: Mapa; fechado: boolean; onChange: () => void }) {
  const del = useDelete(onChange)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState<any>(null)
  const [form, setForm] = useState<any>({ centroCustoId: '', grupo: '', descricao: '', valor: 0, estado: 'BOM', anosVidaUtil: 10, residualPerc: 0 })
  const centroNome = (id: string) => mapa.centros.find((c) => c.id === id)?.descricao ?? id

  function abrir(item?: any) {
    setEdit(item ?? null)
    setForm(item ? { centroCustoId: item.centroCustoId, grupo: item.grupo, descricao: item.descricao, valor: Number(item.valor), estado: item.estado, anosVidaUtil: item.anosVidaUtil, residualPerc: Number(item.residualPerc) } : { centroCustoId: mapa.centros[0]?.id ?? '', grupo: '', descricao: '', valor: 0, estado: 'BOM', anosVidaUtil: 10, residualPerc: 0 })
    setModal(true)
  }
  async function salvar() {
    try {
      if (edit) await api.put(`/pcp/mapa-custo/${mapa.id}/bens/${edit.id}`, form)
      else await api.post(`/pcp/mapa-custo/${mapa.id}/bens`, form)
      setModal(false); onChange()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  return (
    <Stack gap="sm">
      {!fechado && <Group justify="flex-end"><Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => abrir()}>Novo Bem</Button></Group>}
      <Table striped>
        <Table.Thead><Table.Tr><Table.Th>Centro</Table.Th><Table.Th>Grupo</Table.Th><Table.Th>Bem</Table.Th><Table.Th>Valor</Table.Th><Table.Th>Estado</Table.Th><Table.Th>Anos</Table.Th><Table.Th>Resid.%</Table.Th><Table.Th>Depr./mês</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {mapa.bens.map((b) => (
            <Table.Tr key={b.id}>
              <Table.Td>{centroNome(b.centroCustoId)}</Table.Td>
              <Table.Td>{b.grupo}</Table.Td>
              <Table.Td>{b.descricao}</Table.Td>
              <Table.Td>{fmtMoeda(b.valor)}</Table.Td>
              <Table.Td>{b.estado}</Table.Td>
              <Table.Td>{b.anosVidaUtil}</Table.Td>
              <Table.Td>{Number(b.residualPerc)}%</Table.Td>
              <Table.Td>{fmtMoeda(b.depreciacaoMensal)}</Table.Td>
              <Table.Td>{!fechado && <Group gap={4}><ActionIcon variant="subtle" onClick={() => abrir(b)}><IconEdit size={14} /></ActionIcon><ActionIcon variant="subtle" color="red" onClick={() => del(`/pcp/mapa-custo/${mapa.id}/bens/${b.id}`)}><IconTrash size={14} /></ActionIcon></Group>}</Table.Td>
            </Table.Tr>
          ))}
          {mapa.bens.length === 0 && <Table.Tr><Table.Td colSpan={9}><Text ta="center" c="dimmed" py="sm">Nenhum bem</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>

      <Modal opened={modal} onClose={() => setModal(false)} title={edit ? 'Editar Bem' : 'Novo Bem'} centered>
        <Stack gap="sm">
          <Select label="Centro" data={mapa.centros.map((c) => ({ value: c.id, label: c.descricao }))} value={form.centroCustoId} onChange={(v) => setForm({ ...form, centroCustoId: v })} required searchable />
          <TextInput label="Grupo" value={form.grupo} onChange={(e) => setForm({ ...form, grupo: e.currentTarget.value })} placeholder="Veículos, Impressoras, Informática..." />
          <TextInput label="Descrição do bem" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })} required />
          <Group grow>
            <NumberInput label="Valor" value={form.valor} onChange={(v) => setForm({ ...form, valor: Number(v) || 0 })} min={0} decimalScale={2} />
            <Select label="Estado" data={ESTADOS} value={form.estado} onChange={(v) => setForm({ ...form, estado: v })} />
          </Group>
          <Group grow>
            <NumberInput label="Anos vida útil" value={form.anosVidaUtil} onChange={(v) => setForm({ ...form, anosVidaUtil: Number(v) || 1 })} min={1} />
            <NumberInput label="Residual (%)" value={form.residualPerc} onChange={(v) => setForm({ ...form, residualPerc: Number(v) || 0 })} min={0} max={100} />
          </Group>
          <Button onClick={salvar} fullWidth>{edit ? 'Salvar' : 'Criar'}</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}

// ── Aba Funcionários ───────────────────────────────────────────────────────
function FuncionariosTab({ mapa, fechado, onChange }: { mapa: Mapa; fechado: boolean; onChange: () => void }) {
  const del = useDelete(onChange)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState<any>(null)
  const [form, setForm] = useState<any>({ nome: '', cargo: '', centroCustoId: '', salario: 0, ajudaCusto: 0, rateado: false })
  const centroNome = (id: string | null) => (id ? mapa.centros.find((c) => c.id === id)?.descricao ?? id : '(rateado)')

  function abrir(item?: any) {
    setEdit(item ?? null)
    setForm(item ? { nome: item.nome, cargo: item.cargo, centroCustoId: item.centroCustoId, salario: Number(item.salario), ajudaCusto: Number(item.ajudaCusto), rateado: item.rateado } : { nome: '', cargo: '', centroCustoId: mapa.centros[0]?.id ?? '', salario: 0, ajudaCusto: 0, rateado: false })
    setModal(true)
  }
  async function salvar() {
    try {
      const payload = { ...form, centroCustoId: form.rateado ? null : form.centroCustoId }
      if (edit) await api.put(`/pcp/mapa-custo/${mapa.id}/funcionarios/${edit.id}`, payload)
      else await api.post(`/pcp/mapa-custo/${mapa.id}/funcionarios`, payload)
      setModal(false); onChange()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  return (
    <Stack gap="sm">
      {!fechado && <Group justify="flex-end"><Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => abrir()}>Novo Funcionário</Button></Group>}
      <Table striped>
        <Table.Thead><Table.Tr><Table.Th>Nome</Table.Th><Table.Th>Cargo</Table.Th><Table.Th>Centro</Table.Th><Table.Th>Salário</Table.Th><Table.Th>Ajuda Custo</Table.Th><Table.Th>Rateado</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {mapa.funcionarios.map((f) => (
            <Table.Tr key={f.id}>
              <Table.Td>{f.nome}</Table.Td>
              <Table.Td>{f.cargo || '—'}</Table.Td>
              <Table.Td>{centroNome(f.centroCustoId)}</Table.Td>
              <Table.Td>{fmtMoeda(f.salario)}</Table.Td>
              <Table.Td>{fmtMoeda(f.ajudaCusto)}</Table.Td>
              <Table.Td>{f.rateado ? <Badge color="orange" variant="light">Rateado</Badge> : '—'}</Table.Td>
              <Table.Td>{!fechado && <Group gap={4}><ActionIcon variant="subtle" onClick={() => abrir(f)}><IconEdit size={14} /></ActionIcon><ActionIcon variant="subtle" color="red" onClick={() => del(`/pcp/mapa-custo/${mapa.id}/funcionarios/${f.id}`)}><IconTrash size={14} /></ActionIcon></Group>}</Table.Td>
            </Table.Tr>
          ))}
          {mapa.funcionarios.length === 0 && <Table.Tr><Table.Td colSpan={7}><Text ta="center" c="dimmed" py="sm">Nenhum funcionário</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>

      <Modal opened={modal} onClose={() => setModal(false)} title={edit ? 'Editar Funcionário' : 'Novo Funcionário'} centered>
        <Stack gap="sm">
          <TextInput label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })} required />
          <TextInput label="Cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.currentTarget.value })} />
          <Switch label="Funcionário rateado (distribuído entre centros por chave)" checked={form.rateado} onChange={(e) => setForm({ ...form, rateado: e.currentTarget.checked })} />
          {!form.rateado && <Select label="Centro" data={mapa.centros.map((c) => ({ value: c.id, label: c.descricao }))} value={form.centroCustoId} onChange={(v) => setForm({ ...form, centroCustoId: v })} required searchable />}
          <Group grow>
            <NumberInput label="Salário" value={form.salario} onChange={(v) => setForm({ ...form, salario: Number(v) || 0 })} min={0} decimalScale={2} />
            <NumberInput label="Ajuda de Custo" value={form.ajudaCusto} onChange={(v) => setForm({ ...form, ajudaCusto: Number(v) || 0 })} min={0} decimalScale={2} />
          </Group>
          <Button onClick={salvar} fullWidth>{edit ? 'Salvar' : 'Criar'}</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}

// ── Aba Despesas ───────────────────────────────────────────────────────────
function DespesasTab({ mapa, fechado, onChange }: { mapa: Mapa; fechado: boolean; onChange: () => void }) {
  const del = useDelete(onChange)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState<any>(null)
  const [form, setForm] = useState<any>({ descricao: '', valor: 0, chaveRateioId: '' })
  const chaveNome = (id: string) => mapa.chaves.find((k) => k.id === id)?.nome ?? id

  function abrir(item?: any) {
    setEdit(item ?? null)
    setForm(item ? { descricao: item.descricao, valor: Number(item.valor), chaveRateioId: item.chaveRateioId } : { descricao: '', valor: 0, chaveRateioId: mapa.chaves[0]?.id ?? '' })
    setModal(true)
  }
  async function salvar() {
    try {
      if (edit) await api.put(`/pcp/mapa-custo/${mapa.id}/despesas/${edit.id}`, form)
      else await api.post(`/pcp/mapa-custo/${mapa.id}/despesas`, form)
      setModal(false); onChange()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  return (
    <Stack gap="sm">
      {!fechado && <Group justify="flex-end"><Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => abrir()} disabled={mapa.chaves.length === 0}>Nova Despesa</Button></Group>}
      {mapa.chaves.length === 0 && <Text size="sm" c="dimmed">Cadastre ao menos uma Chave de Rateio antes de lançar despesas.</Text>}
      <Table striped>
        <Table.Thead><Table.Tr><Table.Th>Descrição</Table.Th><Table.Th>Valor</Table.Th><Table.Th>Chave de Rateio</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {mapa.despesas.map((d) => (
            <Table.Tr key={d.id}>
              <Table.Td>{d.descricao}</Table.Td>
              <Table.Td>{fmtMoeda(d.valor)}</Table.Td>
              <Table.Td>{chaveNome(d.chaveRateioId)}</Table.Td>
              <Table.Td>{!fechado && <Group gap={4}><ActionIcon variant="subtle" onClick={() => abrir(d)}><IconEdit size={14} /></ActionIcon><ActionIcon variant="subtle" color="red" onClick={() => del(`/pcp/mapa-custo/${mapa.id}/despesas/${d.id}`)}><IconTrash size={14} /></ActionIcon></Group>}</Table.Td>
            </Table.Tr>
          ))}
          {mapa.despesas.length === 0 && <Table.Tr><Table.Td colSpan={4}><Text ta="center" c="dimmed" py="sm">Nenhuma despesa</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>

      <Modal opened={modal} onClose={() => setModal(false)} title={edit ? 'Editar Despesa' : 'Nova Despesa'} centered>
        <Stack gap="sm">
          <TextInput label="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })} required />
          <NumberInput label="Valor" value={form.valor} onChange={(v) => setForm({ ...form, valor: Number(v) || 0 })} min={0} decimalScale={2} />
          <Select label="Chave de Rateio" data={mapa.chaves.map((k) => ({ value: k.id, label: k.nome }))} value={form.chaveRateioId} onChange={(v) => setForm({ ...form, chaveRateioId: v })} required />
          <Button onClick={salvar} fullWidth>{edit ? 'Salvar' : 'Criar'}</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}

// ── Aba Chaves de Rateio ─────────────────────────────────────────────────────
function ChavesTab({ mapa, fechado, onChange }: { mapa: Mapa; fechado: boolean; onChange: () => void }) {
  const del = useDelete(onChange)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState<any>(null)
  const [form, setForm] = useState<any>({ nome: '', tipo: 'MANUAL', funcionarioCustoId: null, destinos: [] as { centroCustoId: string; peso: number }[] })

  function abrir(item?: any) {
    setEdit(item ?? null)
    setForm(item ? { nome: item.nome, tipo: item.tipo, funcionarioCustoId: item.funcionarioCustoId, destinos: (item.destinos || []).map((d: any) => ({ centroCustoId: d.centroCustoId, peso: Number(d.peso) })) } : { nome: '', tipo: 'MANUAL', funcionarioCustoId: null, destinos: [] })
    setModal(true)
  }
  function addDestino() { setForm({ ...form, destinos: [...form.destinos, { centroCustoId: mapa.centros[0]?.id ?? '', peso: 1 }] }) }
  function setDestino(i: number, patch: any) { const d = [...form.destinos]; d[i] = { ...d[i], ...patch }; setForm({ ...form, destinos: d }) }
  function rmDestino(i: number) { setForm({ ...form, destinos: form.destinos.filter((_: any, idx: number) => idx !== i) }) }

  async function salvar() {
    try {
      if (edit) await api.put(`/pcp/mapa-custo/${mapa.id}/chaves/${edit.id}`, form)
      else await api.post(`/pcp/mapa-custo/${mapa.id}/chaves`, form)
      setModal(false); onChange()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  const centroNome = (id: string) => mapa.centros.find((c) => c.id === id)?.descricao ?? id

  return (
    <Stack gap="sm">
      {!fechado && <Group justify="flex-end"><Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => abrir()}>Nova Chave</Button></Group>}
      <Table striped>
        <Table.Thead><Table.Tr><Table.Th>Nome</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Destinos</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {mapa.chaves.map((k) => (
            <Table.Tr key={k.id}>
              <Table.Td fw={600}>{k.nome}</Table.Td>
              <Table.Td><Badge variant="light">{k.tipo}</Badge></Table.Td>
              <Table.Td><Text size="xs" c="dimmed">{(k.destinos || []).map((d: any) => `${centroNome(d.centroCustoId)} (${Number(d.peso)})`).join(', ') || '—'}</Text></Table.Td>
              <Table.Td>{!fechado && <Group gap={4}><ActionIcon variant="subtle" onClick={() => abrir(k)}><IconEdit size={14} /></ActionIcon><ActionIcon variant="subtle" color="red" onClick={() => del(`/pcp/mapa-custo/${mapa.id}/chaves/${k.id}`)}><IconTrash size={14} /></ActionIcon></Group>}</Table.Td>
            </Table.Tr>
          ))}
          {mapa.chaves.length === 0 && <Table.Tr><Table.Td colSpan={4}><Text ta="center" c="dimmed" py="sm">Nenhuma chave</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>

      <Modal opened={modal} onClose={() => setModal(false)} title={edit ? 'Editar Chave' : 'Nova Chave de Rateio'} centered size="lg">
        <Stack gap="sm">
          <Group grow>
            <TextInput label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })} required />
            <Select label="Tipo" data={TIPOS_CHAVE} value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })} />
          </Group>
          {form.tipo === 'FUNCIONARIO' && (
            <Select label="Funcionário rateado" data={mapa.funcionarios.filter((f) => f.rateado).map((f) => ({ value: f.id, label: f.nome }))} value={form.funcionarioCustoId} onChange={(v) => setForm({ ...form, funcionarioCustoId: v })} />
          )}
          <Group justify="space-between"><Text size="sm" fw={600}>Destinos (peso; % = peso ÷ soma dos pesos)</Text><Button size="xs" variant="light" onClick={addDestino}>+ Destino</Button></Group>
          {form.destinos.map((d: any, i: number) => (
            <Group key={i} grow align="flex-end">
              <Select label="Centro" data={mapa.centros.map((c) => ({ value: c.id, label: c.descricao }))} value={d.centroCustoId} onChange={(v) => setDestino(i, { centroCustoId: v })} searchable />
              <NumberInput label="Peso" value={d.peso} onChange={(v) => setDestino(i, { peso: Number(v) || 0 })} min={0} />
              <ActionIcon color="red" variant="subtle" onClick={() => rmDestino(i)}><IconTrash size={16} /></ActionIcon>
            </Group>
          ))}
          <Text size="xs" c="dimmed">Para HEADCOUNT/ATIVO o peso é calculado automaticamente; os destinos definem quais centros participam.</Text>
          <Button onClick={salvar} fullWidth>{edit ? 'Salvar' : 'Criar'}</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}

// ── Aba Resultado ────────────────────────────────────────────────────────────
function ResultadoTab({ mapa }: { mapa: Mapa }) {
  const centroNome = (id: string) => mapa.centros.find((c) => c.id === id)?.descricao ?? id
  const centroNat = (id: string) => mapa.centros.find((c) => c.id === id)?.natureza ?? ''
  const resultados = [...mapa.resultados].sort((a, b) => centroNome(a.centroCustoId).localeCompare(centroNome(b.centroCustoId)))

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Card withBorder><Text size="xs" c="dimmed">Custo Fixo Total</Text><Text fw={700}>{fmtMoeda(mapa.custoFixoTotal)}</Text></Card>
        <Card withBorder><Text size="xs" c="dimmed">Taxa Administrativa</Text><Text fw={700}>{mapa.taxaAdministrativa == null ? '—' : `${Number(mapa.taxaAdministrativa).toFixed(1)}%`}</Text></Card>
        <Card withBorder><Text size="xs" c="dimmed">Total Funcionários</Text><Text fw={700}>{mapa.totalFuncionarios ?? '—'}</Text></Card>
        <Card withBorder><Text size="xs" c="dimmed">Depreciação Mensal</Text><Text fw={700}>{fmtMoeda(mapa.depreciacaoMensal)}</Text></Card>
      </SimpleGrid>

      {resultados.length === 0 ? (
        <Text c="dimmed" ta="center" py="md">Clique em "Calcular" para gerar os resultados.</Text>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Centro</Table.Th>
              <Table.Th ta="right">Sal.+Enc. (A)</Table.Th>
              <Table.Th ta="right">Deprec. (B)</Table.Th>
              <Table.Th ta="right">Despesas (C)</Table.Th>
              <Table.Th ta="right">Custo Fixo (D)</Table.Th>
              <Table.Th ta="right">Aux. (E)</Table.Th>
              <Table.Th ta="right">Adm. (F)</Table.Th>
              <Table.Th ta="right">Final (G)</Table.Th>
              <Table.Th ta="right">Horas</Table.Th>
              <Table.Th ta="right">Custo/Hora Apurado</Table.Th>
              <Table.Th ta="right">A Praticar</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {resultados.map((r) => (
              <Table.Tr key={r.centroCustoId}>
                <Table.Td>{centroNome(r.centroCustoId)} {centroNat(r.centroCustoId) !== 'PRODUTIVO' && <Badge size="xs" variant="light" color="gray">{centroNat(r.centroCustoId)}</Badge>}</Table.Td>
                <Table.Td ta="right">{fmtMoeda(r.salariosEncargos)}</Table.Td>
                <Table.Td ta="right">{fmtMoeda(r.depreciacoes)}</Table.Td>
                <Table.Td ta="right">{fmtMoeda(r.despesas)}</Table.Td>
                <Table.Td ta="right">{fmtMoeda(r.custoFixo)}</Table.Td>
                <Table.Td ta="right">{fmtMoeda(r.rateioAuxiliar)}</Table.Td>
                <Table.Td ta="right">{fmtMoeda(r.rateioAdministracao)}</Table.Td>
                <Table.Td ta="right" fw={600}>{fmtMoeda(r.custoFixoFinal)}</Table.Td>
                <Table.Td ta="right">{Number(r.horasProdutivas) || '—'}</Table.Td>
                <Table.Td ta="right">{Number(r.horasProdutivas) > 0 ? fmtMoeda(r.custoHoraApurado) : '—'}</Table.Td>
                <Table.Td ta="right" fw={700} c="green">{Number(r.horasProdutivas) > 0 ? fmtMoeda(r.custoHoraPraticar) : '—'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}
