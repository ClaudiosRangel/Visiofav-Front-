'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select, Stack,
  LoadingOverlay, ColorSwatch,
} from '@mantine/core'
import { IconPlus, IconTrash, IconUser } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { notifications } from '@mantine/notifications'

interface Separador {
  id: string
  usuarioId: string
  usuarioNome: string
  zonaId: string
  zonaNome: string
  zonaCor: string
  tipo: 'PRINCIPAL' | 'SECUNDARIA'
}

const TIPO_OPTIONS = [
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'SECUNDARIA', label: 'Secundária' },
]

const TIPO_COLORS: Record<string, string> = {
  PRINCIPAL: 'blue',
  SECUNDARIA: 'gray',
}

export default function SeparadoresPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Separadores por Zona' }, [])

  const queryClient = useQueryClient()
  const [zonaId, setZonaId] = useState<string | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [tipo, setTipo] = useState<string | null>('PRINCIPAL')

  const { data: separadores = [], isLoading } = useQuery<Separador[]>({
    queryKey: ['picking-zona', 'separadores'],
    queryFn: async () => {
      const { data } = await api.get('/picking-zona/separadores')
      return data
    },
  })

  const { data: zonasOptions = [] } = useQuery<{ value: string; label: string }[]>({
    queryKey: ['picking-zona', 'zonas-options'],
    queryFn: async () => {
      const { data } = await api.get('/picking-zona/zonas')
      return data.map((z: any) => ({ value: z.id, label: z.nome }))
    },
  })

  const { data: usuariosOptions = [] } = useQuery<{ value: string; label: string }[]>({
    queryKey: ['picking-zona', 'usuarios-options'],
    queryFn: async () => {
      const { data } = await api.get('/usuarios', { params: { ativo: true } })
      return data.map((u: any) => ({ value: u.id, label: u.nome }))
    },
  })

  const assignMutation = useMutation({
    mutationFn: async (payload: { zonaId: string; usuarioId: string; tipo: string }) => {
      await api.post('/picking-zona/separadores', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['picking-zona', 'separadores'] })
      notifications.show({ title: 'Sucesso', message: 'Separador atribuído à zona', color: 'green' })
      setZonaId(null)
      setUsuarioId(null)
      setTipo('PRINCIPAL')
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Falha ao atribuir separador', color: 'red' })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/picking-zona/separadores/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['picking-zona', 'separadores'] })
      notifications.show({ title: 'Sucesso', message: 'Separador removido da zona', color: 'green' })
    },
  })

  function handleAssign() {
    if (!zonaId || !usuarioId || !tipo) return
    assignMutation.mutate({ zonaId, usuarioId, tipo })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Separação / Picking por Zona / Separadores</Text>
      <Text size="xl" fw={600} mb="lg">Separadores por Zona</Text>

      {/* Assignment Form */}
      <Card mb="md" withBorder>
        <Text fw={500} mb="sm">Atribuir Separador</Text>
        <Group align="end" gap="md">
          <Select
            label="Zona"
            placeholder="Selecione a zona"
            data={zonasOptions}
            value={zonaId}
            onChange={setZonaId}
            className="w-48"
          />
          <Select
            label="Usuário"
            placeholder="Selecione o separador"
            data={usuariosOptions}
            value={usuarioId}
            onChange={setUsuarioId}
            searchable
            className="w-64"
          />
          <Select
            label="Tipo"
            data={TIPO_OPTIONS}
            value={tipo}
            onChange={setTipo}
            className="w-40"
          />
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleAssign}
            loading={assignMutation.isPending}
            disabled={!zonaId || !usuarioId || !tipo}
          >
            Atribuir
          </Button>
        </Group>
      </Card>

      {/* Table */}
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Separador</Table.Th>
              <Table.Th>Zona</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {separadores.map((sep) => (
              <Table.Tr key={sep.id}>
                <Table.Td>
                  <Group gap="xs">
                    <IconUser size={14} />
                    <Text size="sm">{sep.usuarioNome}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ColorSwatch color={sep.zonaCor} size={14} />
                    <Text size="sm">{sep.zonaNome}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={TIPO_COLORS[sep.tipo]}>
                    {sep.tipo === 'PRINCIPAL' ? 'Principal' : 'Secundária'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Button
                    variant="subtle"
                    size="xs"
                    color="red"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => removeMutation.mutate(sep.id)}
                  >
                    Remover
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
            {separadores.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={4} className="text-center py-8 text-zinc-500">
                  Nenhum separador atribuído
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
