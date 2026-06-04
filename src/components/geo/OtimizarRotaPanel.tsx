'use client'

import { useState } from 'react'
import { Button, Table, Badge, Card, Text, LoadingOverlay, Stack, Group } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconRoute, IconDeviceFloppy } from '@tabler/icons-react'
import { useOtimizarRota, useSalvarSequencia } from '@/data/hooks/useGeo'
import { OtimizacaoResult, SequenciaEntrega } from '@/data/types/geo'

interface OtimizarRotaPanelProps {
  mapaId: string
  status: string
  nfs: Array<{ nfeId: string }>
}

const STATUS_PERMITIDOS = ['AGUARDANDO_SEPARACAO', 'EM_CARREGAMENTO']

export function OtimizarRotaPanel({ mapaId, status, nfs }: OtimizarRotaPanelProps) {
  const [resultado, setResultado] = useState<OtimizacaoResult | null>(null)

  const otimizar = useOtimizarRota()
  const salvar = useSalvarSequencia()

  const podeOtimizar = STATUS_PERMITIDOS.includes(status)

  function handleOtimizar() {
    otimizar.mutate(mapaId, {
      onSuccess: (data: any) => {
        // Map API response to component format
        // API returns: { sequencia: [{ordem, clienteId, razaoSocial, endereco, distanciaParcialKm}], clientesSemGeolocalizacao: [...], distanciaTotalKm }
        const sequenciaGeo = (data.sequencia || []).map((item: any) => ({
          ...item,
          clienteRazaoSocial: item.razaoSocial || item.clienteRazaoSocial || '',
          temGeolocalizacao: true,
          nfeId: item.nfeId || item.clienteId || '',
        }))
        const semGeo = (data.clientesSemGeolocalizacao || []).map((item: any, idx: number) => ({
          ...item,
          ordem: sequenciaGeo.length + idx + 1,
          clienteRazaoSocial: item.razaoSocial || item.clienteRazaoSocial || '',
          temGeolocalizacao: false,
          nfeId: item.nfeId || item.clienteId || `sem-geo-${idx}`,
          distanciaParcialKm: null,
        }))
        setResultado({
          sequencia: [...sequenciaGeo, ...semGeo],
          distanciaTotalKm: data.distanciaTotalKm,
        })
      },
    })
  }

  function handleSalvar() {
    if (!resultado) return

    const sequencia = resultado.sequencia.map((item) => ({
      nfeId: item.nfeId,
      ordem: item.ordem,
    }))

    salvar.mutate(
      { mapaId, sequencia },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Sucesso',
            message: 'Sequência salva com sucesso',
            color: 'green',
          })
        },
      }
    )
  }

  if (!podeOtimizar) {
    return null
  }

  return (
    <Stack pos="relative" gap="md">
      <LoadingOverlay visible={otimizar.isPending || salvar.isPending} />

      <Group>
        <Button
          leftSection={<IconRoute size={16} />}
          onClick={handleOtimizar}
          disabled={otimizar.isPending}
          loading={otimizar.isPending}
        >
          Otimizar Rota
        </Button>
      </Group>

      {resultado && (
        <>
          <Card withBorder padding="sm">
            <Group gap="xs">
              <Text size="sm" fw={500}>Distância Total:</Text>
              <Badge size="lg" color="blue">
                {resultado.distanciaTotalKm.toFixed(2)} km
              </Badge>
            </Group>
          </Card>

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Ordem</Table.Th>
                <Table.Th>Cliente</Table.Th>
                <Table.Th>Endereço</Table.Th>
                <Table.Th>Distância Parcial</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {resultado.sequencia.map((item, idx) => (
                <Table.Tr key={item.nfeId || `seq-${idx}`}>
                  <Table.Td>{item.ordem}</Table.Td>
                  <Table.Td>{item.clienteRazaoSocial}</Table.Td>
                  <Table.Td>{item.endereco}</Table.Td>
                  <Table.Td>
                    {item.temGeolocalizacao ? (
                      item.distanciaParcialKm !== null && item.distanciaParcialKm !== undefined
                        ? `${Number(item.distanciaParcialKm).toFixed(2)} km`
                        : '—'
                    ) : (
                      <Group gap="xs">
                        <Badge color="orange" size="sm">Sem geolocalização</Badge>
                        <Text size="sm">—</Text>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Group>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSalvar}
              disabled={salvar.isPending}
              loading={salvar.isPending}
              color="green"
            >
              Salvar Sequência
            </Button>
          </Group>
        </>
      )}
    </Stack>
  )
}
