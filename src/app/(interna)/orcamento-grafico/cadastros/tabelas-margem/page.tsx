'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  Modal, TextInput, NumberInput, ActionIcon, ScrollArea,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Tipos
// ============================================================================

interface TabelaMargem {
  id: string
  nome: string
  markup: number
  impostos: number
  comissao: number
  despAdm: number
  descontoMax: number
  status: boolean
}

interface FormData {
  nome: string
  markup: number
  impostos: number
  comissao: number
  despAdm: number
  descontoMax: number
}

const FORM_INICIAL: FormData = {
  nome: '',
  markup: 30,
  impostos: 15,
  comissao: 5,
  despAdm: 5,
  descontoMax: 10,
}

// ============================================================================
// Página Principal
// ============================================================================

export default function TabelasMargemPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Tabelas de Margem' }, [])

  const [data, setData] = useState<TabelaMargem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<TabelaMargem | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/orcamento-grafico/tabelas-margem')
      setData(res.data.data || res.data || [])
    } catch (err: any) {
      notifications.show({ title: 'Erro ao carregar', message: err?.response?.data?.message || 'Falha', color: 'red' })
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setModalAberto(true)
  }

  function abrirEdicao(item: TabelaMargem) {
    setEditando(item)
    setForm({
      nome: item.nome,
      markup: Number(item.markup),
      impostos: Number(item.impostos),
      comissao: Number(item.comissao),
      despAdm: Number(item.despAdm),
      descontoMax: Number(item.descontoMax),
    })
    setModalAberto(true)
  }

  async function salvar() {
    if (!form.nome.trim()) { notifications.show({ title: 'Erro', message: 'Nome obrigatório', color: 'red' }); return }

    setSalvando(true)
    try {
      const payload = {
        nome: form.nome.trim(),
        markup: form.markup,
        impostos: form.impostos,
        comissao: form.comissao,
        despAdm: form.despAdm,
        descontoMax: form.descontoMax,
      }

      if (editando) {
        await api.put(`/orcamento-grafico/tabelas-margem/${editando.id}`, payload)
      } else {
        await api.post('/orcamento-grafico/tabelas-margem', payload)
      }
      notifications.show({ title: 'Salvo', message: `Tabela ${editando ? 'atualizada' : 'criada'} com sucesso`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro ao salvar', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    } finally { setSalvando(false) }
  }

  async function excluir(item: TabelaMargem) {
    if (!confirm(`Deseja inativar a tabela "${item.nome}"?`)) return
    try {
      await api.delete(`/orcamento-grafico/tabelas-margem/${item.id}`)
      notifications.show({ title: 'Inativado', message: `"${item.nome}" foi inativada`, color: 'yellow' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao inativar', color: 'red' })
    }
  }

  function fmt(v: number) {
    return `${Number(v).toFixed(2)}%`
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Tabelas de Margem</Title>
          <Text size="sm" c="dimmed">
            Políticas comerciais — markup, impostos, comissão e limites de desconto
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Nova Tabela</Button>
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Markup %</Table.Th>
                <Table.Th>Impostos %</Table.Th>
                <Table.Th>Comissão %</Table.Th>
                <Table.Th>Desp. Adm %</Table.Th>
                <Table.Th>Desc. Máx %</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={600}>{item.nome}</Table.Td>
                  <Table.Td>{fmt(item.markup)}</Table.Td>
                  <Table.Td>{fmt(item.impostos)}</Table.Td>
                  <Table.Td>{fmt(item.comissao)}</Table.Td>
                  <Table.Td>{fmt(item.despAdm)}</Table.Td>
                  <Table.Td>{fmt(item.descontoMax)}</Table.Td>
                  <Table.Td>
                    <Badge color={item.status ? 'green' : 'red'}>
                      {item.status ? 'Ativa' : 'Inativa'}
                    </Badge>
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
                  <Table.Td colSpan={8}>
                    <Text ta="center" c="dimmed" py="md">Nenhuma tabela cadastrada</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {/* Modal de criação/edição */}
      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Tabela de Margem' : 'Nova Tabela de Margem'}
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })}
            required
            maxLength={100}
            placeholder="Ex: Padrão, Premium, Exportação"
          />
          <Group grow>
            <NumberInput
              label="Markup (%)"
              value={form.markup}
              onChange={(v) => setForm({ ...form, markup: typeof v === 'number' ? v : 0 })}
              min={0}
              max={200}
              decimalScale={2}
              suffix="%"
            />
            <NumberInput
              label="Impostos (%)"
              value={form.impostos}
              onChange={(v) => setForm({ ...form, impostos: typeof v === 'number' ? v : 0 })}
              min={0}
              max={100}
              decimalScale={2}
              suffix="%"
            />
          </Group>
          <Group grow>
            <NumberInput
              label="Comissão (%)"
              value={form.comissao}
              onChange={(v) => setForm({ ...form, comissao: typeof v === 'number' ? v : 0 })}
              min={0}
              max={100}
              decimalScale={2}
              suffix="%"
            />
            <NumberInput
              label="Desp. Administrativa (%)"
              value={form.despAdm}
              onChange={(v) => setForm({ ...form, despAdm: typeof v === 'number' ? v : 0 })}
              min={0}
              max={100}
              decimalScale={2}
              suffix="%"
            />
          </Group>
          <NumberInput
            label="Desconto Máximo (%)"
            value={form.descontoMax}
            onChange={(v) => setForm({ ...form, descontoMax: typeof v === 'number' ? v : 0 })}
            min={0}
            max={100}
            decimalScale={2}
            suffix="%"
          />
          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar Alterações' : 'Criar Tabela'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
