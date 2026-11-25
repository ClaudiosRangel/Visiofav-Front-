'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  Modal, TextInput, Switch, ActionIcon, ScrollArea, Select, NumberInput, Divider,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import { carregarTintas } from '../../[id]/itens/[itemId]/_item/tintas-cadastro'
import type { TintaCadastro, TintasPadrao } from '../../[id]/itens/[itemId]/_item/tintas-item'
import { linhasParaTintasPadrao, resumoTintasPadrao, tintasPadraoParaLinhas, type LinhaTintaPadrao } from './tintas-padrao'

// ============================================================================
// Coberturas de Tinta — código, nome, ativo e composição padrão das tintas
// (tinta de 1 cor + sequência para várias cores), usada pela janela Tintas do orçamento.
// Endpoint base: /orcamento-grafico/coberturas-tinta
// ============================================================================

interface CoberturaTinta {
  id: string
  codigo: string
  nome: string
  ativo: boolean
  tintasPadrao?: TintasPadrao | null
}

interface FormData {
  codigo: string
  nome: string
  ativo: boolean
  umaCor: LinhaTintaPadrao
  cores: LinhaTintaPadrao[]
}

const FORM_INICIAL: FormData = {
  codigo: '',
  nome: '',
  ativo: true,
  umaCor: { tinta: '', perc: '' },
  cores: [],
}

export default function CoberturasTintaPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Coberturas de Tinta' }, [])

  const [data, setData] = useState<CoberturaTinta[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<CoberturaTinta | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [tintas, setTintas] = useState<TintaCadastro[]>([])

  useEffect(() => {
    if (!modalAberto) return
    carregarTintas().then(setTintas).catch(() => setTintas([]))
  }, [modalAberto])

  const opcoesTinta = Array.from(
    new Set([...tintas.map((t) => t.nome), form.umaCor.tinta, ...form.cores.map((l) => l.tinta)].filter(Boolean)),
  )

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/orcamento-grafico/coberturas-tinta', {
        params: {
          situacao: mostrarInativos ? 'todas' : 'ativa',
          busca: busca || undefined,
        },
      })
      setData(res.data.data || res.data || [])
    } catch (err: any) {
      notifications.show({ title: 'Erro ao carregar', message: err?.response?.data?.message || 'Falha ao buscar coberturas de tinta', color: 'red' })
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [busca, mostrarInativos]) // eslint-disable-line react-hooks/exhaustive-deps

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setModalAberto(true)
  }

  function abrirEdicao(item: CoberturaTinta) {
    setEditando(item)
    setForm({ codigo: item.codigo, nome: item.nome, ativo: item.ativo, ...tintasPadraoParaLinhas(item.tintasPadrao) })
    setModalAberto(true)
  }

  const mudarCor = (i: number, parcial: Partial<LinhaTintaPadrao>) =>
    setForm((f) => ({ ...f, cores: f.cores.map((x, j) => (j === i ? { ...x, ...parcial } : x)) }))

  async function salvar() {
    if (!form.codigo.trim()) { notifications.show({ title: 'Erro', message: 'Código obrigatório', color: 'red' }); return }
    if (!form.nome.trim()) { notifications.show({ title: 'Erro', message: 'Nome obrigatório', color: 'red' }); return }
    const composicao = linhasParaTintasPadrao(form.umaCor, form.cores)
    if (!composicao.ok) { notifications.show({ title: 'Erro', message: composicao.erro, color: 'red' }); return }

    setSalvando(true)
    try {
      const payload = {
        codigo: form.codigo.trim(),
        nome: form.nome.trim(),
        ativo: form.ativo,
        tintasPadrao: composicao.valor,
      }
      if (editando) {
        await api.put(`/orcamento-grafico/coberturas-tinta/${editando.id}`, payload)
      } else {
        await api.post('/orcamento-grafico/coberturas-tinta', payload)
      }
      notifications.show({ title: 'Salvo', message: `Cobertura de tinta ${editando ? 'atualizada' : 'criada'} com sucesso`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro ao salvar', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    } finally { setSalvando(false) }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Coberturas de Tinta</Title>
          <Text size="sm" c="dimmed">Cadastro de coberturas de tinta do orçamento gráfico</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo</Button>
      </Group>

      <Group justify="space-between">
        <TextInput
          placeholder="Buscar por código ou nome..."
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Switch
          label="Mostrar inativos"
          checked={mostrarInativos}
          onChange={(e) => setMostrarInativos(e.currentTarget.checked)}
        />
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Tintas padrão</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500}>{item.codigo}</Table.Td>
                  <Table.Td>{item.nome}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{resumoTintasPadrao(item.tintasPadrao)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={item.ativo ? 'green' : 'red'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" aria-label={`Editar ${item.nome}`} onClick={() => abrirEdicao(item)}>
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed" py="md">Nenhuma cobertura de tinta encontrada</Text>
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
        title={editando ? 'Editar Cobertura de Tinta' : 'Nova Cobertura de Tinta'}
        centered
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Código"
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })}
            required
            maxLength={30}
            placeholder="Ex: CT-001"
          />
          <TextInput
            label="Nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })}
            required
            maxLength={200}
            placeholder="Ex: Escala"
          />
          <Switch
            label="Ativo"
            checked={form.ativo}
            onChange={(e) => setForm({ ...form, ativo: e.currentTarget.checked })}
          />

          <Divider label="Tintas padrão" labelPosition="left" />
          <Text size="xs" c="dimmed">
            Preenchem a janela Tintas do orçamento ao escolher esta cobertura: 1 cor usa a tinta de uma cor; N cores, as N
            primeiras da sequência (a última se repete quando faltar).
          </Text>
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <Select
              label="Tinta para 1 cor"
              placeholder="Nenhuma"
              data={opcoesTinta}
              value={form.umaCor.tinta || null}
              onChange={(v) => setForm({ ...form, umaCor: { ...form.umaCor, tinta: v ?? '' } })}
              searchable
              clearable
              comboboxProps={{ withinPortal: true }}
              style={{ flex: 1 }}
            />
            <NumberInput
              label="%"
              aria-label="Percentual da tinta para 1 cor"
              w={100}
              hideControls
              min={0}
              max={100}
              decimalScale={2}
              decimalSeparator=","
              value={form.umaCor.perc}
              onChange={(v) => setForm({ ...form, umaCor: { ...form.umaCor, perc: v === '' ? '' : Number(v) } })}
            />
          </Group>

          <Stack gap={6}>
            <Text size="sm" fw={500}>Sequência para várias cores</Text>
            {form.cores.map((l, i) => (
              <Group key={i} gap="xs" align="center" wrap="nowrap">
                <Text size="xs" c="dimmed" w={28}>{i + 1}ª</Text>
                <Select
                  aria-label={`Tinta da ${i + 1}ª cor`}
                  placeholder="Tinta"
                  data={opcoesTinta}
                  value={l.tinta || null}
                  onChange={(v) => mudarCor(i, { tinta: v ?? '' })}
                  searchable
                  comboboxProps={{ withinPortal: true }}
                  style={{ flex: 1 }}
                />
                <NumberInput
                  aria-label={`Percentual da ${i + 1}ª cor`}
                  w={100}
                  hideControls
                  min={0}
                  max={100}
                  decimalScale={2}
                  decimalSeparator=","
                  value={l.perc}
                  onChange={(v) => mudarCor(i, { perc: v === '' ? '' : Number(v) })}
                />
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={`Remover a ${i + 1}ª cor`}
                  onClick={() => setForm({ ...form, cores: form.cores.filter((_, j) => j !== i) })}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            ))}
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              disabled={form.cores.length >= 12}
              onClick={() =>
                setForm({
                  ...form,
                  cores: [...form.cores, { tinta: form.cores.at(-1)?.tinta ?? '', perc: form.cores.at(-1)?.perc ?? 10 }],
                })
              }
              style={{ alignSelf: 'flex-start' }}
            >
              Adicionar cor
            </Button>
          </Stack>

          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar Alterações' : 'Criar'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
