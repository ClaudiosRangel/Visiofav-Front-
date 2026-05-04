'use client'

import { useEffect, useState, Suspense } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Progress, Stack,
  SimpleGrid, LoadingOverlay, TextInput, Box,
} from '@mantine/core'
import {
  IconArrowLeft, IconPrinter, IconSearch, IconPackage,
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
  Concluído: 'green',
}

export default function MonitorSeparacaoPage() {
  return <Suspense fallback={<Box p="md"><Text>Carregando...</Text></Box>}><MonitorSeparacaoContent /></Suspense>
}

function MonitorSeparacaoContent() {
  useModuloGuard('WMS')
  const router = useRouter()
  const searchParams = useSearchParams()
  const ondaIdParam = searchParams.get('ondaId')

  const [ondaIdInput, setOndaIdInput] = useState('')
  const [ondaId, setOndaId] = useState(ondaIdParam || '')

  useEffect(() => {
    document.title = 'VisioFab - Monitor Separação'
  }, [])

  useEffect(() => {
    if (ondaIdParam) setOndaId(ondaIdParam)
  }, [ondaIdParam])

  const { data, isLoading } = useQuery<any>({
    queryKey: ['monitor-separacao', ondaId],
    queryFn: async () => {
      const { data } = await api.get(`/ondas-separacao/${ondaId}/monitor/separacao`)
      return data
    },
    enabled: !!ondaId,
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
    if (ondaIdInput.trim()) setOndaId(ondaIdInput.trim())
  }

  if (!ondaId) {
    return (
      <Box p="md">
        <Stack gap="md">
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.push('/picking')}
          >
            Voltar
          </Button>
          <Text size="xl" fw={600}>Monitor de Separação</Text>
          <Text size="sm" c="dimmed">Informe o ID da onda para acompanhar a separação.</Text>
          <Group>
            <TextInput
              placeholder="ID da Onda"
              value={ondaIdInput}
              onChange={(e) => setOndaIdInput(e.currentTarget.value)}
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
  const total = data?.total ?? 0
  const concluidos = data?.concluidos ?? 0
  const pendentes = data?.pendentes ?? 0
  const itens = data?.itens ?? []

  return (
    <Box p="md" pos="relative">
      <LoadingOverlay visible={isLoading && !data} />
      <Stack gap="md">
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => router.push('/picking')}
            >
              Voltar
            </Button>
            <Text size="xl" fw={600}>Monitor de Separação</Text>
          </Group>
          <Button
            leftSection={<IconPrinter size={16} />}
            variant="light"
            onClick={() => printFicha(`/ondas-separacao/${ondaId}/ficha-acompanhamento/separacao`)}
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
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total</Text>
                <Text size="xl" fw={700}>{total}</Text>
              </div>
              <IconPackage size={28} color="var(--mantine-color-blue-5)" />
            </Group>
          </Card>
          <Card withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Concluídos</Text>
                <Text size="xl" fw={700} c="green">{concluidos}</Text>
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

        {itens.length > 0 && (
          <Card withBorder>
            <Text size="sm" fw={500} mb="sm">Itens da Separação</Text>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Produto</Table.Th>
                  <Table.Th>Endereço</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Qtd Solicitada</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Qtd Separada</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {itens.map((item: any, idx: number) => (
                  <Table.Tr key={idx}>
                    <Table.Td>
                      <Text size="sm">{item.produtoNome}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{item.enderecoOrigem}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm">{item.quantidadeSolicitada}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm">{item.quantidadeSeparada}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Badge color={statusColors[item.status] || 'gray'} variant="light">
                        {item.status}
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
