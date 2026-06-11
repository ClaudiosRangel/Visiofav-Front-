'use client'

import { useEffect, useState } from 'react'
import {
  Card, Group, Text, Table, Button, Modal, TextInput,
  Select, NumberInput, LoadingOverlay, ActionIcon,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'

interface Meta {
  id?: string
  tipoOperacao: string
  tempoMetaMinutos: number
  unidadeMedida: string
  tolerancia: number
  categoriaProduto: string
}

const EMPTY_META: Meta = {
  tipoOperacao: '',
  tempoMetaMinutos: 0,
  unidadeMedida: 'POR_ITEM',
  tolerancia: 15,
  categoriaProduto: '',
}

const TIPOS_OPERACAO = [
  { value: 'CONFERENCIA', label: 'Conferência' },
  { value: 'ENDERECAMENTO', label: 'Endereçamento' },
  { value: 'SEPARACAO', label: 'Separação' },
  { value: 'CARREGAMENTO', label: 'Carregamento' },
  { value: 'INVENTARIO', label: 'Inventário' },
]

const UNIDADES_MEDIDA = [
  { value: 'POR_ITEM', label: 'Por Item' },
  { value: 'POR_PALLET', label: 'Por Pallet' },
  { value: 'POR_LINHA', label: 'Por Linha' },
  { value: 'POR_VOLUME', label: 'Por Volume' },
  { value: 'PALLET', label: 'Pallet' },
  { value: 'LINHA', label: 'Linha' },
  { value: 'POSICAO', label: 'Posição' },
]

export default function LmsMetasPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - LMS - Metas' }, [])

  const queryClient = useQueryClient()
  const [opened, { open, close }] = useDisclosure(false)
  const [editingMeta, setEditingMeta] = useState<Meta>(EMPTY_META)

  const { data: metasResp, isLoading } = useQuery<any>({
    queryKey: ['lms-metas'],
    queryFn: async () => {
      const { data } = await api.get('/lms/metas')
      return data
    },
  })

  const metas: Meta[] = metasResp?.data || metasResp || []

  const salvarMutation = useMutation({
    mutationFn: async (meta: Meta) => {
      const payload = { ...meta, toleranciaPercentual: meta.tolerancia }
      if (meta.id) {
        await api.put(`/lms/metas/${meta.id}`, payload)
      } else {
        await api.post('/lms/metas', payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lms-metas'] })
      notifications.show({ title: 'Sucesso', message: 'Meta salva com sucesso', color: 'green' })
      close()
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Erro ao salvar meta', color: 'red' })
    },
  })

  const excluirMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/lms/metas/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lms-metas'] })
      notifications.show({ title: 'Sucesso', message: 'Meta excluída', color: 'green' })
    },
  })

  function handleNew() {
    setEditingMeta(EMPTY_META)
    open()
  }

  function handleEdit(meta: Meta) {
    setEditingMeta({ ...meta, tolerancia: (meta as any).toleranciaPercentual ?? meta.tolerancia ?? 15 })
    open()
  }

  function handleSave() {
    salvarMutation.mutate(editingMeta)
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / LMS / Metas</Text>

      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Metas de Produtividade</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>
          Nova Meta
        </Button>
      </Group>

      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tipo Operação</Table.Th>
              <Table.Th>Tempo Meta (min)</Table.Th>
              <Table.Th>Unidade Medida</Table.Th>
              <Table.Th>Tolerância (%)</Table.Th>
              <Table.Th>Categoria Produto</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {metas.map((meta) => (
              <Table.Tr key={meta.id}>
                <Table.Td>{meta.tipoOperacao}</Table.Td>
                <Table.Td>{meta.tempoMetaMinutos}</Table.Td>
                <Table.Td>{meta.unidadeMedida}</Table.Td>
                <Table.Td>{(meta as any).toleranciaPercentual ?? meta.tolerancia}%</Table.Td>
                <Table.Td>{meta.categoriaProduto || '—'}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon variant="subtle" onClick={() => handleEdit(meta)}>
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => meta.id && excluirMutation.mutate(meta.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {metas.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed" ta="center" py="sm">Nenhuma meta cadastrada</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={opened} onClose={close} title={editingMeta.id ? 'Editar Meta' : 'Nova Meta'} size="md">
        <Select
          label="Tipo de Operação"
          data={TIPOS_OPERACAO}
          value={editingMeta.tipoOperacao}
          onChange={(v) => setEditingMeta({ ...editingMeta, tipoOperacao: v || '' })}
          mb="sm"
        />
        <NumberInput
          label="Tempo Meta (minutos)"
          value={editingMeta.tempoMetaMinutos}
          onChange={(v) => setEditingMeta({ ...editingMeta, tempoMetaMinutos: Number(v) || 0 })}
          min={0}
          mb="sm"
        />
        <Select
          label="Unidade de Medida"
          data={UNIDADES_MEDIDA}
          value={editingMeta.unidadeMedida}
          onChange={(v) => setEditingMeta({ ...editingMeta, unidadeMedida: v || 'UNIDADE' })}
          mb="sm"
        />
        <NumberInput
          label="Tolerância (%)"
          value={editingMeta.tolerancia}
          onChange={(v) => setEditingMeta({ ...editingMeta, tolerancia: Number(v) || 0 })}
          min={0}
          max={100}
          mb="sm"
        />
        <TextInput
          label="Categoria de Produto"
          placeholder="Opcional"
          value={editingMeta.categoriaProduto}
          onChange={(e) => setEditingMeta({ ...editingMeta, categoriaProduto: e.currentTarget.value })}
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>Cancelar</Button>
          <Button onClick={handleSave} loading={salvarMutation.isPending}>Salvar</Button>
        </Group>
      </Modal>
    </div>
  )
}
