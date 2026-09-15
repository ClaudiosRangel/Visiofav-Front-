'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, Title, Stack, LoadingOverlay, Modal, ActionIcon, Tooltip } from '@mantine/core'
import { IconPlus, IconBan } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { financeiroApi, type CentroCusto } from '@/hooks/financeiro/useFinanceiroApi'

export default function CentrosCustoPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Centros de Custo' }, [])
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')

  const { data: centros = [], isLoading } = useQuery<CentroCusto[]>({ queryKey: ['fin-centros'], queryFn: financeiroApi.listarCentrosCusto })

  const criar = useMutation({
    mutationFn: () => financeiroApi.criarCentroCusto({ codigo, nome }),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Centro criado' }); setModal(false); setCodigo(''); setNome(''); qc.invalidateQueries({ queryKey: ['fin-centros'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })
  const inativar = useMutation({
    mutationFn: (id: string) => financeiroApi.inativarCentroCusto(id),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Inativado' }); qc.invalidateQueries({ queryKey: ['fin-centros'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between">
        <Title order={3}>Centros de Custo</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModal(true)}>Novo centro</Button>
      </Group>
      <Card withBorder padding="sm">
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Nome</Table.Th><Table.Th>Status</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {centros.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.codigo}</Table.Td><Table.Td>{c.nome}</Table.Td>
                <Table.Td><Badge variant="light" color={c.status ? 'green' : 'gray'}>{c.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                <Table.Td>{c.status && <Tooltip label="Inativar"><ActionIcon variant="subtle" color="red" onClick={() => modals.openConfirmModal({ title: 'Inativar', children: <Text size="sm">Inativar "{c.nome}"?</Text>, labels: { confirm: 'Inativar', cancel: 'Cancelar' }, confirmProps: { color: 'red' }, onConfirm: () => inativar.mutate(c.id) })}><IconBan size={16} /></ActionIcon></Tooltip>}</Table.Td>
              </Table.Tr>
            ))}
            {centros.length === 0 && !isLoading && <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center" py="md">Nenhum centro de custo</Text></Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>
      <Modal opened={modal} onClose={() => setModal(false)} title="Novo centro de custo">
        <Stack>
          <TextInput label="Código" value={codigo} onChange={(e) => setCodigo(e.currentTarget.value)} required />
          <TextInput label="Nome" value={nome} onChange={(e) => setNome(e.currentTarget.value)} required />
          <Button loading={criar.isPending} disabled={!codigo || !nome} onClick={() => criar.mutate()}>Salvar</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
