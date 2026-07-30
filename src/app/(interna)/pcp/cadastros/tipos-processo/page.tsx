'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Table, Group, Button, Badge, Text, Loader, Center, Modal, TextInput, ActionIcon } from '@mantine/core'
import { IconPlus, IconEdit, IconPower, IconGripVertical } from '@tabler/icons-react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

/**
 * Cadastro de Tipo de Processo (Cortadeira, Impressão, Acabamento, etc.) —
 * substitui o antigo enum fixo `tipoMaquina` do Centro de Produção. Cada
 * Centro de Produção deve obrigatoriamente pertencer a um Tipo de Processo
 * cadastrado aqui. A ORDEM desta lista (arrastar para reordenar) define a
 * ordem das abas exibidas no painel de Programação — só tipos ATIVOS geram
 * aba lá.
 */

function LinhaArrastavel({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <Table.Tr ref={setNodeRef} style={style} {...attributes}>
      <Table.Td style={{ width: 30, cursor: 'grab' }} {...listeners}>
        <IconGripVertical size={16} color="gray" />
      </Table.Td>
      {children}
    </Table.Tr>
  )
}

export default function TiposProcessoPage() {
  useEffect(() => { document.title = 'PCP - Tipo de Processo' }, [])

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({ codigo: '', descricao: '' })

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/tipos-processo')
      setData(res.data.data || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  function abrirNovo() { setEditando(null); setForm({ codigo: '', descricao: '' }); setModalAberto(true) }
  function abrirEdicao(item: any) { setEditando(item); setForm({ codigo: item.codigo, descricao: item.descricao }); setModalAberto(true) }

  async function salvar() {
    try {
      if (editando) { await api.put(`/tipos-processo/${editando.id}`, form) }
      else { await api.post('/tipos-processo', form) }
      notifications.show({ title: 'Salvo', message: '', color: 'green' })
      setModalAberto(false); carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function toggleStatus(item: any) {
    try {
      await api.patch(`/tipos-processo/${item.id}/${item.status ? 'inativar' : 'ativar'}`)
      carregar()
    } catch {}
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = data.findIndex((t) => t.id === active.id)
    const newIndex = data.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const novaOrdem = arrayMove(data, oldIndex, newIndex)
    setData(novaOrdem) // Otimista

    try {
      await api.patch('/tipos-processo/ordenar', {
        itens: novaOrdem.map((t, index) => ({ id: t.id, posicao: index })),
      })
    } catch (err: any) {
      notifications.show({ title: 'Erro ao reordenar', message: err?.response?.data?.message || 'Falha ao salvar a nova ordem', color: 'red' })
      carregar() // Rollback
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Tipo de Processo</Title>
          <Text size="sm" c="dimmed">
            Classificação obrigatória de cada Centro de Produção. A ordem aqui define a ordem das abas no painel de Programação — arraste para reordenar.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Tipo</Button>
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={data.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 30 }}></Table.Th>
                  <Table.Th>Código</Table.Th>
                  <Table.Th>Descrição</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.map((item) => (
                  <LinhaArrastavel key={item.id} id={item.id}>
                    <Table.Td fw={600}>{item.codigo}</Table.Td>
                    <Table.Td>{item.descricao}</Table.Td>
                    <Table.Td><Badge color={item.status ? 'green' : 'red'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <ActionIcon variant="subtle" onClick={() => abrirEdicao(item)}><IconEdit size={16} /></ActionIcon>
                        <ActionIcon variant="subtle" color={item.status ? 'red' : 'green'} onClick={() => toggleStatus(item)}><IconPower size={16} /></ActionIcon>
                      </Group>
                    </Table.Td>
                  </LinhaArrastavel>
                ))}
                {data.length === 0 && (
                  <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="md">Nenhum tipo de processo cadastrado</Text></Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </SortableContext>
        </DndContext>
      )}

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar Tipo de Processo' : 'Novo Tipo de Processo'} centered>
        <Stack gap="md">
          <TextInput label="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value.toUpperCase() })} required maxLength={20} />
          <TextInput label="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })} required maxLength={200} />
          <Button onClick={salvar} fullWidth>{editando ? 'Salvar' : 'Criar'}</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
