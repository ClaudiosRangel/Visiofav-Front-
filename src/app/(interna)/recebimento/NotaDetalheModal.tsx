'use client'

import { Modal, Text, Table, Badge, Group, Tabs, LoadingOverlay } from '@mantine/core'
import { useNotaEntradaById } from '@/data/hooks/useNotaEntrada'

const statusColor: Record<string, string> = { PENDENTE: 'orange', CONFERIDA: 'blue', ENDERECADA: 'green', CANCELADA: 'red' }

interface Props { notaId: string | null; onClose: () => void }

export default function NotaDetalheModal({ notaId, onClose }: Props) {
  const { data: nota, isLoading } = useNotaEntradaById(notaId)

  return (
    <Modal opened={!!notaId} onClose={onClose} title={`Nota Fiscal ${nota?.numero || ''}`} size="xl" centered>
      <div style={{ position: 'relative', minHeight: 200 }}>
        <LoadingOverlay visible={isLoading} />
        {nota && (
          <div>
            <Group mb="md" gap="xl">
              <div><Text size="xs" c="dimmed">Número</Text><Text fw={600}>{nota.numero}</Text></div>
              <div><Text size="xs" c="dimmed">Série</Text><Text>{nota.serie || '-'}</Text></div>
              <div><Text size="xs" c="dimmed">Fornecedor</Text><Text>{nota.fornecedor || '-'}</Text></div>
              <div><Text size="xs" c="dimmed">Tipo</Text><Badge color="primary" variant="light">{nota.tipo}</Badge></div>
              <div><Text size="xs" c="dimmed">Status</Text><Badge color={statusColor[nota.status]} variant="light">{nota.status}</Badge></div>
              <div><Text size="xs" c="dimmed">Entrada</Text><Text>{nota.dataEntrada ? new Date(nota.dataEntrada).toLocaleDateString('pt-BR') : '-'}</Text></div>
            </Group>

            <Tabs defaultValue="itens">
              <Tabs.List mb="md">
                <Tabs.Tab value="itens">Itens ({(nota as any).itens?.length || 0})</Tabs.Tab>
                <Tabs.Tab value="conferencias">Conferências ({(nota as any).conferencias?.length || 0})</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="itens">
                <Table striped>
                  <Table.Thead><Table.Tr><Table.Th>Item</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Cód. Produto</Table.Th><Table.Th>Unidade</Table.Th><Table.Th>Quantidade</Table.Th><Table.Th>Lote</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {((nota as any).itens || []).map((item: any) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>{item.item}</Table.Td>
                        <Table.Td>{item.descricao}</Table.Td>
                        <Table.Td className="text-sm text-zinc-500">{item.codigoProduto || '-'}</Table.Td>
                        <Table.Td>{item.unidade}</Table.Td>
                        <Table.Td><Text fw={600}>{item.quantidade}</Text></Table.Td>
                        <Table.Td>{item.lote || '-'}</Table.Td>
                      </Table.Tr>
                    ))}
                    {((nota as any).itens || []).length === 0 && <Table.Tr><Table.Td colSpan={6} className="text-center py-4 text-zinc-500">Nenhum item</Table.Td></Table.Tr>}
                  </Table.Tbody>
                </Table>
              </Tabs.Panel>

              <Tabs.Panel value="conferencias">
                {((nota as any).conferencias || []).length === 0 ? (
                  <Text c="dimmed" className="text-center py-4">Nenhuma conferência realizada</Text>
                ) : (
                  ((nota as any).conferencias || []).map((conf: any) => (
                    <div key={conf.id} className="mb-4 p-3 border border-gray-200 rounded-md">
                      <Group mb="sm">
                        <Text size="sm" fw={600}>Conferência #{conf.codigo}</Text>
                        <Badge color="primary" variant="light">{conf.tipo}</Badge>
                        <Badge color={conf.status === 'CONCLUIDA' ? 'green' : 'blue'} variant="light">{conf.status}</Badge>
                        <Text size="xs" c="dimmed">Conferente: {conf.conferente?.nome}</Text>
                      </Group>
                      <Table size="sm">
                        <Table.Thead><Table.Tr><Table.Th>Item</Table.Th><Table.Th>Produto</Table.Th><Table.Th>Qtd</Table.Th><Table.Th>Divergência</Table.Th></Table.Tr></Table.Thead>
                        <Table.Tbody>
                          {(conf.itens || []).map((item: any) => (
                            <Table.Tr key={item.id}>
                              <Table.Td>{item.item}</Table.Td>
                              <Table.Td>{item.produto?.descricao}</Table.Td>
                              <Table.Td>{item.quantidade}</Table.Td>
                              <Table.Td><Text c={item.divergencia ? 'red' : 'green'} fw={600}>{item.divergencia || 0}</Text></Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </div>
                  ))
                )}
              </Tabs.Panel>
            </Tabs>
          </div>
        )}
      </div>
    </Modal>
  )
}
