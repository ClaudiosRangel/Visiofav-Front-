'use client'

import { Modal, Card, Text, Group, Badge, Accordion, LoadingOverlay } from '@mantine/core'
import { useCoberturaRota } from '@/data/hooks/useGeo'

interface CoberturaRotaModalProps {
  opened: boolean
  onClose: () => void
  rotaId: string
  rotaDescricao: string
}

export function CoberturaRotaModal({
  opened,
  onClose,
  rotaId,
  rotaDescricao,
}: CoberturaRotaModalProps) {
  const { data: cobertura, isLoading } = useCoberturaRota(rotaId, opened)

  return (
    <Modal opened={opened} onClose={onClose} title={`Cobertura - ${rotaDescricao}`} size="lg">
      <div style={{ position: 'relative', minHeight: 120 }}>
        <LoadingOverlay visible={isLoading} />

        {cobertura && (
          <>
            <Card withBorder mb="md">
              <Group justify="space-between">
                <Text fw={500}>Resumo de Clientes</Text>
                <Group gap="xs">
                  <Badge color="green" variant="light">
                    Geocodificados: {cobertura.totalClientesGeocodificados}
                  </Badge>
                  <Badge color="gray" variant="light">
                    Não geocodificados: {cobertura.totalClientesNaoGeocodificados}
                  </Badge>
                </Group>
              </Group>
            </Card>

            {cobertura.cidades.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">
                Nenhuma cidade encontrada na cobertura desta rota
              </Text>
            )}

            {cobertura.cidades.length > 0 && (
              <Accordion variant="contained">
                {cobertura.cidades.map((cidade) => (
                  <Accordion.Item key={`${cidade.cidade}-${cidade.uf}`} value={`${cidade.cidade}-${cidade.uf}`}>
                    <Accordion.Control>
                      <Group justify="space-between" pr="md">
                        <Text fw={500}>
                          {cidade.cidade} - {cidade.uf}
                        </Text>
                        <Badge size="sm" variant="light">
                          {cidade.bairros.reduce((sum, b) => sum + b.quantidadeClientes, 0)} clientes
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      {cidade.bairros.map((bairro) => (
                        <Group key={bairro.bairro} justify="space-between" py={4}>
                          <Text size="sm">{bairro.bairro}</Text>
                          <Badge size="xs" variant="outline">
                            {bairro.quantidadeClientes} {bairro.quantidadeClientes === 1 ? 'cliente' : 'clientes'}
                          </Badge>
                        </Group>
                      ))}
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
