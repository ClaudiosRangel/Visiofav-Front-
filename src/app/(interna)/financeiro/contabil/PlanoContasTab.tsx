'use client'

import { useState } from 'react'
import {
  Button, Card, Group, Text, TextInput, Select, Table, Badge, Stack, Modal, LoadingOverlay, Checkbox,
} from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const contabilApi = {
  listar: () => api.get('/financeiro/contabil/contas').then((r) => r.data),
  criar: (body: any) => api.post('/financeiro/contabil/contas', body).then((r) => r.data),
}

const NATUREZAS = [{ value: 'DEVEDORA', label: 'Devedora' }, { value: 'CREDORA', label: 'Credora' }]
const GRUPOS = [
  { value: 'ATIVO', label: 'Ativo' }, { value: 'PASSIVO', label: 'Passivo' },
  { value: 'PATRIMONIO', label: 'Patrimônio Líquido' }, { value: 'RECEITA', label: 'Receita' },
  { value: 'DESPESA', label: 'Despesa' },
]

export function PlanoContasTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>({ codigo: '', nome: '', natureza: 'DEVEDORA', grupo: 'ATIVO', paiId: null, analitica: true })

  const { data: contas = [], isLoading } = useQuery<any[]>({ queryKey: ['contabil-contas'], queryFn: contabilApi.listar })

  const criar = useMutation({
    mutationFn: () => contabilApi.criar({
      codigo: form.codigo, nome: form.nome, natureza: form.natureza, grupo: form.grupo,
      paiId: form.paiId || undefined, analitica: form.analitica,
    }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Conta criada' })
      setModal(false); setForm({ codigo: '', nome: '', natureza: 'DEVEDORA', grupo: 'ATIVO', paiId: null, analitica: true })
      qc.invalidateQueries({ queryKey: ['contabil-contas'] })
    },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between">
        <Text fw={600}>Plano de Contas Contábil</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModal(true)}>Nova conta</Button>
      </Group>

      <Card withBorder padding="sm">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Grupo</Table.Th>
              <Table.Th>Natureza</Table.Th>
              <Table.Th>Tipo</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {contas.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td ff="monospace">{c.codigo}</Table.Td>
                <Table.Td>{c.nome}</Table.Td>
                <Table.Td><Badge variant="light">{c.grupo}</Badge></Table.Td>
                <Table.Td>{c.natureza === 'DEVEDORA' ? 'Devedora' : 'Credora'}</Table.Td>
                <Table.Td><Badge variant="light" color={c.analitica ? 'blue' : 'gray'}>{c.analitica ? 'Analítica' : 'Sintética'}</Badge></Table.Td>
              </Table.Tr>
            ))}
            {contas.length === 0 && !isLoading && (
              <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="md">Nenhuma conta. Cadastre o plano de contas para lançar a contabilidade.</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={modal} onClose={() => setModal(false)} title="Nova conta contábil" size="md">
        <Stack>
          <TextInput label="Código" placeholder="1.1.01.001" value={form.codigo} onChange={(e) => setForm((f: any) => ({ ...f, codigo: e.currentTarget.value }))} required />
          <TextInput label="Nome" placeholder="Banco Conta Movimento" value={form.nome} onChange={(e) => setForm((f: any) => ({ ...f, nome: e.currentTarget.value }))} required />
          <Group grow>
            <Select label="Grupo" data={GRUPOS} value={form.grupo} onChange={(v) => setForm((f: any) => ({ ...f, grupo: v }))} />
            <Select label="Natureza" data={NATUREZAS} value={form.natureza} onChange={(v) => setForm((f: any) => ({ ...f, natureza: v }))} />
          </Group>
          <Select label="Conta pai (opcional)" placeholder="Nenhuma" data={contas.map((c) => ({ value: c.id, label: `${c.codigo} — ${c.nome}` }))} value={form.paiId} onChange={(v) => setForm((f: any) => ({ ...f, paiId: v }))} searchable clearable />
          <Checkbox label="Conta analítica (recebe lançamentos)" checked={form.analitica} onChange={(e) => setForm((f: any) => ({ ...f, analitica: e.currentTarget.checked }))} />
          <Button loading={criar.isPending} disabled={!form.codigo || !form.nome} onClick={() => criar.mutate()}>Criar conta</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
