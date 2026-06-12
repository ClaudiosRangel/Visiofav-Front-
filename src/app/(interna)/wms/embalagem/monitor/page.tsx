'use client'

import { useEffect, useState } from 'react'
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
import { useRouter } from 'next/navigation'

export default function MonitorEmbalagemPage() {
  useModuloGuard('WMS')
  const router = useRouter()

  const [ondaIdInput, setOndaIdInput] = useState('')
  const [ondaId, setOndaId] = useState('')

  useEffect(() => {
    document.title = 'Vizor - Monitor Embalagem'
    const params = new URLSearchParams(window.location.search)
    const id = params.get('ondaId')
    if (id) setOndaId(id)
  }, [])

  const { data, isLoading } = useQuery<any>({
    queryKey: ['monitor-embalagem', ondaId],
    queryFn: async () => {
      const { data } = await api.get(`/ondas-separacao/${ondaId}/monitor/embalagem`)
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
            onClick={() => router.push('/expedicao')}
          >
            Voltar
          </Button>
          <Text size="xl" fw={600}>Monitor de Embalagem</Text>
          <Text size="sm" c="dimmed">Informe o ID da onda para acompanhar a embalagem.</Text>
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
  const totalSeparados = data?.totalItensSeparados ?? 0
  const embalados = data?.itensEmbalados ?? 0
  const pendentes = data?.itensPendentes ?? 0
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
              onClick={() => router.push('/expedicao')}
            >
              Voltar
            </Button>
            <Text size="xl" fw={600}>Monitor de Embalagem</Text>
          </Group>
          <Button
            leftSection={<IconPrinter size={16} />}
            variant="light"
            onClick={() => printFicha(`/ondas-separacao/${ondaId}/ficha-acompanhamento/embalagem`)}
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
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Separados</Text>
                <Text size="xl" fw={700}>{totalSeparados}</Text>
              </div>
              <IconPackage size={28} color="var(--mantine-color-blue-5)" />
            </Group>
          </Card>
          <Card withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Embalados</Text>
                <Text size="xl" fw={700} c="green">{embalados}</Text>
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
            <Text size="sm" fw={500} mb="sm">Volumes</Text>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Código</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Total Itens</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>% Concluído</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {volumes.map((vol: any, idx: number) => (
                  <Table.Tr key={idx}>
                    <Table.Td>
                      <Text size="sm" fw={500}>{vol.codigo}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{vol.tipo}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm">{vol.totalItens}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Group gap="xs" justify="center">
                        <Progress
                          value={vol.percentualConcluido ?? 0}
                          color={vol.percentualConcluido === 100 ? 'green' : 'blue'}
                          size="sm"
                          style={{ width: 80 }}
                        />
                        <Text size="xs" fw={500}>{vol.percentualConcluido ?? 0}%</Text>
                      </Group>
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
