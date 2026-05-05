'use client'

import { Progress, Text, Stack, Group, Loader } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface CapacityUtilization {
  pesoUtilizacao: number
  volumeUtilizacao: number
  pesoDisponivel: number
  volumeDisponivel: number
  pesoAtual: number
  volumeAtual: number
  pesoLimite: number
  volumeLimite: number
}

interface Props {
  enderecoId: string
}

function getColor(percentage: number): string {
  if (percentage > 90) return 'red'
  if (percentage >= 70) return 'yellow'
  return 'green'
}

export function IndicadorCapacidade({ enderecoId }: Props) {
  const { data, isLoading, error } = useQuery<CapacityUtilization>({
    queryKey: ['endereco-capacidade', enderecoId],
    queryFn: async () => {
      const { data } = await api.get(`/enderecos/${enderecoId}/capacidade`)
      return data
    },
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  })

  if (isLoading) {
    return (
      <Group justify="center" py="md">
        <Loader size="sm" />
      </Group>
    )
  }

  if (error || !data) {
    return (
      <Text size="sm" c="dimmed">
        Não foi possível carregar dados de capacidade.
      </Text>
    )
  }

  const pesoPercent = Math.min(data.pesoUtilizacao, 100)
  const volumePercent = Math.min(data.volumeUtilizacao, 100)

  // If no limits are defined, show a message
  if (data.pesoLimite === 0 && data.volumeLimite === 0) {
    return (
      <Text size="sm" c="dimmed">
        Sem limites de capacidade definidos para este endereço.
      </Text>
    )
  }

  return (
    <Stack gap="md">
      {data.pesoLimite > 0 && (
        <div>
          <Group justify="space-between" mb={4}>
            <Text size="sm" fw={500}>
              Peso: {data.pesoAtual.toFixed(1)} kg / {data.pesoLimite.toFixed(1)} kg
            </Text>
            <Text size="xs" c="dimmed">
              {pesoPercent.toFixed(1)}%
            </Text>
          </Group>
          <Progress
            value={pesoPercent}
            color={getColor(pesoPercent)}
            size="lg"
            radius="sm"
          />
          <Text size="xs" c="dimmed" mt={4}>
            Disponível: {data.pesoDisponivel.toFixed(1)} kg
          </Text>
        </div>
      )}

      {data.volumeLimite > 0 && (
        <div>
          <Group justify="space-between" mb={4}>
            <Text size="sm" fw={500}>
              Volume: {data.volumeAtual.toFixed(3)} m³ / {data.volumeLimite.toFixed(3)} m³
            </Text>
            <Text size="xs" c="dimmed">
              {volumePercent.toFixed(1)}%
            </Text>
          </Group>
          <Progress
            value={volumePercent}
            color={getColor(volumePercent)}
            size="lg"
            radius="sm"
          />
          <Text size="xs" c="dimmed" mt={4}>
            Disponível: {data.volumeDisponivel.toFixed(3)} m³
          </Text>
        </div>
      )}
    </Stack>
  )
}
