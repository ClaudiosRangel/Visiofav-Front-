'use client'

import { Text, Skeleton } from '@mantine/core'
import { useDistanciaCliente } from '@/data/hooks/useGeo'

interface DistanciaClienteInfoProps {
  clienteId: string
  clienteTemCoordenadas: boolean
  empresaTemCoordenadas: boolean
}

export function DistanciaClienteInfo({
  clienteId,
  clienteTemCoordenadas,
  empresaTemCoordenadas,
}: DistanciaClienteInfoProps) {
  const enabled = clienteTemCoordenadas && empresaTemCoordenadas
  const { data, isLoading } = useDistanciaCliente(enabled ? clienteId : null)

  if (!clienteTemCoordenadas) {
    return (
      <Text size="sm" c="dimmed">
        Distância: não disponível (cliente sem geolocalização)
      </Text>
    )
  }

  if (!empresaTemCoordenadas) {
    return (
      <Text size="sm" c="dimmed">
        Distância: não disponível (empresa sem geolocalização)
      </Text>
    )
  }

  if (isLoading) {
    return <Skeleton height={20} width={120} />
  }

  if (!data) {
    return (
      <Text size="sm" c="dimmed">
        Distância: não disponível
      </Text>
    )
  }

  return (
    <Text size="sm" fw={500}>
      Distância: {data.distanciaKm.toFixed(2)} km
    </Text>
  )
}
