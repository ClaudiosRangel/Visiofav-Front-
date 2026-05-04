'use client'

import { useState } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Progress, LoadingOverlay,
  Modal, NumberInput, Select, MultiSelect, ActionIcon, Tooltip, Divider,
} from '@mantine/core'
import {
  IconArrowLeft, IconCheck, IconAlertTriangle, IconUsers, IconPlayerPlay,
  IconPrinter, IconEye,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter, useParams } from 'next/navigation'

const statusItemColors: Record<string, string> = { PENDENTE: 'orange', SEPARADO: 'green', SEPARADO_PARCIAL: 'yellow' }

export default function DetalheOndaPage() {
  useModuloGuard('WMS')
  const router = useRouter()
  const params = useParams()
  const ondaId = params.id as string
  const queryClient = useQueryClient()

  const [funcModal, setFuncModal] = useState(false)
  const [selectedFuncs, setSelectedFuncs] = useState<string[]>([])
  const [confirmModal, setConfirmModal] = useState<any>(null)
  const [qtdSeparada, setQtdSeparada] = useState<number>(0)
  const [motivoDiv, setMotivoDiv] = useState<string | null>(null)

  const { data: onda, isLoading } = useQuery<any>({
    queryKey: ['onda-separacao', ondaId],
    queryFn: async () => { const { data } = await api.get(`/ondas-separacao/${ondaId}`); return data },
  })

  const { data: funcsData } = useQuery<any>({
    queryKey: ['funcionarios-select'],
    queryFn: async () => { const { data } = await api.get('/funcionarios', { params: { limit: 100 } }); return data },
    enabled: funcModal,
  })

  const atribuirFuncs = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/ondas-separacao/${ondaId}/funcionarios`, { funcionarioIds: selectedFuncs })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onda-separacao', ondaId] })
      setFuncModal(false)
      setSelectedFuncs([])
      notifications.show({ title: 'Sucesso', message: 'Funcionários atribuídos', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const confirmarItem = useMutation({
    mutationFn: async () => {
      const body: any = { quantidadeSeparada: qtdSeparada }
      if (motivoDiv) body.motivoDivergencia = motivoDiv
      const { data } = await api.patch(`/itens-separacao/${confirmModal.id}/confirmar`, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onda-separacao', ondaId] })
      setConfirmModal(null)
      notifications.show({ title: 'Sucesso', message: 'Item separado', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const todosItens = onda?.ordens?.flatMap((o: any) => o.itens.map((i: any) => ({ ...i, funcionarioId: o.funcionarioId }))) || []
  const funcOptions = (funcsData?.data || []).map((f: any) => ({ value: f.id, label: f.nome || f.matricula }))

  if (isLoading) return <Card pos="relative" mih={200}><LoadingOverlay visible /></Card>
  if (!onda) return <div><Text>Onda não encontrada</Text><Button onClick={() => router.push('/picking')}>Voltar</Button></div>

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Picking / Onda #{onda.numero}</Text>
      <Group mb="lg">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/picking')}>Voltar</Button>
        <Text size="xl" fw={600}>Onda #{onda.numero}</Text>
        <Badge color={onda.status === 'EM_SEPARACAO' ? 'blue' : onda.status === 'SEPARADA' ? 'green' : 'gray'} size="lg">{onda.status}</Badge>
        <Badge color={onda.prioridade === 'ALTA' ? 'red' : onda.prioridade === 'MEDIA' ? 'yellow' : 'gray'} variant="light">{onda.prioridade}</Badge>
      </Group>

      {/* Progresso */}
      <Card mb="md">
        <Group justify="space-between" mb="sm">
          <Text fw={500}>Progresso da Separação</Text>
          <Text fw={600}>{onda.progresso?.separados || 0} / {onda.progresso?.totalItens || 0} itens ({onda.progresso?.percentual || 0}%)</Text>
        </Group>
        <Progress value={onda.progresso?.percentual || 0} size="xl" color={onda.progresso?.percentual === 100 ? 'green' : 'blue'} />
      </Card>

      {/* Ações */}
      {onda.status === 'EM_SEPARACAO' && (
        <Group mb="md">
          <Button leftSection={<IconUsers size={16} />} variant="light" onClick={() => setFuncModal(true)}>
            Atribuir Funcionários
          </Button>
          <Button leftSection={<IconEye size={16} />} variant="light" color="cyan"
            onClick={() => router.push(`/wms/picking/monitor?ondaId=${ondaId}`)}>
            Monitor (Coletor)
          </Button>
          <Button leftSection={<IconPrinter size={16} />} variant="light" color="teal"
            onClick={async () => {
              try {
                const { data } = await api.get(`/ondas-separacao/${ondaId}/ficha-acompanhamento/separacao`, { responseType: 'text' })
                const w = window.open('', '_blank')
                if (w) { w.document.write(data); w.document.close() }
              } catch { notifications.show({ title: 'Erro', message: 'Falha ao gerar ficha', color: 'red' }) }
            }}>
            Imprimir Ficha
          </Button>
        </Group>
      )}

      {/* Itens de Separação */}
      <Card>
        <Text fw={600} mb="sm">Itens de Separação ({todosItens.length})</Text>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Endereço Origem</Table.Th>
              <Table.Th>Qtd Solicitada</Table.Th>
              <Table.Th>Qtd Separada</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Divergência</Table.Th>
              <Table.Th className="w-24">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {todosItens.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.produto ? `${item.produto.codigo} - ${item.produto.nome}` : item.produtoId?.substring(0, 8)}</Table.Td>
                <Table.Td className="font-mono text-sm">{item.enderecoOrigem?.enderecoCompleto ?? item.enderecoOrigemId?.substring(0, 8)}</Table.Td>
                <Table.Td>{Number(item.quantidadeSolicitada)}</Table.Td>
                <Table.Td>{Number(item.quantidadeSeparada)}</Table.Td>
                <Table.Td><Badge color={statusItemColors[item.status] || 'gray'} variant="light">{item.status}</Badge></Table.Td>
                <Table.Td>{item.motivoDivergencia || '—'}</Table.Td>
                <Table.Td>
                  {item.status === 'PENDENTE' && (
                    <Tooltip label="Confirmar separação">
                      <ActionIcon variant="subtle" color="green" onClick={() => { setConfirmModal(item); setQtdSeparada(Number(item.quantidadeSolicitada)); setMotivoDiv(null) }}>
                        <IconCheck size={18} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {todosItens.length === 0 && <Table.Tr><Table.Td colSpan={7} className="text-center py-8 text-zinc-500">Nenhum item de separação</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Atribuir Funcionários */}
      <Modal opened={funcModal} onClose={() => setFuncModal(false)} title="Atribuir Funcionários" centered>
        <MultiSelect label="Funcionários" data={funcOptions} value={selectedFuncs} onChange={setSelectedFuncs} searchable placeholder="Selecione..." />
        <Text size="sm" c="dimmed" mt="sm">Os itens serão distribuídos igualmente entre os funcionários selecionados.</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setFuncModal(false)}>Cancelar</Button>
          <Button onClick={() => atribuirFuncs.mutate()} loading={atribuirFuncs.isPending} disabled={selectedFuncs.length === 0}>Atribuir</Button>
        </Group>
      </Modal>

      {/* Modal Confirmar Separação */}
      <Modal opened={!!confirmModal} onClose={() => setConfirmModal(null)} title="Confirmar Separação" centered>
        <NumberInput label="Quantidade Separada" value={qtdSeparada} onChange={(v) => setQtdSeparada(typeof v === 'number' ? v : 0)} min={0} decimalScale={4} mb="sm" />
        {qtdSeparada < Number(confirmModal?.quantidadeSolicitada || 0) && (
          <Select label="Motivo da Divergência *" data={[
            { value: 'PRODUTO_NAO_ENCONTRADO', label: 'Produto não encontrado' },
            { value: 'QUANTIDADE_INSUFICIENTE', label: 'Quantidade insuficiente' },
            { value: 'AVARIA', label: 'Avaria' },
          ]} value={motivoDiv} onChange={setMotivoDiv} mb="sm" />
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setConfirmModal(null)}>Cancelar</Button>
          <Button color="green" onClick={() => confirmarItem.mutate()} loading={confirmarItem.isPending}>Confirmar</Button>
        </Group>
      </Modal>
    </div>
  )
}
