'use client'

import { useEffect, useState } from 'react'
import { Modal, Stack, Group, Text, Badge, Table, Loader, Center, SimpleGrid, Paper } from '@mantine/core'
import { api } from '@/lib/api'

// Modal de HISTÓRICO de apontamentos de uma etapa — exibido ao concluir (R2 da
// spec apontamentos-melhorias-caio). Somente leitura. Consome
// GET /pcp/etapas/:id/apontamentos (já existente).

interface Apontamento {
  id: string
  tipo: string // PRODUCAO | PERDA | PARADA | RETOMADA
  quantidadeProduzida: number | string
  quantidadePerda: number | string
  motivoParada: string | null
  motivoPerda: string | null
  tempoParadaMinutos: number | null
  observacao: string | null
  dataHora: string
}

interface Totais {
  totalProduzido: number
  totalPerda: number
  totalParadas: number
  tempoParadaTotal: number
}

interface Resposta {
  apontamentos: Apontamento[]
  totais: Totais
}

const TIPO_COR: Record<string, string> = { PRODUCAO: 'green', PERDA: 'red', PARADA: 'orange', RETOMADA: 'blue' }
const TIPO_LABEL: Record<string, string> = { PRODUCAO: 'Produção', PERDA: 'Perda', PARADA: 'Parada', RETOMADA: 'Retomada' }
const num = (v: number | string | null) => (v == null ? '—' : Number(v).toLocaleString('pt-BR'))

export default function HistoricoEtapaModal({
  etapaId,
  opNumero,
  opened,
  onClose,
}: {
  etapaId: string | null
  opNumero?: string | number
  opened: boolean
  onClose: () => void
}) {
  const [dados, setDados] = useState<Resposta | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!opened || !etapaId) { setDados(null); return }
    setLoading(true)
    api.get(`/pcp/etapas/${etapaId}/apontamentos`)
      .then(({ data }) => setDados(data))
      .catch(() => setDados(null))
      .finally(() => setLoading(false))
  }, [opened, etapaId])

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Histórico de Apontamentos${opNumero ? ` — OS ${opNumero}` : ''}`}
      size="lg"
    >
      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : !dados ? (
        <Text c="dimmed" ta="center" py="md">Sem histórico de apontamentos.</Text>
      ) : (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            <Paper p="sm" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Produzido</Text>
              <Text fw={700} c="green">{num(dados.totais.totalProduzido)}</Text>
            </Paper>
            <Paper p="sm" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Perda</Text>
              <Text fw={700} c="red">{num(dados.totais.totalPerda)}</Text>
            </Paper>
            <Paper p="sm" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Paradas</Text>
              <Text fw={700} c="orange">{dados.totais.totalParadas}</Text>
            </Paper>
            <Paper p="sm" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Tempo parado</Text>
              <Text fw={700} c="orange">{dados.totais.tempoParadaTotal} min</Text>
            </Paper>
          </SimpleGrid>

          {dados.apontamentos.length === 0 ? (
            <Text c="dimmed" ta="center" py="sm">Nenhum apontamento registrado.</Text>
          ) : (
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data/Hora</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th ta="right">Qtd</Table.Th>
                  <Table.Th>Motivo</Table.Th>
                  <Table.Th>Obs.</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dados.apontamentos.map((a) => (
                  <Table.Tr key={a.id}>
                    <Table.Td>{new Date(a.dataHora).toLocaleString('pt-BR')}</Table.Td>
                    <Table.Td>
                      <Badge size="sm" color={TIPO_COR[a.tipo] ?? 'gray'} variant="light">
                        {TIPO_LABEL[a.tipo] ?? a.tipo}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">
                      {a.tipo === 'PERDA'
                        ? num(a.quantidadePerda)
                        : a.tipo === 'PARADA'
                          ? (a.tempoParadaMinutos != null ? `${a.tempoParadaMinutos} min` : '—')
                          : num(a.quantidadeProduzida)}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">{a.motivoParada || a.motivoPerda || '—'}</Text>
                    </Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{a.observacao || '—'}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      )}
    </Modal>
  )
}
