'use client'

import { Button, Alert } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconMapPin, IconAlertTriangle } from '@tabler/icons-react'
import { useGeocodificarEmpresa } from '@/data/hooks/useGeo'

interface GeocodificarEmpresaButtonProps {
  temEndereco: boolean
  temCoordenadas: boolean
}

export function GeocodificarEmpresaButton({
  temEndereco,
  temCoordenadas,
}: GeocodificarEmpresaButtonProps) {
  const { mutate, isPending } = useGeocodificarEmpresa()

  function handleClick() {
    mutate(undefined, {
      onSuccess: () => {
        notifications.show({
          title: 'Sucesso',
          message: 'Coordenadas da empresa atualizadas com sucesso',
          color: 'green',
        })
      },
    })
  }

  return (
    <>
      <Button
        leftSection={<IconMapPin size={16} />}
        disabled={!temEndereco || isPending}
        loading={isPending}
        onClick={handleClick}
      >
        Geocodificar Endereço
      </Button>

      {!temCoordenadas && (
        <Alert color="yellow" icon={<IconAlertTriangle size={16} />} mt="sm">
          A geocodificação do endereço da empresa é necessária para otimização de rotas.
        </Alert>
      )}
    </>
  )
}
