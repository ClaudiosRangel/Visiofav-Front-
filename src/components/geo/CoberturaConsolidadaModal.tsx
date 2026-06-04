'use client'

import {
  Modal,
  Accordion,
  Badge,
  Text,
  Group,
  Stack,
  Card,
  LoadingOverlay,
} from '@mantine/core'
import { useCoberturaConsolidada } from '@/data/hooks/useGeo'
import { Sobreposicao } from '@/data/types/geo'

interface CoberturaConsolidadaModalProps {
  opened: boolean
  onClose: () => void
}

export function CoberturaConsolidadaModal({
  opened,
  onClose,
}: CoberturaConsolidadaModalProps) {
  const { data, isLoading } = useCoberturaConsolidada(opened)

  const isEmpty = !isLoading && (!data || data.rotas.length === 0)

  function findSobreposicao(cidade: string, bairro: string): Sobreposicao | undefined {
    return data?.sobreposicoes.find(
      (s) => s.cidade === cidade && s.bairro === bairro
    )
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Cobertura Consolidada" size="xl">
      <div style={{ position: 'relative', minHeight: 120 }}>
        <LoadingOverlay visible={isLoading} />

        {isEmpty && (
          <Text c="dimmed" ta="center" py="xl">
            Nenhuma rota com cobertura disponível
          </Text>
        )}

        {data && data.rotas.length > 0 && (
          <Stack gap="md">
            {data.sobreposicoes.length > 0 && (
              <Card withBorder padding="sm">
                <Group gap="xs">
                  <Badge color="orange" variant="filled">
                    {data.sobreposicoes.length}
                  </Badge>
                  <Text size="sm" fw={500}>
                    {data.sobreposicoes.length === 1
                      ? 'área com sobreposição entre rotas'
                      : 'áreas com sobreposição entre rotas'}
                  </Text>
                </Group>
              </Card>
            )}

            <Accordion variant="separated">
              {data.rotas.map((rota) => (
                <Accordion.Item key={rota.rotaId} value={rota.rotaId}>
                  <Accordion.Control>
                    <Group justify="space-between" wrap="nowrap" pr="md">
                      <Text fw={500}>{rota.rotaDescricao}</Text>
                      <Group gap="xs">
                        <Badge color="green" size="sm" variant="light">
                          {rota.totalClientesGeocodificados} geocodificados
                        </Badge>
                        {rota.totalClientesNaoGeocodificados > 0 && (
                          <Badge color="gray" size="sm" variant="light">
                            {rota.totalClientesNaoGeocodificados} sem geo
                          </Badge>
                        )}
                      </Group>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      {rota.cidades.map((cidade) => (
                        <Card key={`${cidade.cidade}-${cidade.uf}`} withBorder padding="xs">
                          <Text size="sm" fw={500} mb="xs">
                            {cidade.cidade} - {cidade.uf}
                          </Text>
                          <Stack gap={4}>
                            {cidade.bairros.map((bairro) => {
                              const sobreposicao = findSobreposicao(cidade.cidade, bairro.bairro)
                              return (
                                <Group
                                  key={bairro.bairro}
                                  justify="space-between"
                                  wrap="nowrap"
                                >
                                  <Group gap="xs">
                                    <Text size="sm">{bairro.bairro}</Text>
                                    {sobreposicao && (
                                      <Badge color="orange" size="xs" variant="filled">
                                        {sobreposicao.rotas
                                          .filter((r) => r.rotaId !== rota.rotaId)
                                          .map((r) => r.codigo)
                                          .join(', ')}
                                      </Badge>
                                    )}
                                  </Group>
                                  <Text size="xs" c="dimmed">
                                    {bairro.quantidadeClientes}{' '}
                                    {bairro.quantidadeClientes === 1 ? 'cliente' : 'clientes'}
                                  </Text>
                                </Group>
                              )
                            })}
                          </Stack>
                        </Card>
                      ))}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Stack>
        )}
      </div>
    </Modal>
  )
}
