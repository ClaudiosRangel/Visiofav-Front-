'use client'

import { useState, useEffect } from 'react'
import { Button, Card, Group, Text, Select, NumberInput, Table, ActionIcon, Tooltip } from '@mantine/core'
import { IconArrowLeft, IconPlus, IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter } from 'next/navigation'

interface ItemTransf { produtoId: string; quantidade: number }

export default function TransferenciasPage() {
  useModuloGuard('COMPRAS')
  useEffect(() => { document.title = 'Vizor - Compras - Transferências' }, [])
  const router = useRouter()
  const [empresaDestinoId, setEmpresaDestinoId] = useState<string | null>(null)
  const [itens, setItens] = useState<ItemTransf[]>([{ produtoId: '', quantidade: 1 }])

  const { data: empresasData } = useQuery<any[]>({
    queryKey: ['empresas-minhas'],
    queryFn: async () => { const { data } = await api.get('/empresas/minhas'); return data },
  })

  const { data: produtosData } = useQuery<any>({
    queryKey: ['produtos-select'],
    queryFn: async () => { const { data } = await api.get('/produtos', { params: { limit: 200, status: 'true' } }); return data },
  })

  const transferir = useMutation({
    mutationFn: async () => {
      if (!empresaDestinoId) throw new Error('Selecione a empresa destino')
      const itensValidos = itens.filter((i) => i.produtoId && i.quantidade > 0)
      if (itensValidos.length === 0) throw new Error('Adicione ao menos um item')
      const { data } = await api.post('/compras/transferir', { empresaDestinoId, itens: itensValidos })
      return data
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Transferência realizada', color: 'green' })
      setEmpresaDestinoId(null)
      setItens([{ produtoId: '', quantidade: 1 }])
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  const empresaOptions = (empresasData || []).map((e: any) => ({ value: e.id, label: `${e.razaoSocial} (${e.cnpj})` }))
  const produtoOptions = (produtosData?.data || []).map((p: any) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }))

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Compras / Transferências</Text>
      <Group mb="lg">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/compras/pedidos')}>Voltar</Button>
        <Text size="xl" fw={600}>Transferência entre Empresas</Text>
      </Group>

      <Card mb="md">
        <Select
          label="Empresa Destino"
          placeholder="Selecione a empresa de destino"
          data={empresaOptions}
          value={empresaDestinoId}
          onChange={setEmpresaDestinoId}
          searchable
          className="max-w-lg"
        />
      </Card>

      <Card mb="md">
        <Group justify="space-between" mb="sm">
          <Text fw={500}>Itens</Text>
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setItens([...itens, { produtoId: '', quantidade: 1 }])}>
            Adicionar Item
          </Button>
        </Group>

        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th className="w-40">Quantidade</Table.Th>
              <Table.Th className="w-16"></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {itens.map((item, idx) => (
              <Table.Tr key={idx}>
                <Table.Td>
                  <Select
                    data={produtoOptions}
                    searchable
                    value={item.produtoId || null}
                    onChange={(val) => { const n = [...itens]; n[idx] = { ...n[idx], produtoId: val || '' }; setItens(n) }}
                    size="xs"
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    min={0.0001}
                    decimalScale={4}
                    value={item.quantidade}
                    onChange={(val) => { const n = [...itens]; n[idx] = { ...n[idx], quantidade: typeof val === 'number' ? val : 0 }; setItens(n) }}
                    size="xs"
                  />
                </Table.Td>
                <Table.Td>
                  {itens.length > 1 && (
                    <Tooltip label="Remover">
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => setItens(itens.filter((_, i) => i !== idx))}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Group justify="flex-end">
        <Button variant="default" onClick={() => router.push('/compras/pedidos')}>Cancelar</Button>
        <Button onClick={() => transferir.mutate()} loading={transferir.isPending}>Confirmar Transferência</Button>
      </Group>
    </div>
  )
}
