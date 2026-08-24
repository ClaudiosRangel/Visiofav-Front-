'use client'

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ActionIcon,
  Card,
  Group,
  Progress,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { usePortalRepPipelineDetalhe } from '@/data/hooks/portal-rep-app/usePortalRepPipeline'
import { formatarData } from '@/components/portal-rep/formatters'
import { PipelineTimeline } from '@/components/portal-rep/PipelineTimeline'
import { SkeletonCard } from '@/components/portal-rep/SkeletonCard'

export default function PipelineDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: detalhe, isLoading } = usePortalRepPipelineDetalhe(id)

  // Monta mapa de datas de transição para o PipelineTimeline
  const datasTransicao = useMemo(() => {
    if (!detalhe?.transicoes) return undefined
    const mapa: Record<string, string | null> = {}
    for (const t of detalhe.transicoes) {
      mapa[t.status] = formatarData(t.data)
    }
    return mapa
  }, [detalhe?.transicoes])

  if (isLoading) {
    return (
      <Stack gap="md" p="md">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
      </Stack>
    )
  }

  if (!detalhe) {
    return (
      <Stack gap="md" p="md">
        <Text c="dimmed">Pedido não encontrado.</Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md" p="md">
      {/* Header com botão voltar */}
      <Group gap="sm">
        <ActionIcon
          variant="subtle"
          onClick={() => router.push('/portal-rep/pipeline')}
          aria-label="Voltar"
        >
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={3}>Pedido #{detalhe.numero}</Title>
      </Group>

      {/* Timeline completa com datas */}
      <Card padding="md">
        <Stack gap="sm">
          <Text fw={600} size="sm">
            Acompanhamento
          </Text>
          <PipelineTimeline
            statusAtual={detalhe.statusAtual}
            compacto={false}
            datas={datasTransicao}
          />
        </Stack>
      </Card>

      {/* Barra de progresso de produção */}
      {detalhe.statusAtual === 'PRODUCAO' && detalhe.percentualProducao != null && (
        <Card padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600} size="sm">
                Progresso da Produção
              </Text>
              <Text size="sm" c="dimmed">
                {detalhe.percentualProducao}%
              </Text>
            </Group>
            <Progress
              value={detalhe.percentualProducao}
              size="lg"
              radius="md"
              color="green"
            />
          </Stack>
        </Card>
      )}

      {/* Informações do pedido */}
      <Card padding="md">
        <Stack gap="sm">
          <Text fw={600} size="sm">
            Informações do Pedido
          </Text>

          <Group justify="space-between" wrap="wrap">
            <div>
              <Text size="xs" c="dimmed">Cliente</Text>
              <Text size="sm">{detalhe.clienteNome}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Data de Criação</Text>
              <Text size="sm">{formatarData(detalhe.criadoEm)}</Text>
            </div>
          </Group>

          {detalhe.dataEntregaPrevista && (
            <div>
              <Text size="xs" c="dimmed">Previsão de Entrega</Text>
              <Text size="sm">{formatarData(detalhe.dataEntregaPrevista)}</Text>
            </div>
          )}
        </Stack>
      </Card>

      {/* Lista de produtos */}
      {detalhe.produtos && detalhe.produtos.length > 0 && (
        <Card padding="md">
          <Stack gap="sm">
            <Text fw={600} size="sm">
              Produtos
            </Text>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Produto</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Quantidade</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {detalhe.produtos.map((produto, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Text size="sm">{produto.nome}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm">{produto.quantidade.toLocaleString('pt-BR')}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Card>
      )}
    </Stack>
  )
}
