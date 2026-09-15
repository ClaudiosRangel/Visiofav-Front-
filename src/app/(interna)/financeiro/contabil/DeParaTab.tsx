'use client'

import { useMemo, useState } from 'react'
import {
  Button, Card, Group, Text, Select, Table, Stack, Modal, LoadingOverlay, Badge, Alert,
} from '@mantine/core'
import { IconEdit, IconInfoCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const depara = {
  categorias: () => api.get('/financeiro/categorias').then((r) => r.data),
  contas: () => api.get('/financeiro/contabil/contas').then((r) => r.data),
  mapeamentos: () => api.get('/financeiro/contabil/mapeamentos').then((r) => r.data),
  salvar: (categoriaId: string, body: any) => api.put(`/financeiro/contabil/mapeamentos/${categoriaId}`, body).then((r) => r.data),
}

export function DeParaTab() {
  const qc = useQueryClient()
  const [editando, setEditando] = useState<any | null>(null)
  const [form, setForm] = useState<any>({ provisaoDebitoId: null, provisaoCreditoId: null, liquidacaoDebitoId: null, liquidacaoCreditoId: null })

  const { data: categorias = [], isLoading: loadingCat } = useQuery<any[]>({ queryKey: ['fin-categorias'], queryFn: depara.categorias })
  const { data: contas = [] } = useQuery<any[]>({ queryKey: ['contabil-contas'], queryFn: depara.contas })
  const { data: mapeamentos = [], isLoading: loadingMap } = useQuery<any[]>({ queryKey: ['contabil-mapeamentos'], queryFn: depara.mapeamentos })

  const contasAnaliticas = useMemo(() => contas.filter((c) => c.analitica).map((c) => ({ value: c.id, label: `${c.codigo} — ${c.nome}` })), [contas])
  const mapPorCategoria = useMemo(() => new Map(mapeamentos.map((m) => [m.categoriaId, m])), [mapeamentos])
  const contaLabel = (id?: string) => (id ? contasAnaliticas.find((c) => c.value === id)?.label ?? '—' : '—')

  const abrir = (categoria: any) => {
    const m = mapPorCategoria.get(categoria.id)
    setForm({
      provisaoDebitoId: m?.provisaoDebitoId ?? null,
      provisaoCreditoId: m?.provisaoCreditoId ?? null,
      liquidacaoDebitoId: m?.liquidacaoDebitoId ?? null,
      liquidacaoCreditoId: m?.liquidacaoCreditoId ?? null,
    })
    setEditando(categoria)
  }

  const salvar = useMutation({
    mutationFn: () => depara.salvar(editando.id, {
      provisaoDebitoId: form.provisaoDebitoId || undefined,
      provisaoCreditoId: form.provisaoCreditoId || undefined,
      liquidacaoDebitoId: form.liquidacaoDebitoId || undefined,
      liquidacaoCreditoId: form.liquidacaoCreditoId || undefined,
    }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'De/para salvo' })
      setEditando(null)
      qc.invalidateQueries({ queryKey: ['contabil-mapeamentos'] })
    },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={loadingCat || loadingMap} />
      <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
        O de/para liga cada categoria financeira às contas contábeis de débito e crédito. Quando configurado, os lançamentos de provisão (na inclusão do título) e de liquidação (na baixa) são gerados automaticamente.
      </Alert>

      <Card withBorder padding="sm">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Categoria</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Provisão (D / C)</Table.Th>
              <Table.Th>Liquidação (D / C)</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {categorias.map((cat) => {
              const m = mapPorCategoria.get(cat.id)
              const configurado = m && (m.provisaoDebitoId || m.liquidacaoDebitoId)
              return (
                <Table.Tr key={cat.id}>
                  <Table.Td>{cat.nome}</Table.Td>
                  <Table.Td><Badge variant="light" color={cat.tipo === 'RECEITA' ? 'green' : 'orange'}>{cat.tipo}</Badge></Table.Td>
                  <Table.Td><Text size="xs">{contaLabel(m?.provisaoDebitoId)} / {contaLabel(m?.provisaoCreditoId)}</Text></Table.Td>
                  <Table.Td><Text size="xs">{contaLabel(m?.liquidacaoDebitoId)} / {contaLabel(m?.liquidacaoCreditoId)}</Text></Table.Td>
                  <Table.Td>
                    <Button size="xs" variant={configurado ? 'light' : 'filled'} leftSection={<IconEdit size={14} />} onClick={() => abrir(cat)}>
                      {configurado ? 'Editar' : 'Configurar'}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              )
            })}
            {categorias.length === 0 && !loadingCat && (
              <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="md">Nenhuma categoria financeira. Cadastre categorias em Financeiro → Categorias.</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={!!editando} onClose={() => setEditando(null)} title={editando ? `De/para — ${editando.nome}` : ''} size="lg">
        {editando && (
          <Stack>
            <Text fw={600} size="sm">Provisão (competência)</Text>
            <Group grow>
              <Select label="Conta débito" data={contasAnaliticas} value={form.provisaoDebitoId} onChange={(v) => setForm((f: any) => ({ ...f, provisaoDebitoId: v }))} searchable clearable />
              <Select label="Conta crédito" data={contasAnaliticas} value={form.provisaoCreditoId} onChange={(v) => setForm((f: any) => ({ ...f, provisaoCreditoId: v }))} searchable clearable />
            </Group>
            <Text fw={600} size="sm" mt="xs">Liquidação (pagamento/recebimento)</Text>
            <Group grow>
              <Select label="Conta débito" data={contasAnaliticas} value={form.liquidacaoDebitoId} onChange={(v) => setForm((f: any) => ({ ...f, liquidacaoDebitoId: v }))} searchable clearable />
              <Select label="Conta crédito" data={contasAnaliticas} value={form.liquidacaoCreditoId} onChange={(v) => setForm((f: any) => ({ ...f, liquidacaoCreditoId: v }))} searchable clearable />
            </Group>
            <Button color="green" loading={salvar.isPending} onClick={() => salvar.mutate()}>Salvar de/para</Button>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
