'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, Title, Stack, LoadingOverlay, Modal, ActionIcon, Tooltip } from '@mantine/core'
import { IconLock, IconLockOpen } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { api } from '@/lib/api'
import { formatarCompetencia, formatarData } from '@/lib/financeiro/format'

const fechApi = {
  listar: () => api.get('/financeiro/fechamentos').then((r) => r.data),
  fechar: (competencia: string) => api.post('/financeiro/fechamentos/fechar', { competencia }).then((r) => r.data),
  reabrir: (competencia: string, motivo: string) => api.post('/financeiro/fechamentos/reabrir', { competencia, motivo }).then((r) => r.data),
}

export default function FechamentoPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Fechamento' }, [])
  const qc = useQueryClient()
  const [competencia, setCompetencia] = useState('')
  const [reabrirModal, setReabrirModal] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  const { data: fechamentos = [], isLoading } = useQuery<any[]>({ queryKey: ['fin-fechamentos'], queryFn: fechApi.listar })

  const fechar = useMutation({
    mutationFn: () => fechApi.fechar(competencia),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Período fechado' }); setCompetencia(''); qc.invalidateQueries({ queryKey: ['fin-fechamentos'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })
  const reabrir = useMutation({
    mutationFn: () => fechApi.reabrir(reabrirModal!, motivo),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Período reaberto' }); setReabrirModal(null); setMotivo(''); qc.invalidateQueries({ queryKey: ['fin-fechamentos'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Title order={3}>Fechamento de Período</Title>
      <Card withBorder padding="sm">
        <Group align="end">
          <TextInput label="Competência (AAAA-MM)" placeholder="2026-06" value={competencia} onChange={(e) => setCompetencia(e.currentTarget.value)} w={200} />
          <Button leftSection={<IconLock size={16} />} loading={fechar.isPending} disabled={!/^\d{4}-\d{2}$/.test(competencia)} onClick={() => fechar.mutate()}>Fechar período</Button>
        </Group>
      </Card>
      <Card withBorder padding="sm">
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Competência</Table.Th><Table.Th>Status</Table.Th><Table.Th>Fechado em</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {fechamentos.map((f) => (
              <Table.Tr key={f.id}>
                <Table.Td>{formatarCompetencia(f.competencia)}</Table.Td>
                <Table.Td><Badge variant="light" color={f.aberto ? 'green' : 'red'}>{f.aberto ? 'Reaberto' : 'Fechado'}</Badge></Table.Td>
                <Table.Td>{f.fechadoEm ? formatarData(f.fechadoEm) : '—'}</Table.Td>
                <Table.Td>{!f.aberto && <Tooltip label="Reabrir"><ActionIcon variant="subtle" color="orange" onClick={() => setReabrirModal(f.competencia)}><IconLockOpen size={16} /></ActionIcon></Tooltip>}</Table.Td>
              </Table.Tr>
            ))}
            {fechamentos.length === 0 && !isLoading && <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center" py="md">Nenhum período fechado</Text></Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>
      <Modal opened={Boolean(reabrirModal)} onClose={() => setReabrirModal(null)} title={`Reabrir ${reabrirModal}`}>
        <Stack>
          <TextInput label="Motivo" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} required />
          <Button color="orange" loading={reabrir.isPending} disabled={!motivo} onClick={() => reabrir.mutate()}>Reabrir período</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
