'use client'

import { useEffect, useState } from 'react'
import { ActionIcon, Badge, Tooltip, Modal, Table, Text, Button, Group, Stack, Loader } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Botão flutuante que pisca quando há pendências logísticas (SKU ou Dados Logísticos).
 * Ao clicar, abre modal com a lista de pendências.
 */
export default function PendenciasLogisticasButton() {
  const [modalOpen, setModalOpen] = useState(false)
  const [blink, setBlink] = useState(false)

  // Polling a cada 10 segundos
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ['pendencias-logisticas-count'],
    queryFn: async () => { const { data } = await api.get('/pendencias-logisticas/count'); return data },
    refetchInterval: 10000,
  })

  const { data: listData, isLoading } = useQuery<{ data: any[]; total: number }>({
    queryKey: ['pendencias-logisticas-list'],
    queryFn: async () => { const { data } = await api.get('/pendencias-logisticas/?status=PENDENTE'); return data },
    enabled: modalOpen,
  })

  const count = countData?.count || 0

  // Efeito de piscar quando há pendências
  useEffect(() => {
    if (count === 0) { setBlink(false); return }
    const interval = setInterval(() => setBlink((b) => !b), 800)
    return () => clearInterval(interval)
  }, [count])

  if (count === 0) return null

  return (
    <>
      <Tooltip label={`${count} pendência(s) logística(s)`}>
        <ActionIcon
          variant="filled"
          color={blink ? 'red' : 'orange'}
          size="xl"
          radius="xl"
          onClick={() => setModalOpen(true)}
          style={{
            position: 'fixed',
            // Empilhado acima do botão flutuante do Vizor AI (ChatWidget,
            // mesmo bottom/right, zIndex 9999) — antes os dois ocupavam a
            // mesma posição e este ficava escondido atrás do botão da IA.
            bottom: 92,
            right: 24,
            zIndex: 1000,
            width: 56,
            height: 56,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'background-color 0.3s',
          }}
        >
          <div style={{ position: 'relative' }}>
            <IconAlertTriangle size={28} />
            <Badge
              size="xs"
              color="red"
              variant="filled"
              style={{ position: 'absolute', top: -8, right: -10, minWidth: 18 }}
            >
              {count}
            </Badge>
          </div>
        </ActionIcon>
      </Tooltip>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Pendências Logísticas" size="lg">
        <Text size="sm" c="dimmed" mb="md">
          Itens que precisam de SKU ou Dados Logísticos configurados antes de seguir para conferência.
        </Text>

        {isLoading ? (
          <Group justify="center" py="xl"><Loader /></Group>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Descrição</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Fornecedor</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(listData?.data || []).map((p: any) => (
                <Table.Tr key={p.id}>
                  <Table.Td><Text size="sm" fw={500}>{p.codigoProduto}</Text></Table.Td>
                  <Table.Td><Text size="sm">{p.descricaoProduto}</Text></Table.Td>
                  <Table.Td>
                    <Badge color={p.tipo === 'SKU' ? 'blue' : 'grape'} variant="light" size="sm">
                      {p.tipo === 'SKU' ? 'SKU' : 'Dados Log.'}
                    </Badge>
                  </Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{p.fornecedor || '—'}</Text></Table.Td>
                </Table.Tr>
              ))}
              {(listData?.data || []).length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4} className="text-center py-4 text-zinc-500">Nenhuma pendência</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}

        <Group justify="space-between" mt="md">
          <Text size="xs" c="dimmed">Configure SKU e Dados Logísticos em Cadastros → Produtos</Text>
          <Button variant="default" onClick={() => setModalOpen(false)}>Fechar</Button>
        </Group>
      </Modal>
    </>
  )
}
