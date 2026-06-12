'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Button, Select, Table, Badge, Stack,
  LoadingOverlay, ColorSwatch, Alert,
} from '@mantine/core'
import { IconCut, IconScale, IconInfoCircle } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { notifications } from '@mantine/notifications'

interface SubOnda {
  id: string
  zonaId: string
  zonaNome: string
  zonaCor: string
  totalItens: number
  totalProdutos: number
}

export default function DividirOndaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Dividir Onda por Zona' }, [])

  const queryClient = useQueryClient()
  const [ondaId, setOndaId] = useState<string | null>(null)
  const [subOndas, setSubOndas] = useState<SubOnda[]>([])

  const { data: ondasOptions = [] } = useQuery<{ value: string; label: string }[]>({
    queryKey: ['picking-zona', 'ondas-options'],
    queryFn: async () => {
      const { data } = await api.get('/ondas', { params: { status: 'PENDENTE' } })
      return data.map((o: any) => ({ value: o.id, label: `${o.codigo} - ${o.descricao || 'Sem descrição'}` }))
    },
  })

  const dividirMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/picking-zona/ondas/${id}/dividir`)
      return data
    },
    onSuccess: (data) => {
      setSubOndas(data.subOndas || data)
      notifications.show({ title: 'Sucesso', message: 'Onda dividida por zona', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['picking-zona'] })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Falha ao dividir onda', color: 'red' })
    },
  })

  const balancearMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/picking-zona/ondas/${id}/balancear`)
      return data
    },
    onSuccess: (data) => {
      setSubOndas(data.subOndas || data)
      notifications.show({ title: 'Sucesso', message: 'Onda balanceada entre zonas', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['picking-zona'] })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Falha ao balancear onda', color: 'red' })
    },
  })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Separação / Picking por Zona / Dividir Onda</Text>
      <Text size="xl" fw={600} mb="lg">Dividir Onda por Zona</Text>

      {/* Select Onda */}
      <Card mb="md" withBorder>
        <Stack gap="md">
          <Select
            label="Onda de Separação"
            placeholder="Selecione a onda para dividir"
            data={ondasOptions}
            value={ondaId}
            onChange={(val) => { setOndaId(val); setSubOndas([]) }}
            searchable
            size="md"
          />
          <Group gap="md">
            <Button
              leftSection={<IconCut size={16} />}
              onClick={() => ondaId && dividirMutation.mutate(ondaId)}
              loading={dividirMutation.isPending}
              disabled={!ondaId}
            >
              Dividir por Zona
            </Button>
            <Button
              leftSection={<IconScale size={16} />}
              variant="light"
              onClick={() => ondaId && balancearMutation.mutate(ondaId)}
              loading={balancearMutation.isPending}
              disabled={!ondaId}
            >
              Balancear
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* Alert info */}
      {!ondaId && (
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" mb="md">
          Selecione uma onda pendente para visualizar a divisão por zona. O balanceamento
          redistribui itens entre zonas para equilibrar a carga de trabalho.
        </Alert>
      )}

      {/* Preview Sub-Ondas */}
      {subOndas.length > 0 && (
        <Card pos="relative">
          <LoadingOverlay visible={dividirMutation.isPending || balancearMutation.isPending} />
          <Text fw={500} mb="sm">Sub-ondas por Zona</Text>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Zona</Table.Th>
                <Table.Th>Total de Itens</Table.Th>
                <Table.Th>Produtos Distintos</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {subOndas.map((sub) => (
                <Table.Tr key={sub.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <ColorSwatch color={sub.zonaCor} size={14} />
                      <Badge color={sub.zonaCor} variant="light">{sub.zonaNome}</Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>{sub.totalItens}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{sub.totalProdutos}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Group justify="flex-end" mt="md">
            <Text size="sm" c="dimmed">
              Total: {subOndas.reduce((acc, s) => acc + s.totalItens, 0)} itens em {subOndas.length} zonas
            </Text>
          </Group>
        </Card>
      )}
    </div>
  )
}
