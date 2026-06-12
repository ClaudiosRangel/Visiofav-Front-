'use client'

import { useEffect, useState } from 'react'
import {
  Card, Group, Text, Table, Button, Modal, Select,
  NumberInput, TextInput, LoadingOverlay, ActionIcon, Badge,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconGift } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'

const FAIXA_COLORS: Record<string, string> = {
  EXCELENTE: 'green',
  BOM: 'blue',
  REGULAR: 'yellow',
  ABAIXO: 'orange',
  CRITICO: 'red',
}

const FAIXAS = [
  { value: 'EXCELENTE', label: 'Excelente' },
  { value: 'BOM', label: 'Bom' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'ABAIXO', label: 'Abaixo' },
  { value: 'CRITICO', label: 'Crítico' },
]

interface Incentivo {
  id?: string
  faixa: string
  pontosIncentivo: number
  descricao: string
}

const EMPTY_INCENTIVO: Incentivo = {
  faixa: 'EXCELENTE',
  pontosIncentivo: 0,
  descricao: '',
}

export default function LmsIncentivosPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - LMS - Incentivos' }, [])

  const queryClient = useQueryClient()
  const [opened, { open, close }] = useDisclosure(false)
  const [editing, setEditing] = useState<Incentivo>(EMPTY_INCENTIVO)

  const { data: incentivosResp, isLoading } = useQuery<any>({
    queryKey: ['lms-incentivos'],
    queryFn: async () => {
      const { data } = await api.get('/lms/incentivos')
      return data
    },
  })

  const incentivos: Incentivo[] = incentivosResp?.data || incentivosResp || []

  const salvarMutation = useMutation({
    mutationFn: async (incentivo: Incentivo) => {
      if (incentivo.id) {
        await api.put(`/lms/incentivos/${incentivo.id}`, incentivo)
      } else {
        await api.post('/lms/incentivos', incentivo)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lms-incentivos'] })
      notifications.show({ title: 'Sucesso', message: 'Incentivo salvo com sucesso', color: 'green' })
      close()
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Erro ao salvar incentivo', color: 'red' })
    },
  })

  const excluirMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/lms/incentivos/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lms-incentivos'] })
      notifications.show({ title: 'Sucesso', message: 'Incentivo excluído', color: 'green' })
    },
  })

  function handleNew() {
    setEditing(EMPTY_INCENTIVO)
    open()
  }

  function handleEdit(incentivo: Incentivo) {
    setEditing({ ...incentivo })
    open()
  }

  function handleSave() {
    salvarMutation.mutate(editing)
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / LMS / Incentivos</Text>

      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <IconGift size={24} />
          <Text size="xl" fw={600}>Incentivos por Faixa</Text>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>
          Novo Incentivo
        </Button>
      </Group>

      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Faixa</Table.Th>
              <Table.Th>Pontos de Incentivo</Table.Th>
              <Table.Th>Descrição</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {incentivos.map((inc) => (
              <Table.Tr key={inc.id}>
                <Table.Td>
                  <Badge color={FAIXA_COLORS[inc.faixa] || 'gray'} variant="filled">
                    {inc.faixa}
                  </Badge>
                </Table.Td>
                <Table.Td fw={600}>{inc.pontosIncentivo}</Table.Td>
                <Table.Td>{inc.descricao || '—'}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon variant="subtle" onClick={() => handleEdit(inc)}>
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => inc.id && excluirMutation.mutate(inc.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {incentivos.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text size="sm" c="dimmed" ta="center" py="sm">Nenhum incentivo cadastrado</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={opened} onClose={close} title={editing.id ? 'Editar Incentivo' : 'Novo Incentivo'} size="md">
        <Select
          label="Faixa"
          data={FAIXAS}
          value={editing.faixa}
          onChange={(v) => setEditing({ ...editing, faixa: v || 'EXCELENTE' })}
          mb="sm"
        />
        <NumberInput
          label="Pontos de Incentivo"
          value={editing.pontosIncentivo}
          onChange={(v) => setEditing({ ...editing, pontosIncentivo: Number(v) || 0 })}
          min={0}
          mb="sm"
        />
        <TextInput
          label="Descrição"
          placeholder="Descreva o incentivo"
          value={editing.descricao}
          onChange={(e) => setEditing({ ...editing, descricao: e.currentTarget.value })}
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
