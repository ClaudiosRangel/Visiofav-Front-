'use client'

import { useEffect, useState } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Progress, Stack,
  SimpleGrid, LoadingOverlay, TextInput, Box,
} from '@mantine/core'
import {
  IconArrowLeft, IconPrinter, IconSearch, IconTruck,
  IconCheck, IconClock,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter, useSearchParams } from 'next/navigation'

const statusColors: Record<string, string> = {
  Pendente: 'orange',
  'Em Andamento': 'blue',
  Carregado: 'green',
  Concluído: 'green',
}

export default function MonitorCarregamentoPage() {
  useModuloGuard('WMS')
  const router = useRouter()
  const searchParams = useSearchParams()
  const carregamentoIdParam = searchParams.get('carregamentoId')

  const [carregamentoIdInput, setCarregamentoIdInput] = useState('')
  const [carregamentoId, setCarregamentoId] = useState(carregamentoIdParam || '')

  useEffect(() => {
    document.title = 'VisioFab - Monitor Carregamento'
  }, [])

  useEffect(() => {
    if (carregamentoIdParam) setCarregamentoId(carregamentoIdParam)
  }, [carregamentoIdParam])

  const { data, isLoading } = useQuery<any>({
    queryKey: ['monitor-carregamento', carregamentoId],
    queryFn: async () => {
      const { data } = await api.get(`/carregamentos/${carregamentoId}/monitor`)
      return data
    },
    enabled: !!carregamentoId,
    refetchInterval: 5000,
  })

  const printFicha = async (url: string) => {
    try {
      const { data } = await api.get(url, { responseType: 'text' })
      const win = window.open('', '_blank')
      if (win) { win.document.write(data); win.document.close() }
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao gerar ficha', color: 'red' })
    }
  }

  const handleSearch = () => {
    if (carregamentoIdInput.trim()) setCarregamentoId(carregamentoIdInput.trim())
  }

  if (!carregamentoId) {
    return (
      <Box p="md">
        <Stack gap="md">
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.back()}
          >
            Voltar
          </Button>
          <Text size="xl" fw={600}>Monitor de Carregamento</Text>
          <Text size="sm" c="dimmed">Informe o ID do carregamento para acompanhar.</Text>
          <Group>
            <TextInput
              placeholder="ID do Carregamento"
              value={carregamentoIdInput}
              onChange={(e) => setCarregamentoIdInput(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1, maxWidth: 300 }}
            />
            <Button leftSection={<IconSearch size={16} />} onClick={handleSearch}>
              Buscar
            </Button>
          </Group>
        </Stack>
      </Box>
    )
  }

  const percentual = data?.percentual ?? 0
  const totalVolumes = data?.totalVolumes ?? 0
  const carregados = data?.volumesCarregados ?? 0
  const pendentes = data?.volumesPendentes ?? 0
  const volumes = data?.volumes ?? []

  return (
    <Box p="md" pos="relative">
      <LoadingOverlay visible={isLoading && !data} />
      <Stack gap="md">
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => router.back()}
            >
              Voltar
            </Button>
            <Text size="xl" fw={600}>Monitor de Carregamento</Text>
          </Group>
          <Button
            leftSection={<IconPrinter size={16} />}
            variant="light"
            onClick={() => printFicha(`/carregamentos/${carregamentoId}/ficha-acompanhamento`)}
          >
            Imprimir Ficha de Acompanhamento
          </Button>
        </Group>

        <Card withBorder>
          <Text size="sm" fw={500} mb="xs">Progresso Geral</Text>
          <Group gap="xs" align="center">
            <Progress value={percentual} color={percentual === 100 ? 'green' : 'blue'} size="lg" style={{ flex: 1 }} />
            <Text size="sm" fw={600}>{percentual}%</Text>
          </Group>
        </Card>

        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Card withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Volumes</Text>
                <Text size="xl" fw={700}>{totalVolumes}</Text>
              </div>
              <IconTruck size={28} color="var(--mantine-color-blue-5)" />
            </Group>
          </Card>
          <Card withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Carregados</Text>
                <Text size="xl" fw={700} c="green">{carregados}</Text>
              </div>
              <IconCheck size={28} color="var(--mantine-color-green-5)" />
            </Group>
          </Card>
          <Card withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Pendentes</Text>
                <Text size="xl" fw={700} c="orange">{pendentes}</Text>
              </div>
              <IconClock size={28} color="var(--mantine-color-orange-5)" />
            </Group>
          </Card>
        </SimpleGrid>

        {volumes.length > 0 && (
          <Card withBorder>
            <Text size="sm" fw={500} mb="sm">Volumes do Carregamento</Text>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ textAlign: 'center' }}>Sequência</Table.Th>
                  <Table.Th>Volume</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Peso (kg)</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {volumes.map((vol: any, idx: number) => (
                  <Table.Tr key={idx}>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm">{vol.sequencia}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{vol.volumeCodigo}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{vol.tipo}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm">{vol.pesoKg}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Badge color={statusColors[vol.status] || 'gray'} variant="light">
                        {vol.status}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        )}
      </Stack>
    </Box>
  )
}
