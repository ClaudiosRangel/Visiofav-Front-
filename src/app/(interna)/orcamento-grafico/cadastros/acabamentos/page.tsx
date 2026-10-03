'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  Modal, TextInput, Select, NumberInput, ActionIcon, ScrollArea, Divider, SimpleGrid, Pagination,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

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
  status: boolean
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
    })
    setModalAberto(true)
  }

  async function salvar() {
    if (!form.codigo.trim()) { notifications.show({ title: 'Erro', message: 'Código obrigatório', color: 'red' }); return }
    if (!form.nome.trim()) { notifications.show({ title: 'Erro', message: 'Nome obrigatório', color: 'red' }); return }

    const numOrNull = (v: number | '') => (v === '' ? null : Number(v))
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
                  <Table.Td>{item.nome}</Table.Td>
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
                    <Text ta="center" c="dimmed" py="md">Nenhum acabamento encontrado. Importe do Calcgraf ou crie manualmente.</Text>
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

          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar Alterações' : 'Criar Acabamento'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
