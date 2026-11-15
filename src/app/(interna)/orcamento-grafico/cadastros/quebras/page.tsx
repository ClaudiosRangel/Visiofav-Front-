'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Text, Loader, Center, Modal, NumberInput,
  ActionIcon, ScrollArea, SimpleGrid, Alert, Select, TextInput, Switch, Badge, Divider,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { AvisoSemInfluencia } from '../_shared/AvisoSemInfluencia'
import { quebrasApi, mensagemErroApi } from '../_shared/cadastros-graficos.api'
import type {
  QuebraGrafica, TipoAtividadeQuebra, SituacaoFiltro,
} from '../_shared/cadastros-graficos.types'

// ============================================================================
// Quebras: perda (%) por faixa de tiragem, por tipo de atividade.
// Exclusão lógica (inativa). Cadastro informativo por enquanto.
// ============================================================================

const TIPOS = [
  { value: 'IMPRESSAO', label: 'Impressão' },
  { value: 'ACABAMENTO', label: 'Acabamento' },
]
const SITUACOES = [
  { value: 'ativo', label: 'Ativos' },
  { value: 'inativo', label: 'Inativos' },
  { value: 'todos', label: 'Todos' },
]
const tipoLabel = (v: string) => TIPOS.find((t) => t.value === v)?.label ?? v

interface LimiteForm { tiragemAte: number | ''; quebraPerc: number | '' }

interface FormData {
  nome: string
  tipoAtividade: TipoAtividadeQuebra
  pedacosPorAcerto: number | ''
  pedacosPorPlano: number | ''
  pedacosPorTipoPlano: number | ''
  pedacosOcorrencias: number | ''
  pedacosMinimoPerc: number | ''
  interpolar: boolean
  limites: LimiteForm[]
}

const FORM_INICIAL: FormData = {
  nome: '', tipoAtividade: 'IMPRESSAO',
  pedacosPorAcerto: '', pedacosPorPlano: '', pedacosPorTipoPlano: '',
  pedacosOcorrencias: '', pedacosMinimoPerc: '',
  interpolar: false, limites: [{ tiragemAte: '', quebraPerc: '' }],
}

const num = (v: number | string | null | undefined): number | '' =>
  v == null || v === '' ? '' : Number(v)
const opt = (v: number | ''): number | null => (v === '' ? null : Number(v))

export default function QuebrasPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Quebras' }, [])

  const [itens, setItens] = useState<QuebraGrafica[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState<string | null>(null)
  const [situacao, setSituacao] = useState<SituacaoFiltro>('ativo')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<QuebraGrafica | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await quebrasApi.listar({
        tipoAtividade: (tipo as TipoAtividadeQuebra) || undefined,
        busca: busca.trim() || undefined,
        status: situacao,
      })
      setItens(res)
    } catch (err) {
      setErro(mensagemErroApi(err, 'Falha ao buscar quebras'))
    } finally {
      setLoading(false)
    }
  }, [tipo, busca, situacao])

  useEffect(() => {
    const t = setTimeout(carregar, 250)
    return () => clearTimeout(t)
  }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setForm({ ...FORM_INICIAL, limites: [{ tiragemAte: '', quebraPerc: '' }] })
    setModalAberto(true)
  }

  function abrirEdicao(q: QuebraGrafica) {
    setEditando(q)
    setForm({
      nome: q.nome,
      tipoAtividade: q.tipoAtividade,
      pedacosPorAcerto: num(q.pedacosPorAcerto),
      pedacosPorPlano: num(q.pedacosPorPlano),
      pedacosPorTipoPlano: num(q.pedacosPorTipoPlano),
      pedacosOcorrencias: num(q.pedacosOcorrencias),
      pedacosMinimoPerc: num(q.pedacosMinimoPerc),
      interpolar: q.interpolar,
      limites: q.limites.length
        ? [...q.limites]
            .sort((a, b) => a.tiragemAte - b.tiragemAte)
            .map((l) => ({ tiragemAte: l.tiragemAte, quebraPerc: Number(l.quebraPerc) }))
        : [{ tiragemAte: '', quebraPerc: '' }],
    })
    setModalAberto(true)
  }

  function alterarLimite(i: number, campo: keyof LimiteForm, v: number | '') {
    setForm((f) => ({
      ...f,
      limites: f.limites.map((l, idx) => (idx === i ? { ...l, [campo]: v } : l)),
    }))
  }

  function removerLimite(i: number) {
    setForm((f) => ({ ...f, limites: f.limites.filter((_, idx) => idx !== i) }))
  }

  async function salvar() {
    if (!form.nome.trim()) {
      notifications.show({ title: 'Erro', message: 'Informe o nome', color: 'red' })
      return
    }
    const preenchidos = form.limites.filter((l) => l.tiragemAte !== '' || l.quebraPerc !== '')
    if (preenchidos.some((l) => l.tiragemAte === '' || l.quebraPerc === '')) {
      notifications.show({ title: 'Erro', message: 'Preencha tiragem e % de quebra em todos os limites', color: 'red' })
      return
    }
    const tiragens = preenchidos.map((l) => Number(l.tiragemAte))
    if (new Set(tiragens).size !== tiragens.length) {
      notifications.show({ title: 'Erro', message: 'Há limites com a mesma tiragem', color: 'red' })
      return
    }
    setSalvando(true)
    try {
      const payload = {
        nome: form.nome.trim(),
        tipoAtividade: form.tipoAtividade,
        pedacosPorAcerto: opt(form.pedacosPorAcerto),
        pedacosPorPlano: opt(form.pedacosPorPlano),
        pedacosPorTipoPlano: opt(form.pedacosPorTipoPlano),
        pedacosOcorrencias: opt(form.pedacosOcorrencias),
        pedacosMinimoPerc: opt(form.pedacosMinimoPerc),
        interpolar: form.interpolar,
        limites: preenchidos
          .map((l) => ({ tiragemAte: Number(l.tiragemAte), quebraPerc: Number(l.quebraPerc) }))
          .sort((a, b) => a.tiragemAte - b.tiragemAte),
      }
      if (editando) await quebrasApi.atualizar(editando.id, payload)
      else await quebrasApi.criar(payload)
      notifications.show({ title: 'Salvo', message: `Quebra ${editando ? 'atualizada' : 'criada'} com sucesso`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err) {
      notifications.show({ title: 'Erro ao salvar', message: mensagemErroApi(err, 'Falha ao salvar'), color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  async function inativar(q: QuebraGrafica) {
    if (!confirm(`Inativar a quebra "${q.nome}"?`)) return
    try {
      await quebrasApi.inativar(q.id)
      notifications.show({ title: 'Inativada', message: 'Quebra inativada', color: 'yellow' })
      carregar()
    } catch (err) {
      notifications.show({ title: 'Erro ao inativar', message: mensagemErroApi(err, 'Falha ao inativar'), color: 'red' })
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Quebras</Title>
          <Text size="sm" c="dimmed">
            {itens.length} {itens.length === 1 ? 'quebra' : 'quebras'} listadas.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Nova Quebra</Button>
      </Group>

      <AvisoSemInfluencia />

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <TextInput label="Buscar" placeholder="Nome da quebra" value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)} />
        <Select label="Tipo de atividade" placeholder="Todos" data={TIPOS} value={tipo}
          onChange={setTipo} clearable />
        <Select label="Situação" data={SITUACOES} value={situacao} allowDeselect={false}
          onChange={(v) => setSituacao((v as SituacaoFiltro) || 'ativo')} />
      </SimpleGrid>

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
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Limites</Table.Th>
                <Table.Th>Interpolar</Table.Th>
                <Table.Th>Situação</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itens.map((q) => (
                <Table.Tr key={q.id}>
                  <Table.Td fw={500}>{q.nome}</Table.Td>
                  <Table.Td>{tipoLabel(q.tipoAtividade)}</Table.Td>
                  <Table.Td>{q.limites.length}</Table.Td>
                  <Table.Td>{q.interpolar ? 'Sim' : 'Não'}</Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={q.status ? 'green' : 'gray'}>
                      {q.status ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <ActionIcon variant="subtle" onClick={() => abrirEdicao(q)} aria-label="Editar">
                        <IconEdit size={16} />
                      </ActionIcon>
                      {q.status && (
                        <ActionIcon variant="subtle" color="red" onClick={() => inativar(q)} aria-label="Inativar">
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
                    <Text ta="center" c="dimmed" py="md">Nenhuma quebra encontrada.</Text>
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
        title={editando ? 'Editar Quebra' : 'Nova Quebra'}
        centered
        size="lg"
      >
        <Stack gap="md">
          <TextInput label="Nome" value={form.nome} required maxLength={200}
            onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })} />
          <Select label="Tipo de atividade" data={TIPOS} value={form.tipoAtividade} allowDeselect={false}
            onChange={(v) => setForm({ ...form, tipoAtividade: (v as TipoAtividadeQuebra) || 'IMPRESSAO' })} />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <NumberInput label="Pedaços por acerto" value={form.pedacosPorAcerto} min={0} decimalScale={2}
              onChange={(v) => setForm({ ...form, pedacosPorAcerto: typeof v === 'number' ? v : '' })} />
            <NumberInput label="Pedaços por plano" value={form.pedacosPorPlano} min={0} decimalScale={2}
              onChange={(v) => setForm({ ...form, pedacosPorPlano: typeof v === 'number' ? v : '' })} />
            <NumberInput label="Pedaços por tipo de plano" value={form.pedacosPorTipoPlano} min={0} decimalScale={2}
              onChange={(v) => setForm({ ...form, pedacosPorTipoPlano: typeof v === 'number' ? v : '' })} />
            <NumberInput label="Pedaços por ocorrência" value={form.pedacosOcorrencias} min={0} decimalScale={2}
              onChange={(v) => setForm({ ...form, pedacosOcorrencias: typeof v === 'number' ? v : '' })} />
            <NumberInput label="Pedaços mínimo (%)" value={form.pedacosMinimoPerc} min={0} decimalScale={2}
              onChange={(v) => setForm({ ...form, pedacosMinimoPerc: typeof v === 'number' ? v : '' })} />
          </SimpleGrid>
          <Switch label="Interpolar entre faixas" checked={form.interpolar}
            onChange={(e) => setForm({ ...form, interpolar: e.currentTarget.checked })} />

          <Divider label="Limites por tiragem" labelPosition="left" />
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tiragem até</Table.Th>
                <Table.Th>% de quebra</Table.Th>
                <Table.Th w={40}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {form.limites.map((l, i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <NumberInput value={l.tiragemAte} min={0} allowDecimal={false} aria-label="Tiragem até"
                      onChange={(v) => alterarLimite(i, 'tiragemAte', typeof v === 'number' ? v : '')} />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput value={l.quebraPerc} min={0} max={100} decimalScale={2} aria-label="Percentual de quebra"
                      onChange={(v) => alterarLimite(i, 'quebraPerc', typeof v === 'number' ? v : '')} />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="red" onClick={() => removerLimite(i)} aria-label="Remover limite">
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
              {form.limites.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={3}>
                    <Text ta="center" c="dimmed" size="sm">Nenhum limite. Adicione uma faixa.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
          <Group>
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}
              onClick={() => setForm({ ...form, limites: [...form.limites, { tiragemAte: '', quebraPerc: '' }] })}>
              Adicionar limite
            </Button>
          </Group>

          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar Alterações' : 'Criar Quebra'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
