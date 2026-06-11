'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Button, Select, TextInput, NumberInput,
  Table, ActionIcon, Alert, LoadingOverlay,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
  IconPlus, IconTrash, IconArrowLeft, IconCheck, IconAlertCircle,
} from '@tabler/icons-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'

interface ItemRow {
  produtoId: string
  quantidadeSolicitada: number | ''
  estoqueDisponivel: number | null
}

const PRIORIDADE_OPTIONS = [
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
]

export default function NovaSolicitacaoPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Nova Solicitação de Transferência' }, [])

  const router = useRouter()

  const [cdOrigemId, setCdOrigemId] = useState<string>('')
  const [cdDestinoId, setCdDestinoId] = useState<string>('')
  const [motivo, setMotivo] = useState('')
  const [prioridade, setPrioridade] = useState<string>('NORMAL')
  const [dataPrevistaEnvio, setDataPrevistaEnvio] = useState<Date | null>(null)
  const [itens, setItens] = useState<ItemRow[]>([
    { produtoId: '', quantidadeSolicitada: '', estoqueDisponivel: null },
  ])

  const { data: cdsResp } = useQuery<any>({
    queryKey: ['centros-distribuicao'],
    queryFn: async () => {
      const { data } = await api.get('/centros-distribuicao')
      return data
    },
  })

  const { data: produtosResp } = useQuery<any>({
    queryKey: ['produtos-lista'],
    queryFn: async () => {
      const { data } = await api.get('/produtos', { params: { limit: 1000 } })
      return data
    },
  })

  const cdOptions = (cdsResp?.data || []).map((cd: any) => ({
    value: cd.id,
    label: cd.nome,
  }))

  const produtoOptions = (produtosResp?.data || produtosResp || []).map((p: any) => ({
    value: p.id,
    label: `${p.codigo || p.sku || ''} - ${p.nome || p.descricao || 'Produto'}`.trim(),
  }))

  const addItem = () => {
    setItens([...itens, { produtoId: '', quantidadeSolicitada: '', estoqueDisponivel: null }])
  }

  const removeItem = (index: number) => {
    if (itens.length <= 1) return
    setItens(itens.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof ItemRow, value: any) => {
    const updated = [...itens]
    updated[index] = { ...updated[index], [field]: value }
    setItens(updated)
  }

  const checkEstoque = async (index: number, produtoId: string) => {
    if (!produtoId || !cdOrigemId) return
    try {
      const { data } = await api.get(`/multi-cd/estoque/${cdOrigemId}/${produtoId}`)
      setItens(prev => prev.map((item, i) => i === index ? { ...item, estoqueDisponivel: data.quantidadeDisponivel ?? 0 } : item))
    } catch {
      setItens(prev => prev.map((item, i) => i === index ? { ...item, estoqueDisponivel: null } : item))
    }
  }

  const handleProdutoChange = (index: number, value: string | null) => {
    updateItem(index, 'produtoId', value || '')
    if (value) checkEstoque(index, value)
  }

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/multi-cd/solicitacoes', payload)
      return data
    },
    onSuccess: (data) => {
      notifications.show({
        title: 'Solicitação criada',
        message: `Solicitação ${data.numero || ''} criada com sucesso`,
        color: 'green',
        icon: <IconCheck size={16} />,
      })
      router.push('/wms/multi-cd')
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Erro ao criar solicitação',
        color: 'red',
      })
    },
  })

  const handleSubmit = () => {
    if (!cdOrigemId || !cdDestinoId) {
      notifications.show({ title: 'Atenção', message: 'Selecione CD de origem e destino', color: 'yellow' })
      return
    }
    if (cdOrigemId === cdDestinoId) {
      notifications.show({ title: 'Atenção', message: 'CD de origem e destino devem ser diferentes', color: 'yellow' })
      return
    }
    const itensValidos = itens.filter(i => i.produtoId && i.quantidadeSolicitada)
    if (itensValidos.length === 0) {
      notifications.show({ title: 'Atenção', message: 'Adicione ao menos um item', color: 'yellow' })
      return
    }

    mutation.mutate({
      cdOrigemId,
      cdDestinoId,
      motivo,
      prioridade,
      dataPrevistaEnvio: dataPrevistaEnvio?.toISOString() || null,
      itens: itensValidos.map(i => ({
        produtoId: i.produtoId,
        quantidadeSolicitada: Number(i.quantidadeSolicitada),
      })),
    })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Multi-CD / Nova Solicitação</Text>
      <Group mb="lg">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push('/wms/multi-cd')}
        >
          Voltar
        </Button>
        <Text size="xl" fw={600}>Nova Solicitação de Transferência</Text>
      </Group>

      <Card mb="md" pos="relative">
        <LoadingOverlay visible={mutation.isPending} />
        <SimpleGridFields>
          <Select
            label="CD Origem"
            placeholder="Selecione o CD de origem"
            data={cdOptions}
            value={cdOrigemId}
            onChange={(val) => setCdOrigemId(val || '')}
            required
            searchable
          />
          <Select
            label="CD Destino"
            placeholder="Selecione o CD de destino"
            data={cdOptions}
            value={cdDestinoId}
            onChange={(val) => setCdDestinoId(val || '')}
            required
            searchable
          />
          <TextInput
            label="Motivo"
            placeholder="Motivo da transferência"
            value={motivo}
            onChange={(e) => setMotivo(e.currentTarget.value)}
          />
          <Select
            label="Prioridade"
            data={PRIORIDADE_OPTIONS}
            value={prioridade}
            onChange={(val) => setPrioridade(val || 'NORMAL')}
          />
          <DatePickerInput
            label="Data Prevista de Envio"
            placeholder="Selecione a data"
            value={dataPrevistaEnvio}
            onChange={setDataPrevistaEnvio}
            clearable
            minDate={new Date()}
          />
        </SimpleGridFields>
      </Card>

      {/* Items */}
      <Card mb="md">
        <Group justify="space-between" mb="md">
          <Text fw={500}>Itens da Transferência</Text>
          <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addItem} size="sm">
            Adicionar Item
          </Button>
        </Group>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Qtd. Solicitada</Table.Th>
              <Table.Th>Estoque Disponível</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {itens.map((item, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Select
                    placeholder="Selecione o produto"
                    data={produtoOptions}
                    value={item.produtoId}
                    onChange={(val) => handleProdutoChange(index, val)}
                    searchable
                    clearable
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    placeholder="Quantidade"
                    value={item.quantidadeSolicitada}
                    onChange={(val) => updateItem(index, 'quantidadeSolicitada', val)}
                    min={1}
                  />
                </Table.Td>
                <Table.Td>
                  {item.estoqueDisponivel !== null ? (
                    <Group gap="xs">
                      <Text
                        size="sm"
                        c={
                          item.quantidadeSolicitada && item.estoqueDisponivel < Number(item.quantidadeSolicitada)
                            ? 'red'
                            : 'green'
                        }
                        fw={500}
                      >
                        {item.estoqueDisponivel} un.
                      </Text>
                      {item.quantidadeSolicitada && item.estoqueDisponivel < Number(item.quantidadeSolicitada) && (
                        <IconAlertCircle size={14} color="red" />
                      )}
                    </Group>
                  ) : (
                    <Text size="sm" c="dimmed">—</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => removeItem(index)}
                    disabled={itens.length <= 1}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {itens.some(i => i.estoqueDisponivel !== null && i.quantidadeSolicitada && i.estoqueDisponivel < Number(i.quantidadeSolicitada)) && (
          <Alert color="yellow" icon={<IconAlertCircle size={16} />} mt="md">
            Alguns itens possuem quantidade solicitada superior ao estoque disponível no CD de origem.
          </Alert>
        )}
      </Card>

      <Group justify="flex-end">
        <Button variant="default" onClick={() => router.push('/wms/multi-cd')}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} loading={mutation.isPending}>
          Criar Solicitação
        </Button>
      </Group>
    </div>
  )
}

function SimpleGridFields({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
      {children}
    </div>
  )
}
