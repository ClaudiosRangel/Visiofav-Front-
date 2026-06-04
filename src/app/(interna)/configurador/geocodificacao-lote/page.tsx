'use client'

import { useState } from 'react'
import {
  Card,
  Button,
  Table,
  Text,
  Badge,
  Progress,
  SegmentedControl,
  Stack,
  Group,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconMapPin, IconRefresh } from '@tabler/icons-react'
import { useResumoGeoClientes, useGeocodificarBatch } from '@/data/hooks/useGeo'
import { BatchGeoResult } from '@/data/types/geo'

export default function GeocodificacaoBatchPage() {
  const [batchResult, setBatchResult] = useState<BatchGeoResult | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const { data: resumo, isLoading: resumoLoading } = useResumoGeoClientes()
  const batch = useGeocodificarBatch()

  function handleGeocodificarTodos() {
    setBatchResult(null)
    batch.mutate([], {
      onSuccess: (result) => {
        setBatchResult(result)
        notifications.show({
          title: 'Concluído',
          message: 'Geocodificação em lote concluída',
          color: 'green',
        })
      },
    })
  }

  function handleReexecutarFalhas() {
    if (!batchResult?.detalheFalhas.length) return
    const falhaIds = batchResult.detalheFalhas.map((f) => f.clienteId)
    batch.mutate(falhaIds, {
      onSuccess: (result) => {
        setBatchResult(result)
        notifications.show({
          title: 'Concluído',
          message: 'Geocodificação em lote concluída',
          color: 'green',
        })
      },
    })
  }

  const filteredFalhas = batchResult?.detalheFalhas || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>
        Início / Configurador / Geocodificação em Lote
      </Text>
      <Title order={3} mb="lg">
        Geocodificação em Lote
      </Title>

      <Stack gap="md">
        {/* Summary Card */}
        <Card withBorder>
          <Text fw={600} mb="sm">
            Resumo da Base de Clientes
          </Text>
          <Group gap="xl">
            <div>
              <Text size="sm" c="dimmed">
                Total
              </Text>
              <Text fw={700} size="xl">
                {resumoLoading ? '...' : resumo?.total ?? 0}
              </Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">
                Geocodificados
              </Text>
              <Text fw={700} size="xl" c="green">
                {resumoLoading ? '...' : resumo?.geocodificados ?? 0}
              </Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">
                Não geocodificados
              </Text>
              <Text fw={700} size="xl" c="red">
                {resumoLoading ? '...' : resumo?.naoGeocodificados ?? 0}
              </Text>
            </div>
          </Group>
        </Card>

        {/* Action Buttons */}
        <Group>
          <Button
            leftSection={<IconMapPin size={16} />}
            onClick={handleGeocodificarTodos}
            loading={batch.isPending}
            disabled={batch.isPending}
          >
            Geocodificar Todos
          </Button>
        </Group>

        {/* Loading State */}
        {batch.isPending && (
          <Card withBorder>
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Processando geocodificação...
              </Text>
              <Progress value={100} animated />
            </Stack>
          </Card>
        )}

        {/* Result Display */}
        {batchResult && !batch.isPending && (
          <Stack gap="md">
            <Card withBorder>
              <Text fw={600} mb="sm">
                Resultado
              </Text>
              <Group gap="xl">
                <div>
                  <Text size="sm" c="dimmed">
                    Processados
                  </Text>
                  <Text fw={700} size="lg">
                    {batchResult.totalProcessados}
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">
                    Sucessos
                  </Text>
                  <Badge color="green" size="lg" variant="filled">
                    {batchResult.sucessos}
                  </Badge>
                </div>
                <div>
                  <Text size="sm" c="dimmed">
                    Falhas
                  </Text>
                  <Badge color="red" size="lg" variant="filled">
                    {batchResult.falhas}
                  </Badge>
                </div>
              </Group>
            </Card>

            {/* Failed Clients Table */}
            {batchResult.detalheFalhas.length > 0 && (
              <Card withBorder>
                <Group justify="space-between" mb="md">
                  <Text fw={600}>Clientes com Falha</Text>
                  <Button
                    variant="light"
                    color="orange"
                    size="sm"
                    leftSection={<IconRefresh size={16} />}
                    onClick={handleReexecutarFalhas}
                    loading={batch.isPending}
                    disabled={batch.isPending}
                  >
                    Reexecutar Falhas
                  </Button>
                </Group>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Razão Social</Table.Th>
                      <Table.Th>Motivo</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredFalhas.map((falha) => (
                      <Table.Tr key={falha.clienteId}>
                        <Table.Td>{falha.razaoSocial}</Table.Td>
                        <Table.Td>
                          <Text size="sm" c="red">
                            {falha.motivo}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            )}
          </Stack>
        )}

        {/* Filter by geocoding status */}
        <Card withBorder>
          <Text fw={600} mb="sm">
            Filtrar Clientes
          </Text>
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            data={[
              { label: 'Todos', value: 'all' },
              { label: 'Geocodificados', value: 'geocodificados' },
              { label: 'Não geocodificados', value: 'nao-geocodificados' },
            ]}
          />
        </Card>
      </Stack>
    </div>
  )
}
