'use client'

import { useState, useEffect } from 'react'
import { Card, Group, Text, SimpleGrid, ThemeIcon, Table, Badge, Button, Tabs, LoadingOverlay, Modal, Select, TextInput } from '@mantine/core'
import { IconArrowsExchange, IconClipboardList, IconClock, IconCheck, IconPlus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useOrdensServico, useCriarOrdemServico, useAlterarStatusOS } from '@/data/hooks/useOrdemServico'
import { useCentrosDistribuicao } from '@/data/hooks/useCentroDistribuicao'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const statusColor: Record<string, string> = { ABERTO: 'orange', EXECUTANDO: 'blue', PARCIAL: 'yellow', CONCLUIDO: 'green', REJEITADO: 'red' }
const tipoColor: Record<string, string> = { ENTRADA: 'primary', SAIDA: 'grape', TRANSFERENCIA: 'blue', MANUTENCAO: 'orange' }

const osSchema = z.object({
  centroDistribuicaoId: z.string().min(1, 'CD é obrigatório'),
  tipo: z.string().min(1), tipoOperacao: z.string().min(1), tipoMovimento: z.string().optional(),
  hora: z.string().min(1), numDocumento: z.string().optional(), observacao: z.string().optional(),
})
type OsForm = z.infer<typeof osSchema>

export default function MovimentacaoPage() {
  useEffect(() => { document.title = 'VisioFab - WMS - Movimentação' }, [])
  const [modalOpen, setModalOpen] = useState(false)
  const { data: response, isLoading } = useOrdensServico()
  const { data: cdsResp } = useCentrosDistribuicao({ limit: 100 })
  const criarOS = useCriarOrdemServico()
  const alterarStatus = useAlterarStatusOS()

  const cdOptions = (cdsResp?.data || []).map((c: any) => ({ value: c.id, label: c.descricao }))
  const { control, handleSubmit, reset, formState: { errors } } = useForm<OsForm>({ resolver: zodResolver(osSchema), defaultValues: { hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) } })

  const ordens = response?.data || []
  const countByStatus = (s: string) => ordens.filter((o: any) => o.status === s).length

  async function onSubmit(data: OsForm) {
    try { await criarOS.mutateAsync(data); notifications.show({ title: 'Sucesso', message: 'OS criada', color: 'green' }); setModalOpen(false); reset() }
    catch { notifications.show({ title: 'Erro', message: 'Falha', color: 'red' }) }
  }

  async function handleStatus(id: string, status: string) {
    try { await alterarStatus.mutateAsync({ id, status }); notifications.show({ title: 'Sucesso', message: `Status: ${status}`, color: 'green' }) }
    catch { notifications.show({ title: 'Erro', message: 'Falha', color: 'red' }) }
  }

  const stats = [
    { title: 'OS Abertas', value: String(countByStatus('ABERTO')), icon: IconClipboardList, color: 'orange' },
    { title: 'Em Execução', value: String(countByStatus('EXECUTANDO')), icon: IconClock, color: 'blue' },
    { title: 'Concluídas', value: String(countByStatus('CONCLUIDO')), icon: IconCheck, color: 'green' },
    { title: 'Total', value: String(ordens.length), icon: IconArrowsExchange, color: 'grape' },
  ]

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Movimentação</Text>
      <Text size="xl" fw={600} mb="lg">Movimentação</Text>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="xl">
        {stats.map((stat) => (
          <Card key={stat.title}><Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>{stat.title}</Text><Text size="xl" fw={700} mt={4}>{stat.value}</Text></div><ThemeIcon color={stat.color} variant="light" size={48} radius="md"><stat.icon size={24} /></ThemeIcon></Group></Card>
        ))}
      </SimpleGrid>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <Text fw={600}>Ordens de Serviço</Text>
          <Button leftSection={<IconPlus size={16} />} onClick={() => { reset({ hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }); setModalOpen(true) }}>Nova OS</Button>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>OS</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Operação</Table.Th><Table.Th>Funcionário</Table.Th><Table.Th>Data</Table.Th><Table.Th>Movimentos</Table.Th><Table.Th>Status</Table.Th><Table.Th>Ações</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {ordens.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td><Text fw={600}>#{item.numero}</Text></Table.Td>
                <Table.Td><Badge color={tipoColor[item.tipo] || 'gray'} variant="light">{item.tipo}</Badge></Table.Td>
                <Table.Td className="text-sm">{item.tipoOperacao?.replace(/_/g, ' ')}</Table.Td>
                <Table.Td>{item.osFuncionarios?.[0]?.funcionario?.nome || '-'}</Table.Td>
                <Table.Td>{new Date(item.data).toLocaleDateString('pt-BR')}</Table.Td>
                <Table.Td>{item.movimentos?.length || 0}</Table.Td>
                <Table.Td><Badge color={statusColor[item.status] || 'gray'} variant="light">{item.status}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {item.status === 'ABERTO' && <Button size="xs" variant="light" onClick={() => handleStatus(item.id, 'EXECUTANDO')}>Iniciar</Button>}
                    {item.status === 'EXECUTANDO' && <Button size="xs" variant="light" color="green" onClick={() => handleStatus(item.id, 'CONCLUIDO')}>Concluir</Button>}
                    {item.status === 'CONCLUIDO' && <Badge color="green" variant="light">Concluído</Badge>}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && ordens.length === 0 && <Table.Tr><Table.Td colSpan={8} className="text-center py-8 text-zinc-500">Nenhuma OS</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Nova Ordem de Serviço" size="lg" centered closeOnClickOutside={false}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-4">
            <Controller name="centroDistribuicaoId" control={control} render={({ field }) => (<Select label={<>CD <span style={{ color: 'red' }}>*</span></>} data={cdOptions} error={errors.centroDistribuicaoId?.message} searchable {...field} />)} />
            <div className="flex gap-4 w-full">
              <Controller name="tipo" control={control} render={({ field }) => (<Select label={<>Tipo <span style={{ color: 'red' }}>*</span></>} data={[{ value: 'ENTRADA', label: 'Entrada' }, { value: 'SAIDA', label: 'Saída' }, { value: 'TRANSFERENCIA', label: 'Transferência' }, { value: 'MANUTENCAO', label: 'Manutenção' }]} error={errors.tipo?.message} className="w-6/12" {...field} />)} />
              <Controller name="tipoOperacao" control={control} render={({ field }) => (<Select label={<>Operação <span style={{ color: 'red' }}>*</span></>} data={[{ value: 'CONFERENCIA', label: 'Conferência' }, { value: 'ENDERECAMENTO', label: 'Endereçamento' }, { value: 'SEPARACAO', label: 'Separação' }, { value: 'REPOSICAO', label: 'Reposição' }, { value: 'MUDANCA_ENDERECO', label: 'Mudança Endereço' }, { value: 'INVENTARIO', label: 'Inventário' }]} error={errors.tipoOperacao?.message} className="w-6/12" {...field} />)} />
            </div>
            <div className="flex gap-4 w-full">
              <Controller name="hora" control={control} render={({ field }) => (<TextInput label="Hora" className="w-3/12" {...field} />)} />
              <Controller name="numDocumento" control={control} render={({ field }) => (<TextInput label="Nº Documento" className="w-4/12" {...field} />)} />
              <Controller name="tipoMovimento" control={control} render={({ field }) => (<Select label="Tipo Movimento" data={[{ value: 'HORIZONTAL', label: 'Horizontal' }, { value: 'VERTICAL', label: 'Vertical' }]} className="w-5/12" clearable {...field} />)} />
            </div>
            <Controller name="observacao" control={control} render={({ field }) => (<TextInput label="Observação" {...field} />)} />
          </div>
          <Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" loading={criarOS.isPending}>Salvar</Button></Group>
        </form>
      </Modal>
    </div>
  )
}
