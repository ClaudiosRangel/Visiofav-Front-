'use client'

import { Modal, Table, Button, Text, LoadingOverlay } from '@mantine/core'
import { useSugestaoRota } from '@/data/hooks/useGeo'

interface SugestaoRotaModalProps {
  opened: boolean
  onClose: () => void
  clienteId: string
  onRotaSelecionada: (rotaId: string) => void
}

export function SugestaoRotaModal({
  opened,
  onClose,
  clienteId,
  onRotaSelecionada,
}: SugestaoRotaModalProps) {
  const { data: sugestoes, isLoading } = useSugestaoRota(clienteId, opened)

  const isEmpty = !isLoading && (!sugestoes || sugestoes.length === 0)

  return (
    <Modal opened={opened} onClose={onClose} title="Sugestão de Rota" size="lg">
      <div style={{ position: 'relative', minHeight: 120 }}>
        <LoadingOverlay visible={isLoading} />

        {isEmpty && (
          <Text c="dimmed" ta="center" py="xl">
            Não há rotas com clientes geocodificados para comparação
          </Text>
        )}

        {sugestoes && sugestoes.length > 0 && (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Descrição</Table.Th>
                <Table.Th>Distância Média (km)</Table.Th>
                <Table.Th>Qtd Clientes</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sugestoes.map((sugestao) => (
                <Table.Tr key={sugestao.rotaId}>
                  <Table.Td>{sugestao.codigo}</Table.Td>
                  <Table.Td>{sugestao.descricao}</Table.Td>
                  <Table.Td>{sugestao.distanciaMediaKm.toFixed(2)}</Table.Td>
                  <Table.Td>{sugestao.quantidadeClientes}</Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => onRotaSelecionada(sugestao.rotaId)}
                    >
                      Selecionar
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </div>
    </Modal>
  )
}
