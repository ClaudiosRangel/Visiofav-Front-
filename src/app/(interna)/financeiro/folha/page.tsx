'use client'

import { useEffect, useState } from 'react'
import {
  Button, Card, Group, Text, TextInput, Table, Badge, Title, Stack,
  LoadingOverlay, Modal, ActionIcon, Tooltip,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconPlus, IconEye } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { api } from '@/lib/api'
import { formatarBRL, formatarCompetencia } from '@/lib/financeiro/format'
import { DetalheFolha } from './DetalheFolha'

const folhaApi = {
  listar: () => api.get('/financeiro/folha').then((r) => r.data),
  criar: (body: any) => api.post('/financeiro/folha', body).then((r) => r.data),
  detalhe: (id: string) => api.get(`/financeiro/folha/${id}`).then((r) => r.data),
  addItem: (id: string, body: any) => api.post(`/financeiro/folha/${id}/itens`, body).then((r) => r.data),
  removerItem: (id: string, itemId: string) => api.delete(`/financeiro/folha/${id}/itens/${itemId}`).then((r) => r.data),
  addEncargo: (id: string, body: any) => api.post(`/financeiro/folha/${id}/encargos`, body).then((r) => r.data),
  removerEncargo: (id: string, encargoId: string) => api.delete(`/financeiro/folha/${id}/encargos/${encargoId}`).then((r) => r.data),
  importarCsv: (id: string, conteudo: string) => api.post(`/financeiro/folha/${id}/importar-csv`, { conteudo }).then((r) => r.data),
  efetivar: (id: string) => api.post(`/financeiro/folha/${id}/efetivar`, {}).then((r) => r.data),
  funcionarios: () => api.get('/funcionarios', { params: { limit: 200 } }).then((r) => r.data),
}

function corStatus(status: string) {
  if (status === 'EFETIVADA') return 'green'
  if (status === 'CANCELADA') return 'gray'
  return 'blue'
}

export default function FolhaPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Folha de Pagamento' }, [])
  const qc = useQueryClient()
  const [modalNova, setModalNova] = useState(false)
  const [detalheId, setDetalheId] = useState<string | null>(null)

  const [formNova, setFormNova] = useState<any>({ competencia: '', descricao: '', dataPagamento: null as Date | null })

  const { data: folhas = [], isLoading } = useQuery<any[]>({ queryKey: ['fin-folhas'], queryFn: folhaApi.listar })

  const criar = useMutation({
    mutationFn: () => folhaApi.criar({
      competencia: formNova.competencia,
      descricao: formNova.descricao || undefined,
      dataPagamento: formNova.dataPagamento ? formNova.dataPagamento.toISOString() : undefined,
    }),
    onSuccess: (nova) => {
      notifications.show({ color: 'green', message: 'Folha criada' })
      setModalNova(false)
      setFormNova({ competencia: '', descricao: '', dataPagamento: null })
      qc.invalidateQueries({ queryKey: ['fin-folhas'] })
      if (nova?.id) setDetalheId(nova.id)
    },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro ao criar folha' }),
  })

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between">
        <div>
          <Title order={3}>Folha de Pagamento</Title>
          <Text size="sm" c="dimmed">Lance o resultado da folha do período — gera as contas a pagar dos funcionários e encargos.</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModalNova(true)}>Nova folha</Button>
      </Group>

      <Card withBorder padding="sm">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Competência</Table.Th>
              <Table.Th>Descrição</Table.Th>
              <Table.Th ta="right">Líquidos</Table.Th>
              <Table.Th ta="right">Encargos</Table.Th>
              <Table.Th ta="right">Total</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {folhas.map((f) => (
              <Table.Tr key={f.id}>
                <Table.Td fw={600}>{formatarCompetencia(f.competencia)}</Table.Td>
                <Table.Td>{f.descricao || '—'}</Table.Td>
                <Table.Td ta="right">{formatarBRL(Number(f.totalLiquido))}</Table.Td>
                <Table.Td ta="right">{formatarBRL(Number(f.totalEncargos))}</Table.Td>
                <Table.Td ta="right" fw={600}>{formatarBRL(Number(f.totalLiquido) + Number(f.totalEncargos))}</Table.Td>
                <Table.Td><Badge variant="light" color={corStatus(f.status)}>{f.status}</Badge></Table.Td>
                <Table.Td>
                  <Tooltip label="Abrir">
                    <ActionIcon variant="subtle" onClick={() => setDetalheId(f.id)}><IconEye size={16} /></ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
            {folhas.length === 0 && !isLoading && (
              <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center" py="md">Nenhuma folha. Crie a folha de uma competência para lançar os pagamentos.</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={modalNova} onClose={() => setModalNova(false)} title="Nova folha de pagamento" size="md">
        <Stack>
          <TextInput
            label="Competência (mês/ano)"
            placeholder="2026-09"
            description="Formato AAAA-MM"
            value={formNova.competencia}
            onChange={(e) => setFormNova((f: any) => ({ ...f, competencia: e.currentTarget.value }))}
            required
          />
          <TextInput
            label="Descrição (opcional)"
            placeholder="Folha mensal setembro/2026"
            value={formNova.descricao}
            onChange={(e) => setFormNova((f: any) => ({ ...f, descricao: e.currentTarget.value }))}
          />
          <DateInput
            label="Data de pagamento (opcional)"
            description="Vencimento dos títulos dos funcionários. Se vazio, usa o último dia da competência."
            value={formNova.dataPagamento}
            onChange={(v) => setFormNova((f: any) => ({ ...f, dataPagamento: v }))}
            valueFormat="DD/MM/YYYY"
          />
          <Button
            loading={criar.isPending}
            disabled={!/^\d{4}-(0[1-9]|1[0-2])$/.test(formNova.competencia)}
            onClick={() => criar.mutate()}
          >
            Criar folha
          </Button>
        </Stack>
      </Modal>

      <DetalheFolha
        folhaId={detalheId}
        onClose={() => setDetalheId(null)}
        funcionariosQuery={folhaApi.funcionarios}
      />
    </Stack>
  )
}
