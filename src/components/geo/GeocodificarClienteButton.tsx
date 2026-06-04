'use client'

import { Button } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconMapPin } from '@tabler/icons-react'
import { useGeocodificarCliente } from '@/data/hooks/useGeo'

interface GeocodificarClienteButtonProps {
  clienteId: string
  temEndereco: boolean
  temCoordenadas: boolean
}

export function GeocodificarClienteButton({
  clienteId,
  temEndereco,
  temCoordenadas,
}: GeocodificarClienteButtonProps) {
  const { mutate, isPending } = useGeocodificarCliente()

  function handleClick() {
    mutate(clienteId, {
      onSuccess: () => {
        notifications.show({
          title: 'Sucesso',
          message: 'Coordenadas atualizadas com sucesso',
          color: 'green',
        })
      },
    })
  }

  return (
    <Button
      leftSection={<IconMapPin size={16} />}
      disabled={!temEndereco || isPending}
      loading={isPending}
      onClick={handleClick}
    >
      Geocodificar
    </Button>
  )
}
