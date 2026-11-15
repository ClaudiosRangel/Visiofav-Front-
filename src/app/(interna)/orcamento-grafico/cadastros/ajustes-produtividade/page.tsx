'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Text, Loader, Center, Modal, NumberInput,
  ActionIcon, ScrollArea, Pagination, SimpleGrid, Alert, Select, Tabs, TextInput,
  Switch, Badge,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { AvisoSemInfluencia } from '../_shared/AvisoSemInfluencia'
import { ajustesProdutividadeApi, mensagemErroApi } from '../_shared/cadastros-graficos.api'
import type {
  AjusteProdutividade, DadoAjustar, FuncaoAjuste,
} from '../_shared/cadastros-graficos.types'

// ============================================================================
// Ajustes de Produtividade: ajuste (fator) de acerto/produção/consumo por
// acabamento e centro. Aba "Restrições Automáticas" é somente leitura.
// Exclusão física. Cadastro informativo por enquanto.
// ============================================================================

interface Opcao { value: string; label: string }

const DADOS: Opcao[] = [
  { value: 'ACERTO', label: 'Acerto' },
  { value: 'PRODUCAO_HORA', label: 'Produção/hora' },
  { value: 'CONSUMO_MATERIAL', label: 'Consumo de material' },
  { value: 'INCONDICIONAL', label: 'Incondicional' },
]
const FUNCOES: Opcao[] = [
  { value: 'RESTRICAO_MANUAL', label: 'Restrição manual' },
  { value: 'ATIVIDADE', label: 'Atividade' },
  { value: 'FORMATO_PROCESSO', label: 'Formato/Processo' },
]
const rotulo = (lista: Opcao[], v: string | null | undefined) =>
  lista.find((o) => o.value === v)?.label ?? v ?? '—'

interface FormData {
  acabamentoId: string | null
  centroProducaoId: string | null
  dadoAjustar: DadoAjustar | null
  funcao: FuncaoAjuste | null
  operador: string
  valor: string
  fator: number | ''
  fatorPositivo: boolean
  impedeMontagemCadernos: boolean
  restricaoId: string | null
}

const FORM_INICIAL: FormData = {
  acabamentoId: null, centroProducaoId: null, dadoAjustar: null, funcao: null,
  operador: '', valor: '', fator: 1, fatorPositivo: true,
  impedeMontagemCadernos: false, restricaoId: null,
}
const LIMITE = 50

export default function AjustesProdutividadePage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Ajustes de Produtividade' }, [])

  const [aba, setAba] = useState<string | null>('ajustes')
  const [itens, setItens] = useState<AjusteProdutividade[]>([])
  const [restricoesAuto, setRestricoesAuto] = useState<AjusteProdutividade[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)

  // filtros
  const [fAcabamento, setFAcabamento] = useState<string | null>(null)
  const [fCentro, setFCentro] = useState<string | null>(null)
  const [fDado, setFDado] = useState<string | null>(null)
  const [fFuncao, setFFuncao] = useState<string | null>(null)

  // lookups
  const [acabamentos, setAcabamentos] = useState<Opcao[]>([])
  const [centros, setCentros] = useState<Opcao[]>([])
  const [restricoes, setRestricoes] = useState<Opcao[]>([])

  // modal
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<AjusteProdutividade | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  // Lookups de atividade (acabamento) e centro
  useEffect(() => {
    api.get('/orcamento-grafico/acabamentos', { params: { limit: 100 } })
      .then(({ data }) => {
        const lista = (data.data || data || []) as Array<{ id: string; codigo?: string; nome: string }>
        setAcabamentos(lista.map((a) => ({ value: a.id, label: a.codigo ? `${a.codigo} - ${a.nome}` : a.nome })))
      })
      .catch(() => {})
    api.get('/centros-producao', { params: { limit: 100, status: 'true' } })
      .then(({ data }) => {
        const lista = (data.data || data || []) as Array<{ id: string; codigo?: string; descricao?: string; nome?: string }>
        setCentros(lista.map((c) => ({
          value: c.id,
          label: [c.codigo, c.descricao ?? c.nome].filter(Boolean).join(' - ') || c.id,
        })))
      })
      .catch(() => {})
  }, [])

  // Restrições disponíveis dependem da atividade escolhida no modal
  useEffect(() => {
    if (!modalAberto || !form.acabamentoId) { setRestricoes([]); return }
    let ativo = true
    api.get(`/orcamento-grafico/acabamentos/${form.acabamentoId}/restricoes`)
      .then(({ data }) => {
        if (!ativo) return
        const lista = (data.data || data || []) as Array<{ id: string; nome: string }>
        setRestricoes(lista.map((r) => ({ value: r.id, label: r.nome })))
      })
      .catch(() => { if (ativo) setRestricoes([]) })
    return () => { ativo = false }
  }, [modalAberto, form.acabamentoId])

  const nomeAcabamento = useMemo(() => new Map(acabamentos.map((o) => [o.value, o.label])), [acabamentos])
  const nomeCentro = useMemo(() => new Map(centros.map((o) => [o.value, o.label])), [centros])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      if (aba === 'restricoes') {
        const res = await ajustesProdutividadeApi.restricoesAutomaticas()
        setRestricoesAuto(res.itens)
      } else {
        const res = await ajustesProdutividadeApi.listar({
          pagina,
          limite: LIMITE,
          acabamentoId: fAcabamento || undefined,
          centroProducaoId: fCentro || undefined,
          dadoAjustar: (fDado as DadoAjustar) || undefined,
          funcao: (fFuncao as FuncaoAjuste) || undefined,
        })
        setItens(res.itens)
        setTotal(res.total)
      }
    } catch (err) {
      setErro(mensagemErroApi(err, 'Falha ao buscar ajustes de produtividade'))
    } finally {
      setLoading(false)
    }
  }, [aba, pagina, fAcabamento, fCentro, fDado, fFuncao])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { setPagina(1) }, [fAcabamento, fCentro, fDado, fFuncao])

  function abrirNovo() {
    setEditando(null)
    setForm({ ...FORM_INICIAL, acabamentoId: fAcabamento, centroProducaoId: fCentro })
    setModalAberto(true)
  }

  function abrirEdicao(item: AjusteProdutividade) {
    setEditando(item)
    setForm({
      acabamentoId: item.acabamentoId,
      centroProducaoId: item.centroProducaoId,
      dadoAjustar: item.dadoAjustar,
      funcao: item.funcao,
      operador: item.operador ?? '',
      valor: item.valor ?? '',
      fator: Number(item.fator),
      fatorPositivo: item.fatorPositivo,
      impedeMontagemCadernos: item.impedeMontagemCadernos,
      restricaoId: item.restricaoId,
    })
    setModalAberto(true)
  }

  async function salvar() {
    if (!form.acabamentoId || !form.dadoAjustar || !form.funcao) {
      notifications.show({ title: 'Erro', message: 'Informe atividade, dado a ajustar e função', color: 'red' })
      return
    }
    setSalvando(true)
    try {
      const payload = {
        acabamentoId: form.acabamentoId,
        centroProducaoId: form.centroProducaoId || null,
        dadoAjustar: form.dadoAjustar,
        funcao: form.funcao,
        operador: form.operador.trim() || null,
        valor: form.valor.trim() || null,
        fator: form.fator === '' ? 1 : Number(form.fator),
        fatorPositivo: form.fatorPositivo,
        impedeMontagemCadernos: form.impedeMontagemCadernos,
        restricaoId: form.restricaoId || null,
      }
      if (editando) await ajustesProdutividadeApi.atualizar(editando.id, payload)
      else await ajustesProdutividadeApi.criar(payload)
      notifications.show({ title: 'Salvo', message: `Ajuste ${editando ? 'atualizado' : 'criado'} com sucesso`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err) {
      notifications.show({ title: 'Erro ao salvar', message: mensagemErroApi(err, 'Falha ao salvar'), color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(item: AjusteProdutividade) {
    if (!confirm('Excluir este ajuste de produtividade?')) return
    try {
      await ajustesProdutividadeApi.excluir(item.id)
      notifications.show({ title: 'Excluído', message: 'Ajuste removido', color: 'yellow' })
      if (itens.length === 1 && pagina > 1) setPagina(pagina - 1)
      else carregar()
    } catch (err) {
      notifications.show({ title: 'Erro ao excluir', message: mensagemErroApi(err, 'Falha ao excluir'), color: 'red' })
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE))

  function Linhas({ lista, acoes }: { lista: AjusteProdutividade[]; acoes: boolean }) {
    return (
      <>
        {lista.map((item) => (
          <Table.Tr key={item.id}>
            <Table.Td fw={500}>{nomeAcabamento.get(item.acabamentoId) ?? item.acabamentoId}</Table.Td>
            <Table.Td>{item.centroProducaoId ? (nomeCentro.get(item.centroProducaoId) ?? item.centroProducaoId) : 'Todos'}</Table.Td>
            <Table.Td>{rotulo(DADOS, item.dadoAjustar)}</Table.Td>
            <Table.Td>{rotulo(FUNCOES, item.funcao)}</Table.Td>
            <Table.Td>{[item.operador, item.valor].filter(Boolean).join(' ') || '—'}</Table.Td>
            <Table.Td>
              {item.fatorPositivo ? '+' : '−'}{Number(item.fator)}
            </Table.Td>
            <Table.Td>
              {item.impedeMontagemCadernos && <Badge size="xs" color="orange" variant="light">Impede montagem</Badge>}
              {item.tipoRestricao && <Badge size="xs" color="red" variant="light">Incompatível</Badge>}
            </Table.Td>
            {acoes && (
              <Table.Td>
                <Group gap={4} justify="flex-end" wrap="nowrap">
                  <ActionIcon variant="subtle" onClick={() => abrirEdicao(item)} aria-label="Editar">
                    <IconEdit size={16} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => excluir(item)} aria-label="Excluir">
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            )}
          </Table.Tr>
        ))}
      </>
    )
  }

  function Cabecalho({ acoes }: { acoes: boolean }) {
    return (
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Atividade</Table.Th>
          <Table.Th>Centro</Table.Th>
          <Table.Th>Dado a ajustar</Table.Th>
          <Table.Th>Função</Table.Th>
          <Table.Th>Condição</Table.Th>
          <Table.Th>Fator</Table.Th>
          <Table.Th></Table.Th>
          {acoes && <Table.Th></Table.Th>}
        </Table.Tr>
      </Table.Thead>
    )
  }

  const colSpan = aba === 'restricoes' ? 7 : 8
  const lista = aba === 'restricoes' ? restricoesAuto : itens

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Ajustes de Produtividade</Title>
          <Text size="sm" c="dimmed">
            {aba === 'restricoes'
              ? `${restricoesAuto.length} restrições automáticas.`
              : `${total} ${total === 1 ? 'ajuste cadastrado' : 'ajustes cadastrados'}.`}
          </Text>
        </div>
        {aba !== 'restricoes' && (
          <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Ajuste</Button>
        )}
      </Group>

      <AvisoSemInfluencia />

      <Tabs value={aba} onChange={setAba}>
        <Tabs.List>
          <Tabs.Tab value="ajustes">Ajustes</Tabs.Tab>
          <Tabs.Tab value="restricoes">Restrições Automáticas</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {aba !== 'restricoes' && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <Select label="Atividade" placeholder="Todas" data={acabamentos} value={fAcabamento}
            onChange={setFAcabamento} searchable clearable />
          <Select label="Centro" placeholder="Todos" data={centros} value={fCentro}
            onChange={setFCentro} searchable clearable />
          <Select label="Dado a ajustar" placeholder="Todos" data={DADOS} value={fDado}
            onChange={setFDado} clearable />
          <Select label="Função" placeholder="Todas" data={FUNCOES} value={fFuncao}
            onChange={setFFuncao} clearable />
        </SimpleGrid>
      )}

      {erro && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} title="Erro ao carregar">
          <Group justify="space-between">
            <Text size="sm">{erro}</Text>
            <Button size="xs" variant="light" color="red" onClick={carregar}>Tentar novamente</Button>
          </Group>
        </Alert>
      )}

      {loading ? <Center py="xl"><Loader /></Center> : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Cabecalho acoes={aba !== 'restricoes'} />
            <Table.Tbody>
              <Linhas lista={lista} acoes={aba !== 'restricoes'} />
              {lista.length === 0 && !erro && (
                <Table.Tr>
                  <Table.Td colSpan={colSpan}>
                    <Text ta="center" c="dimmed" py="md">
                      {aba === 'restricoes'
                        ? 'Nenhuma restrição automática encontrada.'
                        : 'Nenhum ajuste de produtividade encontrado.'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {aba !== 'restricoes' && totalPaginas > 1 && (
        <Group justify="center">
          <Pagination total={totalPaginas} value={pagina} onChange={setPagina} />
        </Group>
      )}

      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Ajuste de Produtividade' : 'Novo Ajuste de Produtividade'}
        centered
        size="lg"
      >
        <Stack gap="md">
          <Select label="Atividade" data={acabamentos} value={form.acabamentoId} searchable required
            onChange={(v) => setForm({ ...form, acabamentoId: v, restricaoId: null })} />
          <Select label="Centro de produção" placeholder="Todos" data={centros} value={form.centroProducaoId}
            searchable clearable onChange={(v) => setForm({ ...form, centroProducaoId: v })} />
          <SimpleGrid cols={2}>
            <Select label="Dado a ajustar" data={DADOS} value={form.dadoAjustar} required
              onChange={(v) => setForm({ ...form, dadoAjustar: v as DadoAjustar | null })} />
            <Select label="Função" data={FUNCOES} value={form.funcao} required
              onChange={(v) => setForm({ ...form, funcao: v as FuncaoAjuste | null })} />
          </SimpleGrid>
          <Select label="Restrição" placeholder={form.acabamentoId ? 'Nenhuma' : 'Escolha a atividade primeiro'}
            data={restricoes} value={form.restricaoId} searchable clearable disabled={!form.acabamentoId}
            onChange={(v) => setForm({ ...form, restricaoId: v })} />
          <SimpleGrid cols={2}>
            <TextInput label="Operador" placeholder="Ex.: >=, =, <" value={form.operador}
              onChange={(e) => setForm({ ...form, operador: e.currentTarget.value })} />
            <TextInput label="Valor" value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.currentTarget.value })} />
          </SimpleGrid>
          <NumberInput label="Fator" value={form.fator} min={0} decimalScale={4}
            onChange={(v) => setForm({ ...form, fator: typeof v === 'number' ? v : '' })} />
          <Switch label="Fator positivo (soma)" checked={form.fatorPositivo}
            onChange={(e) => setForm({ ...form, fatorPositivo: e.currentTarget.checked })} />
          <Switch label="Impede montagem de cadernos" checked={form.impedeMontagemCadernos}
            onChange={(e) => setForm({ ...form, impedeMontagemCadernos: e.currentTarget.checked })} />
          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar Alterações' : 'Criar Ajuste'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
