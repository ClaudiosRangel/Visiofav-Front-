'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center, Modal, TextInput,
  Select, NumberInput, ActionIcon, ScrollArea, Switch, Alert, SegmentedControl, Paper,
  Checkbox, Tooltip,
} from '@mantine/core'
import {
  IconPlus, IconEdit, IconTrash, IconAlertCircle, IconArrowUp, IconArrowDown, IconX,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { camposLivresApi, mensagemErroApi } from '../_shared/cadastros-graficos.api'
import type {
  CampoLivre, CampoLivreInput, ProprietarioCampoLivre, SituacaoFiltro, TipoCampoLivre,
} from '../_shared/cadastros-graficos.types'
import AvisoSemInfluencia from '../_shared/AvisoSemInfluencia'

// ============================================================================
// Campos Livres — campos personalizados por proprietário (Solicitação, Pedido,
// Recusa, Insumo), com tipo Texto ou Lista (opções) e cópia para o pedido.
// ============================================================================

const PROPRIETARIOS: { value: ProprietarioCampoLivre; label: string }[] = [
  { value: 'SOLICITACAO', label: 'Solicitação' },
  { value: 'PEDIDO', label: 'Pedido' },
  { value: 'RECUSA', label: 'Recusa' },
  { value: 'INSUMO', label: 'Insumo' },
]

const TIPOS: { value: TipoCampoLivre; label: string }[] = [
  { value: 'TEXTO', label: 'Texto' },
  { value: 'LISTA', label: 'Lista' },
]

const SITUACOES = [
  { value: 'ativo', label: 'Ativos' },
  { value: 'inativo', label: 'Inativos' },
  { value: 'todos', label: 'Todos' },
]

const rotuloProprietario = (v: string) => PROPRIETARIOS.find((p) => p.value === v)?.label ?? v

interface OpcaoForm { valor: string; padrao: boolean }

interface FormState {
  nome: string
  proprietario: ProprietarioCampoLivre
  tipo: TipoCampoLivre
  obrigatorio: boolean
  ordem: number | ''
  status: boolean
  copiaParaPedidoCampoId: string | null
  opcoes: OpcaoForm[]
}

const FORM_INICIAL: FormState = {
  nome: '',
  proprietario: 'SOLICITACAO',
  tipo: 'TEXTO',
  obrigatorio: false,
  ordem: 0,
  status: true,
  copiaParaPedidoCampoId: null,
  opcoes: [],
}

export default function CamposLivresPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Campos Livres' }, [])

  const [campos, setCampos] = useState<CampoLivre[]>([])
  const [camposPedido, setCamposPedido] = useState<CampoLivre[]>([])
  const [filtroProp, setFiltroProp] = useState<string>('TODOS')
  const [situacao, setSituacao] = useState<SituacaoFiltro>('ativo')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<CampoLivre | null>(null)
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [novaOpcao, setNovaOpcao] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const [lista, pedido] = await Promise.all([
        camposLivresApi.listar({
          proprietario: filtroProp === 'TODOS' ? undefined : (filtroProp as ProprietarioCampoLivre),
          status: situacao,
        }),
        camposLivresApi.listar({ proprietario: 'PEDIDO', status: 'ativo' }),
      ])
      setCampos(lista ?? [])
      setCamposPedido(pedido ?? [])
    } catch (err) {
      setErro(mensagemErroApi(err, 'Falha ao carregar campos livres'))
    } finally {
      setLoading(false)
    }
  }, [filtroProp, situacao])

  useEffect(() => { carregar() }, [carregar])

  // Agrupa por proprietário, mantendo a ordem fixa dos proprietários e `ordem` dentro do grupo.
  const grupos = useMemo(() => {
    return PROPRIETARIOS
      .map((p) => ({
        ...p,
        itens: campos
          .filter((c) => c.proprietario === p.value)
          .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR')),
      }))
      .filter((g) => g.itens.length > 0)
  }, [campos])

  const nomeCampoPedido = (id: string | null) =>
    id ? camposPedido.find((c) => c.id === id)?.nome ?? '—' : '—'

  function abrirNovo() {
    setEditando(null)
    setForm({
      ...FORM_INICIAL,
      proprietario: filtroProp === 'TODOS' ? 'SOLICITACAO' : (filtroProp as ProprietarioCampoLivre),
    })
    setNovaOpcao('')
    setModalAberto(true)
  }

  function abrirEdicao(c: CampoLivre) {
    setEditando(c)
    setForm({
      nome: c.nome,
      proprietario: c.proprietario,
      tipo: c.tipo,
      obrigatorio: c.obrigatorio,
      ordem: c.ordem,
      status: c.status,
      copiaParaPedidoCampoId: c.copiaParaPedidoCampoId,
      opcoes: [...(c.opcoes ?? [])]
        .sort((a, b) => a.ordem - b.ordem)
        .map((o) => ({ valor: o.valor, padrao: o.padrao })),
    })
    setNovaOpcao('')
    setModalAberto(true)
  }

  // ── Editor de opções ──
  function adicionarOpcao() {
    const valor = novaOpcao.trim()
    if (!valor) return
    if (form.opcoes.some((o) => o.valor.toLowerCase() === valor.toLowerCase())) {
      notifications.show({ title: 'Atenção', message: 'Essa opção já existe', color: 'yellow' })
      return
    }
    setForm((f) => ({ ...f, opcoes: [...f.opcoes, { valor, padrao: false }] }))
    setNovaOpcao('')
  }

  function removerOpcao(i: number) {
    setForm((f) => ({ ...f, opcoes: f.opcoes.filter((_, idx) => idx !== i) }))
  }

  function moverOpcao(i: number, delta: -1 | 1) {
    setForm((f) => {
      const j = i + delta
      if (j < 0 || j >= f.opcoes.length) return f
      const copia = [...f.opcoes]
      ;[copia[i], copia[j]] = [copia[j], copia[i]]
      return { ...f, opcoes: copia }
    })
  }

  // Apenas uma opção pode ser a padrão.
  function marcarPadrao(i: number, marcado: boolean) {
    setForm((f) => ({
      ...f,
      opcoes: f.opcoes.map((o, idx) => ({ ...o, padrao: marcado && idx === i })),
    }))
  }

  async function salvar() {
    const nome = form.nome.trim()
    if (!nome) {
      notifications.show({ title: 'Atenção', message: 'Informe o nome do campo', color: 'red' })
      return
    }
    if (form.tipo === 'LISTA' && form.opcoes.length === 0) {
      notifications.show({ title: 'Atenção', message: 'Adicione ao menos uma opção à lista', color: 'red' })
      return
    }
    const payload: CampoLivreInput = {
      proprietario: form.proprietario,
      nome,
      tipo: form.tipo,
      obrigatorio: form.obrigatorio,
      ordem: form.ordem === '' ? 0 : form.ordem,
      status: form.status,
      copiaParaPedidoCampoId: form.proprietario === 'PEDIDO' ? null : form.copiaParaPedidoCampoId,
      opcoes:
        form.tipo === 'LISTA'
          ? form.opcoes.map((o, i) => ({ valor: o.valor, padrao: o.padrao, ordem: i }))
          : [],
    }
    setSalvando(true)
    try {
      if (editando) await camposLivresApi.atualizar(editando.id, payload)
      else await camposLivresApi.criar(payload)
      notifications.show({
        title: 'Salvo',
        message: `Campo ${editando ? 'atualizado' : 'criado'} com sucesso`,
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

  async function inativar(c: CampoLivre) {
    if (!confirm(`Deseja inativar "${c.nome}"?`)) return
    try {
      await camposLivresApi.inativar(c.id)
      notifications.show({ title: 'Inativado', message: `"${c.nome}" foi inativado`, color: 'yellow' })
      carregar()
    } catch (err) {
      notifications.show({ title: 'Erro', message: mensagemErroApi(err, 'Falha ao inativar'), color: 'red' })
    }
  }

  const opcoesCopiaPedido = camposPedido
    .filter((c) => !editando || c.id !== editando.id)
    .map((c) => ({ value: c.id, label: c.nome }))

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3}>Campos Livres</Title>
          <Text size="sm" c="dimmed">
            {campos.length} {campos.length === 1 ? 'campo' : 'campos'} na visão atual
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Campo</Button>
      </Group>

      <AvisoSemInfluencia>
        Estes campos ainda não alteram o cálculo do orçamento nem o PCP. Servem para registrar informações
        adicionais em solicitações, pedidos, recusas e insumos.
      </AvisoSemInfluencia>

      <Group justify="space-between" align="flex-end">
        <SegmentedControl
          value={filtroProp}
          onChange={setFiltroProp}
          data={[{ value: 'TODOS', label: 'Todos' }, ...PROPRIETARIOS]}
        />
        <Select
          allowDeselect={false}
          data={SITUACOES}
          value={situacao}
          onChange={(v) => setSituacao((v as SituacaoFiltro) || 'ativo')}
          w={160}
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
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Ordem</Table.Th>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Obrigatório</Table.Th>
                <Table.Th>Copia para (Pedido)</Table.Th>
                <Table.Th>Situação</Table.Th>
                <Table.Th w={90}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {grupos.map((g) => (
                <Fragment key={g.value}>
                  <Table.Tr bg="var(--mantine-color-default-hover)">
                    <Table.Td colSpan={7}>
                      <Text fw={700} size="sm">{g.label}</Text>
                    </Table.Td>
                  </Table.Tr>
                  {g.itens.map((c) => (
                    <Table.Tr key={c.id}>
                      <Table.Td>{c.ordem}</Table.Td>
                      <Table.Td fw={500}>{c.nome}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={c.tipo === 'LISTA' ? 'violet' : 'blue'}>
                          {c.tipo === 'LISTA' ? `Lista (${c.opcoes?.length ?? 0})` : 'Texto'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{c.obrigatorio ? 'Sim' : 'Não'}</Table.Td>
                      <Table.Td c="dimmed">{nomeCampoPedido(c.copiaParaPedidoCampoId)}</Table.Td>
                      <Table.Td>
                        <Badge color={c.status ? 'green' : 'gray'}>{c.status ? 'Ativo' : 'Inativo'}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <ActionIcon variant="subtle" aria-label="Editar" onClick={() => abrirEdicao(c)}>
                            <IconEdit size={16} />
                          </ActionIcon>
                          {c.status && (
                            <ActionIcon variant="subtle" color="red" aria-label="Inativar" onClick={() => inativar(c)}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Fragment>
              ))}
              {grupos.length === 0 && !erro && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text ta="center" c="dimmed" py="md">Nenhum campo livre encontrado</Text>
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
        title={editando ? 'Editar Campo Livre' : 'Novo Campo Livre'}
        size="lg"
        centered
      >
        <Stack gap="md">
          <Group grow align="flex-start">
            <TextInput
              label="Nome"
              required
              maxLength={120}
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })}
            />
            <Select
              label="Proprietário"
              required
              allowDeselect={false}
              disabled={!!editando}
              data={PROPRIETARIOS}
              value={form.proprietario}
              onChange={(v) =>
                setForm({
                  ...form,
                  proprietario: (v as ProprietarioCampoLivre) || 'SOLICITACAO',
                  copiaParaPedidoCampoId: null,
                })
              }
            />
          </Group>

          <Group grow align="flex-start">
            <Select
              label="Tipo"
              required
              allowDeselect={false}
              data={TIPOS}
              value={form.tipo}
              onChange={(v) => setForm({ ...form, tipo: (v as TipoCampoLivre) || 'TEXTO' })}
            />
            <NumberInput
              label="Ordem"
              min={0}
              allowDecimal={false}
              value={form.ordem}
              onChange={(v) => setForm({ ...form, ordem: v === '' ? '' : Number(v) })}
            />
          </Group>

          <Group>
            <Switch
              label="Obrigatório"
              checked={form.obrigatorio}
              onChange={(e) => setForm({ ...form, obrigatorio: e.currentTarget.checked })}
            />
            <Switch
              label="Ativo"
              checked={form.status}
              onChange={(e) => setForm({ ...form, status: e.currentTarget.checked })}
            />
          </Group>

          {form.proprietario !== 'PEDIDO' && (
            <Select
              label="Copiar para o campo do pedido"
              description="O valor deste campo é copiado para o campo escolhido do Pedido"
              placeholder="Não copiar"
              clearable
              searchable
              nothingFoundMessage="Nenhum campo de pedido ativo"
              data={opcoesCopiaPedido}
              value={form.copiaParaPedidoCampoId}
              onChange={(v) => setForm({ ...form, copiaParaPedidoCampoId: v })}
            />
          )}

          {form.tipo === 'LISTA' && (
            <Paper withBorder p="sm" radius="md">
              <Stack gap="xs">
                <Text fw={500} size="sm">Opções da lista</Text>
                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <TextInput
                    style={{ flex: 1 }}
                    placeholder="Nova opção"
                    maxLength={120}
                    value={novaOpcao}
                    onChange={(e) => setNovaOpcao(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        adicionarOpcao()
                      }
                    }}
                  />
                  <Button variant="light" leftSection={<IconPlus size={14} />} onClick={adicionarOpcao}>
                    Adicionar
                  </Button>
                </Group>

                {form.opcoes.length === 0 ? (
                  <Text size="sm" c="dimmed">Nenhuma opção adicionada</Text>
                ) : (
                  form.opcoes.map((o, i) => (
                    <Group key={`${o.valor}-${i}`} gap="xs" wrap="nowrap" justify="space-between">
                      <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                        <Tooltip label="Opção padrão">
                          <Checkbox
                            aria-label={`Padrão: ${o.valor}`}
                            checked={o.padrao}
                            onChange={(e) => marcarPadrao(i, e.currentTarget.checked)}
                          />
                        </Tooltip>
                        <Text size="sm" truncate>{o.valor}</Text>
                        {o.padrao && <Badge size="xs" variant="light">Padrão</Badge>}
                      </Group>
                      <Group gap={2} wrap="nowrap">
                        <ActionIcon variant="subtle" aria-label="Subir" disabled={i === 0} onClick={() => moverOpcao(i, -1)}>
                          <IconArrowUp size={14} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          aria-label="Descer"
                          disabled={i === form.opcoes.length - 1}
                          onClick={() => moverOpcao(i, 1)}
                        >
                          <IconArrowDown size={14} />
                        </ActionIcon>
                        <ActionIcon variant="subtle" color="red" aria-label="Remover" onClick={() => removerOpcao(i)}>
                          <IconX size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  ))
                )}
              </Stack>
            </Paper>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} loading={salvando}>
              {editando ? 'Salvar Alterações' : 'Criar Campo'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
