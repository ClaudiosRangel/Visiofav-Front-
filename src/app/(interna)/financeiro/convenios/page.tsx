'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Group, Text, TextInput, Select, Table, Badge, Title, Stack, LoadingOverlay, Modal, ActionIcon, Tooltip, PasswordInput } from '@mantine/core'
import { IconPlus, IconBan } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { cobrancaApi, type Convenio } from '@/hooks/financeiro/useCobrancaApi'
import { financeiroApi, type ContaFinanceira } from '@/hooks/financeiro/useFinanceiroApi'

export default function ConveniosPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Convênios Bancários' }, [])
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>({ tipo: 'AMBOS', banco: '', agencia: '', conta: '', beneficiario: '', carteira: '', chavePix: '', clientSecret: '' })
  const [contaId, setContaId] = useState<string | null>(null)

  const { data: convenios = [], isLoading } = useQuery<Convenio[]>({ queryKey: ['cob-convenios'], queryFn: cobrancaApi.listarConvenios })
  const { data: contas = [] } = useQuery<ContaFinanceira[]>({ queryKey: ['fin-contas'], queryFn: financeiroApi.listarContas })

  const criar = useMutation({
    mutationFn: () => cobrancaApi.criarConvenio({ ...form, contaFinanceiraId: contaId }),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Convênio criado' }); setModal(false); qc.invalidateQueries({ queryKey: ['cob-convenios'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })
  const inativar = useMutation({
    mutationFn: (id: string) => cobrancaApi.inativarConvenio(id),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Inativado' }); qc.invalidateQueries({ queryKey: ['cob-convenios'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })

  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e?.currentTarget ? e.currentTarget.value : e }))

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between">
        <Title order={3}>Convênios Bancários</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModal(true)}>Novo convênio</Button>
      </Group>
      <Card withBorder padding="sm">
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Banco</Table.Th><Table.Th>Ag/Conta</Table.Th><Table.Th>Beneficiário</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Status</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {convenios.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.banco}</Table.Td><Table.Td>{c.agencia}/{c.conta}</Table.Td><Table.Td>{c.beneficiario}</Table.Td>
                <Table.Td><Badge variant="light">{c.tipo}</Badge></Table.Td>
                <Table.Td><Badge variant="light" color={c.status ? 'green' : 'gray'}>{c.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                <Table.Td>{c.status && <Tooltip label="Inativar"><ActionIcon variant="subtle" color="red" onClick={() => modals.openConfirmModal({ title: 'Inativar', children: <Text size="sm">Inativar convênio {c.banco}?</Text>, labels: { confirm: 'Inativar', cancel: 'Cancelar' }, confirmProps: { color: 'red' }, onConfirm: () => inativar.mutate(c.id) })}><IconBan size={16} /></ActionIcon></Tooltip>}</Table.Td>
              </Table.Tr>
            ))}
            {convenios.length === 0 && !isLoading && <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" ta="center" py="md">Nenhum convênio cadastrado</Text></Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>
      <Modal opened={modal} onClose={() => setModal(false)} title="Novo convênio bancário" size="lg">
        <Stack>
          <Select label="Conta financeira" data={contas.filter((c) => c.status).map((c) => ({ value: c.id, label: c.nome }))} value={contaId} onChange={setContaId} searchable required />
          <Select label="Tipo" data={[{ value: 'BOLETO', label: 'Boleto' }, { value: 'PIX', label: 'PIX' }, { value: 'AMBOS', label: 'Ambos' }]} value={form.tipo} onChange={(v) => setForm((f: any) => ({ ...f, tipo: v }))} />
          <Group grow>
            <TextInput label="Banco (código)" placeholder="341" value={form.banco} onChange={set('banco')} required />
            <TextInput label="Carteira" value={form.carteira} onChange={set('carteira')} />
          </Group>
          <Group grow>
            <TextInput label="Agência" value={form.agencia} onChange={set('agencia')} required />
            <TextInput label="Conta" value={form.conta} onChange={set('conta')} required />
          </Group>
          <TextInput label="Beneficiário" value={form.beneficiario} onChange={set('beneficiario')} required />
          {(form.tipo === 'PIX' || form.tipo === 'AMBOS') && (
            <>
              <TextInput label="Chave PIX" value={form.chavePix} onChange={set('chavePix')} />
              <PasswordInput label="Client Secret (PIX API)" value={form.clientSecret} onChange={set('clientSecret')} description="Armazenado criptografado" />
            </>
          )}
          <Button loading={criar.isPending} disabled={!contaId || !form.banco || !form.agencia || !form.conta || !form.beneficiario} onClick={() => criar.mutate()}>Salvar</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
