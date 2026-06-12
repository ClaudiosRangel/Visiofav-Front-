'use client'

import { useEffect, useState } from 'react'
import {
  Card, Group, Text, Table, Button, NumberInput, Badge,
  LoadingOverlay, Alert, Divider,
} from '@mantine/core'
import {
  IconArrowLeft, IconCheck, IconAlertCircle, IconPackageImport,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useParams, useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'

interface RecebimentoItem {
  itemId: string
  produtoId: string
  produtoNome: string
  quantidadeExpedida: number
  quantidadeRecebida: number | ''
}

export default function ReceberPage() {
  useModuloGuard('WMS')
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => { document.title = 'Vizor - WMS - Receber Transferência' }, [])

  const [itensRecebimento, setItensRecebimento] = useState<RecebimentoItem[]>([])
  const [divergencias, setDivergencias] = useState<any[]>([])
  const [submitted, setSubmitted] = useState(false)

  const { data: solicitacao, isLoading } = useQuery<any>({
    queryKey: ['multi-cd-solicitacao-receber', id],
    queryFn: async () => {
      const { data } = await api.get(`/multi-cd/solicitacoes/${id}`)
      return data
    },
    enabled: !!id,
  })

  useEffect(() => {
    if (solicitacao?.itens && itensRecebimento.length === 0) {
      setItensRecebimento(
        solicitacao.itens.map((item: any) => ({
          itemId: item.id,
          produtoId: item.produtoId,
          produtoNome: item.produto?.nome || item.produtoId,
          quantidadeExpedida: item.quantidadeExpedida ?? item.quantidadeSolicitada,
          quantidadeRecebida: item.quantidadeExpedida ?? item.quantidadeSolicitada,
        }))
      )
    }
  }, [solicitacao])

  const updateQuantidade = (index: number, value: number | '') => {
    const updated = [...itensRecebimento]
    updated[index] = { ...updated[index], quantidadeRecebida: value }
    setItensRecebimento(updated)
  }

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post(`/multi-cd/solicitacoes/${id}/receber`, payload)
      return data
    },
    onSuccess: (data) => {
      setSubmitted(true)
      queryClient.invalidateQueries({ queryKey: ['multi-cd-solicitacao', id] })

      const divs = data.divergencias || []
      setDivergencias(divs)

      if (divs.length === 0) {
        notifications.show({
          title: 'Recebimento concluído',
          message: 'Todos os itens foram recebidos sem divergências',
          color: 'green',
          icon: <IconCheck size={16} />,
        })
      } else {
        notifications.show({
          title: 'Recebimento com divergências',
          message: `${divs.length} item(ns) com quantidade diferente da expedida`,
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
        })
      }
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Erro ao registrar recebimento',
        color: 'red',
      })
    },
  })

  const handleSubmit = () => {
    const payload = {
      itens: itensRecebimento.map(item => ({
        itemId: item.itemId,
        quantidadeRecebida: Number(item.quantidadeRecebida) || 0,
      })),
    }
    mutation.mutate(payload)
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Multi-CD / Receber</Text>
      <Group mb="lg">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push(`/wms/multi-cd/${id}`)}
        >
          Voltar
        </Button>
        <Text size="xl" fw={600}>Receber Transferência — {solicitacao?.numero || ''}</Text>
      </Group>

      {/* Info */}
      <Card mb="md" pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group gap="xl" mb="md">
          <div>
            <Text size="xs" c="dimmed">CD Origem</Text>
            <Text fw={500}>{solicitacao?.cdOrigem?.nome || '—'}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">CD Destino</Text>
            <Text fw={500}>{solicitacao?.cdDestino?.nome || '—'}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Status</Text>
            <Badge variant="light" color="orange">{solicitacao?.status || '—'}</Badge>
          </div>
        </Group>
      </Card>

      {/* Items to receive */}
      <Card mb="md" pos="relative">
        <LoadingOverlay visible={mutation.isPending} />
        <Text fw={500} mb="md">Itens para Recebimento</Text>

        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Qtd. Expedida</Table.Th>
              <Table.Th>Qtd. Recebida</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {itensRecebimento.map((item, index) => (
              <Table.Tr key={item.itemId}>
                <Table.Td>{item.produtoNome}</Table.Td>
                <Table.Td>
                  <Text fw={500}>{item.quantidadeExpedida}</Text>
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    value={item.quantidadeRecebida}
                    onChange={(val) => updateQuantidade(index, val as number | '')}
                    min={0}
                    max={item.quantidadeExpedida * 2}
                    disabled={submitted}
                    style={{ maxWidth: 120 }}
                    error={
                      item.quantidadeRecebida !== '' &&
                      Number(item.quantidadeRecebida) !== item.quantidadeExpedida
                        ? 'Divergência'
                        : undefined
                    }
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {!submitted && (
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => router.push(`/wms/multi-cd/${id}`)}>
              Cancelar
            </Button>
            <Button
              leftSection={<IconPackageImport size={16} />}
              onClick={handleSubmit}
              loading={mutation.isPending}
            >
              Confirmar Recebimento
            </Button>
          </Group>
        )}
      </Card>

      {/* Divergences */}
      {submitted && divergencias.length > 0 && (
        <Card>
          <Alert color="yellow" icon={<IconAlertCircle size={16} />} mb="md">
            Foram encontradas divergências no recebimento. Revise os itens abaixo.
          </Alert>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Qtd. Expedida</Table.Th>
                <Table.Th>Qtd. Recebida</Table.Th>
                <Table.Th>Diferença</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {divergencias.map((div: any, idx: number) => (
                <Table.Tr key={idx}>
                  <Table.Td>{div.produtoNome || div.produtoId}</Table.Td>
                  <Table.Td>{div.quantidadeExpedida}</Table.Td>
                  <Table.Td>{div.quantidadeRecebida}</Table.Td>
                  <Table.Td>
                    <Text c="red" fw={600}>
                      {div.quantidadeRecebida - div.quantidadeExpedida}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {submitted && divergencias.length === 0 && (
        <Alert color="green" icon={<IconCheck size={16} />}>
          Recebimento concluído com sucesso. Todos os itens foram recebidos conforme expedição.
        </Alert>
      )}
    </div>
  )
}
