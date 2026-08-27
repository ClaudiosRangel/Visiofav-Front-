'use client'

import { useState, useEffect } from 'react'
import { Card, Group, Text, Table, Badge, Button, Select, TextInput, Modal, ActionIcon, Tooltip, SimpleGrid, ThemeIcon } from '@mantine/core'
import { IconLock, IconLockOpen, IconPlus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

function wmsHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('wms-token')}`, 'Content-Type': 'application/json' }
}

const tipoCores: Record<string, string> = {
  MANUTENCAO: 'blue', INVENTARIO: 'orange', QUARENTENA: 'yellow', RECALL: 'red', AVARIA: 'grape', OUTRO: 'gray',
}

export default function BloqueiosStandalonePage() {
  useEffect(() => { document.title = 'Vizor WMS - Bloqueios' }, [])
  const queryClient = useQueryClient()
  const [criarModal, setCriarModal] = useState(false)
  const [nivel, setNivel] = useState<string | null>(null)
  const [tipo, setTipo] = useState<string | null>('MANUTENCAO')
  const [motivo, setMotivo] = useState('')
  const [rua, setRua] = useState('')

  const { data: bloqueios = [] } = useQuery<any[]>({
    queryKey: ['wms-standalone', 'bloqueios'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/bloqueio-wms/bloqueios`, { headers: wmsHeaders() })
      if (!res.ok) return []
      return res.json()
    },
  })

  const criarBloqueio = useMutation({
    mutationFn: async () => {
      const body: any = { nivel, tipo, motivo }
      if (rua) body.rua = rua
      const res = await fetch(`${API_URL}/bloqueio-wms/bloqueios`, { method: 'POST', headers: wmsHeaders(), body: JSON.stringify(body) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.message) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wms-standalone', 'bloqueios'] })
      setCriarModal(false); setMotivo(''); setRua('')
      notifications.show({ title: '🔒 Bloqueio criado', message: 'Movimentações bloqueadas', color: 'green' })
    },
    onError: (err: any) => notifications.show({ title: 'Erro', message: err.message, color: 'red' }),
  })

  const liberarBloqueio = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/bloqueio-wms/bloqueios/${id}`, { method: 'DELETE', headers: wmsHeaders() })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wms-standalone', 'bloqueios'] })
      notifications.show({ title: '🔓 Liberado', message: 'Bloqueio removido', color: 'green' })
    },
  })

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <div>
          <Text size="xs" c="dimmed" mb={4}>WMS / Bloqueios</Text>
          <Text size="xl" fw={600}>Bloqueios & Quarentena</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCriarModal(true)}>Novo Bloqueio</Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <Card withBorder>
          <Group justify="space-between">
            <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Ativos</Text><Text size="xl" fw={700} c="red">{bloqueios.length}</Text></div>
            <ThemeIcon color="red" variant="light" size={40} radius="md"><IconLock size={20} /></ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      <Card>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nível</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Motivo</Table.Th><Table.Th>Data</Table.Th><Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {bloqueios.map((b: any) => (
              <Table.Tr key={b.id}>
                <Table.Td><Badge variant="light">{b.nivel}</Badge></Table.Td>
                <Table.Td><Badge color={tipoCores[b.tipo] || 'gray'}>{b.tipo}</Badge></Table.Td>
                <Table.Td>{b.motivo}</Table.Td>
                <Table.Td>{new Date(b.bloqueadoEm).toLocaleString('pt-BR')}</Table.Td>
                <Table.Td>
                  <Tooltip label="Liberar"><ActionIcon color="green" variant="light" onClick={() => liberarBloqueio.mutate(b.id)}><IconLockOpen size={16} /></ActionIcon></Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
            {bloqueios.length === 0 && <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum bloqueio ativo</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={criarModal} onClose={() => setCriarModal(false)} title="Novo Bloqueio" centered>
        <Select label="Nível" data={[{value:'DEPOSITO',label:'Depósito'},{value:'ZONA',label:'Zona'},{value:'RUA',label:'Rua'},{value:'PREDIO',label:'Prédio'},{value:'PRODUTO',label:'Produto'},{value:'LOTE',label:'Lote'}]} value={nivel} onChange={setNivel} mb="sm" />
        <Select label="Tipo" data={[{value:'MANUTENCAO',label:'Manutenção'},{value:'INVENTARIO',label:'Inventário'},{value:'QUARENTENA',label:'Quarentena'},{value:'RECALL',label:'Recall'},{value:'AVARIA',label:'Avaria'}]} value={tipo} onChange={setTipo} mb="sm" />
        <TextInput label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} mb="sm" required />
        {nivel === 'RUA' && <TextInput label="Rua" value={rua} onChange={(e) => setRua(e.target.value)} mb="sm" />}
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setCriarModal(false)}>Cancelar</Button>
          <Button color="red" leftSection={<IconLock size={16} />} onClick={() => criarBloqueio.mutate()} disabled={!nivel || !tipo || motivo.length < 3}>Bloquear</Button>
        </Group>
      </Modal>
    </div>
  )
}
