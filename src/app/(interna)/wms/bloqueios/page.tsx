'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select, TextInput,
  Modal, Tabs, ActionIcon, Tooltip, Alert, SimpleGrid, ThemeIcon,
} from '@mantine/core'
import {
  IconLock, IconLockOpen, IconPlus, IconShieldLock,
  IconAlertTriangle, IconBarcode, IconHistory,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const nivelOptions = [
  { value: 'DEPOSITO', label: 'Depósito' },
  { value: 'ZONA', label: 'Zona / Área' },
  { value: 'RUA', label: 'Rua' },
  { value: 'PREDIO', label: 'Prédio' },
  { value: 'NIVEL', label: 'Nível' },
  { value: 'PRODUTO', label: 'Produto' },
  { value: 'LOTE', label: 'Lote' },
]

const tipoOptions = [
  { value: 'MANUTENCAO', label: 'Manutenção' },
  { value: 'INVENTARIO', label: 'Inventário' },
  { value: 'QUARENTENA', label: 'Quarentena' },
  { value: 'RECALL', label: 'Recall' },
  { value: 'AVARIA', label: 'Avaria' },
  { value: 'OUTRO', label: 'Outro' },
]

const tipoCores: Record<string, string> = {
  MANUTENCAO: 'blue', INVENTARIO: 'orange', QUARENTENA: 'yellow',
  RECALL: 'red', AVARIA: 'grape', OUTRO: 'gray',
}

export default function BloqueiosPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Bloqueios' }, [])
  const queryClient = useQueryClient()

  const [criarModal, setCriarModal] = useState(false)
  const [nivel, setNivel] = useState<string | null>(null)
  const [tipo, setTipo] = useState<string | null>('MANUTENCAO')
  const [motivo, setMotivo] = useState('')
  const [depositoId, setDepositoId] = useState('')
  const [zonaId, setZonaId] = useState('')
  const [rua, setRua] = useState('')
  const [predio, setPredio] = useState('')
  const [codigoNivel, setCodigoNivel] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [lote, setLote] = useState('')

  // Listar bloqueios ativos
  const { data: bloqueios = [], isLoading } = useQuery<any[]>({
    queryKey: ['bloqueios-wms'],
    queryFn: async () => { const { data } = await api.get('/bloqueio-wms/bloqueios'); return data },
  })

  // Criar bloqueio
  const criarBloqueio = useMutation({
    mutationFn: async () => {
      const body: any = { nivel, tipo, motivo }
      if (depositoId) body.depositoId = depositoId
      if (zonaId) body.zonaId = zonaId
      if (rua) body.rua = rua
      if (predio) body.predio = predio
      if (codigoNivel) body.codigoNivel = codigoNivel
      if (produtoId) body.produtoId = produtoId
      if (lote) body.lote = lote
      const { data } = await api.post('/bloqueio-wms/bloqueios', body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloqueios-wms'] })
      setCriarModal(false)
      resetForm()
      notifications.show({ title: '🔒 Bloqueio criado', message: 'Movimentações bloqueadas no nível selecionado', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  // Liberar bloqueio
  const liberarBloqueio = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/bloqueio-wms/bloqueios/${id}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloqueios-wms'] })
      notifications.show({ title: '🔓 Bloqueio liberado', message: 'Movimentações liberadas', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  function resetForm() {
    setNivel(null); setTipo('MANUTENCAO'); setMotivo('')
    setDepositoId(''); setZonaId(''); setRua(''); setPredio('')
    setCodigoNivel(''); setProdutoId(''); setLote('')
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Bloqueios</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Bloqueios Hierárquicos & Quarentena</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCriarModal(true)}>
          Novo Bloqueio
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 4 }} mb="lg">
        <Card withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Bloqueios Ativos</Text>
              <Text size="xl" fw={700} c="red">{bloqueios.length}</Text>
            </div>
            <ThemeIcon color="red" variant="light" size={40} radius="md"><IconLock size={20} /></ThemeIcon>
          </Group>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Manutenção</Text>
          <Text size="xl" fw={700}>{bloqueios.filter((b: any) => b.tipo === 'MANUTENCAO').length}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Quarentena</Text>
          <Text size="xl" fw={700} c="yellow">{bloqueios.filter((b: any) => b.tipo === 'QUARENTENA').length}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Recall</Text>
          <Text size="xl" fw={700} c="red">{bloqueios.filter((b: any) => b.tipo === 'RECALL').length}</Text>
        </Card>
      </SimpleGrid>

      <Card>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nível</Table.Th>
              <Table.Th>Identificador</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Motivo</Table.Th>
              <Table.Th>Bloqueado em</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {bloqueios.map((b: any) => (
              <Table.Tr key={b.id}>
                <Table.Td><Badge variant="light">{b.nivel}</Badge></Table.Td>
                <Table.Td className="font-mono text-xs">
                  {b.depositoId || b.zonaId || b.rua || b.predio || b.codigoNivel || b.produtoId || b.lote || '—'}
                </Table.Td>
                <Table.Td><Badge color={tipoCores[b.tipo] || 'gray'}>{b.tipo}</Badge></Table.Td>
                <Table.Td>{b.motivo}</Table.Td>
                <Table.Td>{new Date(b.bloqueadoEm).toLocaleString('pt-BR')}</Table.Td>
                <Table.Td>
                  <Tooltip label="Liberar bloqueio">
                    <ActionIcon color="green" variant="light" onClick={() => liberarBloqueio.mutate(b.id)}
                      loading={liberarBloqueio.isPending}>
                      <IconLockOpen size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
            {bloqueios.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-8 text-zinc-500">
                  Nenhum bloqueio ativo
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Criar Bloqueio */}
      <Modal opened={criarModal} onClose={() => setCriarModal(false)} title="Novo Bloqueio Hierárquico" centered size="lg">
        <Select label="Nível do bloqueio" data={nivelOptions} value={nivel} onChange={setNivel} mb="sm" required />
        <Select label="Tipo" data={tipoOptions} value={tipo} onChange={setTipo} mb="sm" required />
        <TextInput label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} mb="sm" required
          placeholder="Ex: Manutenção elétrica na rua 03" />

        {nivel === 'DEPOSITO' && <TextInput label="ID do Depósito" value={depositoId} onChange={(e) => setDepositoId(e.target.value)} mb="sm" />}
        {nivel === 'ZONA' && <TextInput label="ID da Zona" value={zonaId} onChange={(e) => setZonaId(e.target.value)} mb="sm" />}
        {(nivel === 'RUA' || nivel === 'PREDIO') && <TextInput label="Rua" value={rua} onChange={(e) => setRua(e.target.value)} mb="sm" />}
        {nivel === 'PREDIO' && <TextInput label="Prédio" value={predio} onChange={(e) => setPredio(e.target.value)} mb="sm" />}
        {nivel === 'NIVEL' && <TextInput label="Código do Nível" value={codigoNivel} onChange={(e) => setCodigoNivel(e.target.value)} mb="sm" />}
        {(nivel === 'PRODUTO' || nivel === 'LOTE') && <TextInput label="ID do Produto" value={produtoId} onChange={(e) => setProdutoId(e.target.value)} mb="sm" />}
        {nivel === 'LOTE' && <TextInput label="Lote" value={lote} onChange={(e) => setLote(e.target.value)} mb="sm" />}

        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setCriarModal(false)}>Cancelar</Button>
          <Button color="red" leftSection={<IconLock size={16} />}
            onClick={() => criarBloqueio.mutate()} loading={criarBloqueio.isPending}
            disabled={!nivel || !tipo || motivo.length < 3}>
            Bloquear
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
