'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, TextInput, Modal,
  LoadingOverlay, ColorSwatch, Select, Stack,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconMapPin } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'

interface Zona {
  id: string
  nome: string
  codigo: string
  cor: string
  enderecosCount: number
  separadoresCount: number
  pontoConsolidacaoId?: string
}

export default function PickingZonaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Picking por Zona' }, [])

  const queryClient = useQueryClient()
  const [opened, { open, close }] = useDisclosure(false)
  const [editingZona, setEditingZona] = useState<Zona | null>(null)

  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [cor, setCor] = useState('#228be6')
  const [pontoConsolidacaoId, setPontoConsolidacaoId] = useState<string | null>(null)

  const { data: zonas = [], isLoading } = useQuery<Zona[]>({
    queryKey: ['picking-zona', 'zonas'],
    queryFn: async () => {
      const { data } = await api.get('/picking-zona/zonas')
      const items = data?.data || data || []
      return items.map((z: any) => ({
        ...z,
        enderecosCount: z._count?.enderecos ?? z.enderecosCount ?? 0,
        separadoresCount: z._count?.separadores ?? z.separadoresCount ?? 0,
      }))
    },
  })

  const { data: pontosOptions = [] } = useQuery<{ value: string; label: string }[]>({
    queryKey: ['picking-zona', 'pontos-options'],
    queryFn: async () => {
      const { data } = await api.get('/picking-zona/pontos-consolidacao')
      const items = Array.isArray(data) ? data : (data?.data || [])
      return items.map((p: any) => ({ value: p.id, label: p.nome }))
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingZona) {
        await api.put(`/picking-zona/zonas/${editingZona.id}`, payload)
      } else {
        await api.post('/picking-zona/zonas', payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['picking-zona', 'zonas'] })
      notifications.show({ title: 'Sucesso', message: editingZona ? 'Zona atualizada' : 'Zona criada', color: 'green' })
      handleClose()
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Falha ao salvar zona', color: 'red' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/picking-zona/zonas/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['picking-zona', 'zonas'] })
      notifications.show({ title: 'Sucesso', message: 'Zona removida', color: 'green' })
    },
  })

  function handleOpen(zona?: Zona) {
    if (zona) {
      setEditingZona(zona)
      setNome(zona.nome)
      setCodigo(zona.codigo)
      setCor(zona.cor)
      setPontoConsolidacaoId(zona.pontoConsolidacaoId || null)
    } else {
      setEditingZona(null)
      setNome('')
      setCodigo('')
      setCor('#228be6')
      setPontoConsolidacaoId(null)
    }
    open()
  }

  function handleClose() {
    setEditingZona(null)
    setNome('')
    setCodigo('')
    setCor('#228be6')
    setPontoConsolidacaoId(null)
    close()
  }

  function handleSubmit() {
    if (!nome || !codigo) return
    createMutation.mutate({ nome, codigo, cor, pontoConsolidacaoId })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Separação / Picking por Zona</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Zonas de Picking</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => handleOpen()}>
          Nova Zona
        </Button>
      </Group>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Cor</Table.Th>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Código</Table.Th>
              <Table.Th>Endereços</Table.Th>
              <Table.Th>Separadores</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {zonas.map((zona) => (
              <Table.Tr key={zona.id}>
                <Table.Td>
                  <ColorSwatch color={zona.cor} size={20} />
                </Table.Td>
                <Table.Td>
                  <Badge color={zona.cor} variant="light">{zona.nome}</Badge>
                </Table.Td>
                <Table.Td className="font-mono">{zona.codigo}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <IconMapPin size={14} />
                    <Text size="sm">{zona.enderecosCount}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>{zona.separadoresCount}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button variant="subtle" size="xs" onClick={() => handleOpen(zona)}>
                      <IconEdit size={14} />
                    </Button>
                    <Button variant="subtle" size="xs" color="red" onClick={() => deleteMutation.mutate(zona.id)}>
                      <IconTrash size={14} />
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {zonas.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-8 text-zinc-500">
                  Nenhuma zona cadastrada
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Nova/Editar Zona */}
      <Modal opened={opened} onClose={handleClose} title={editingZona ? 'Editar Zona' : 'Nova Zona'}>
        <Stack>
          <TextInput
            label="Nome"
            placeholder="Ex: Zona A - Mercearia"
            value={nome}
            onChange={(e) => setNome(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Código"
            placeholder="Ex: ZA"
            value={codigo}
            onChange={(e) => setCodigo(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Cor (hex)"
            placeholder="#228be6"
            value={cor}
            onChange={(e) => setCor(e.currentTarget.value)}
          />
          <Select
            label="Ponto de Consolidação"
            placeholder="Selecione (opcional)"
            data={pontosOptions}
            value={pontoConsolidacaoId}
            onChange={setPontoConsolidacaoId}
            clearable
          />
          <Button onClick={handleSubmit} loading={createMutation.isPending} fullWidth>
            {editingZona ? 'Salvar Alterações' : 'Criar Zona'}
          </Button>
        </Stack>
      </Modal>
    </div>
  )
}
