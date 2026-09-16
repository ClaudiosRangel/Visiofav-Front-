'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Group, Text, TextInput, Select, Table, Badge, Title, Stack, LoadingOverlay, Modal, ActionIcon, Tooltip } from '@mantine/core'
import { IconPlus, IconBan, IconListTree } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { financeiroApi, type CategoriaFinanceira } from '@/hooks/financeiro/useFinanceiroApi'

export default function CategoriasPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Categorias' }, [])
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [tipo, setTipo] = useState<string | null>('DESPESA')
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')

  const { data: cats = [], isLoading } = useQuery<CategoriaFinanceira[]>({ queryKey: ['fin-categorias'], queryFn: financeiroApi.listarCategorias })

  const criar = useMutation({
    mutationFn: () => financeiroApi.criarCategoria({ tipo: tipo!, codigo, nome }),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Categoria criada' }); setModal(false); setCodigo(''); setNome(''); qc.invalidateQueries({ queryKey: ['fin-categorias'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })
  const inativar = useMutation({
    mutationFn: (id: string) => financeiroApi.inativarCategoria(id),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Inativada' }); qc.invalidateQueries({ queryKey: ['fin-categorias'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })
  const popularPadrao = useMutation({
    mutationFn: () => financeiroApi.popularPlanoPadrao(),
    onSuccess: (r: any) => { notifications.show({ color: 'green', message: `Plano padrão aplicado: ${r?.criadas ?? 0} categoria(s) criada(s)` }); qc.invalidateQueries({ queryKey: ['fin-categorias'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between">
        <Title order={3}>Categorias (Plano de Contas)</Title>
        <Group>
          <Tooltip label="Cria o plano de contas gerencial padrão brasileiro (não duplica os que já existem)">
            <Button
              variant="light"
              leftSection={<IconListTree size={16} />}
              loading={popularPadrao.isPending}
              onClick={() => modals.openConfirmModal({
                title: 'Usar plano de contas padrão',
                children: <Text size="sm">Vamos criar o plano de contas gerencial padrão (Receitas, Custos, Despesas Operacionais, Pessoal, Financeiras, etc.). Categorias com código já existente não são duplicadas. Deseja continuar?</Text>,
                labels: { confirm: 'Aplicar plano padrão', cancel: 'Cancelar' },
                onConfirm: () => popularPadrao.mutate(),
              })}
            >
              Usar plano padrão
            </Button>
          </Tooltip>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModal(true)}>Nova categoria</Button>
        </Group>
      </Group>
      <Card withBorder padding="sm">
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Nome</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Status</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {cats.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.codigo}</Table.Td><Table.Td>{c.nome}</Table.Td>
                <Table.Td><Badge variant="light" color={c.tipo === 'RECEITA' ? 'green' : 'red'}>{c.tipo}</Badge></Table.Td>
                <Table.Td><Badge variant="light" color={c.status ? 'green' : 'gray'}>{c.status ? 'Ativa' : 'Inativa'}</Badge></Table.Td>
                <Table.Td>{c.status && <Tooltip label="Inativar"><ActionIcon variant="subtle" color="red" onClick={() => modals.openConfirmModal({ title: 'Inativar', children: <Text size="sm">Inativar "{c.nome}"?</Text>, labels: { confirm: 'Inativar', cancel: 'Cancelar' }, confirmProps: { color: 'red' }, onConfirm: () => inativar.mutate(c.id) })}><IconBan size={16} /></ActionIcon></Tooltip>}</Table.Td>
              </Table.Tr>
            ))}
            {cats.length === 0 && !isLoading && <Table.Tr><Table.Td colSpan={5}><Stack align="center" py="md" gap={4}><Text c="dimmed">Nenhuma categoria cadastrada</Text><Text size="sm" c="dimmed">Clique em "Usar plano padrão" para começar com o plano de contas gerencial brasileiro.</Text></Stack></Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>
      <Modal opened={modal} onClose={() => setModal(false)} title="Nova categoria">
        <Stack>
          <Select label="Tipo" data={[{ value: 'RECEITA', label: 'Receita' }, { value: 'DESPESA', label: 'Despesa' }]} value={tipo} onChange={setTipo} />
          <TextInput label="Código" value={codigo} onChange={(e) => setCodigo(e.currentTarget.value)} required />
          <TextInput label="Nome" value={nome} onChange={(e) => setNome(e.currentTarget.value)} required />
          <Button loading={criar.isPending} disabled={!codigo || !nome} onClick={() => criar.mutate()}>Salvar</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
