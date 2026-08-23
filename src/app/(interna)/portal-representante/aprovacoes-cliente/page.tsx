'use client'

import { useState, useEffect } from 'react'
import {
  Card, Table, Badge, ActionIcon, Tooltip, LoadingOverlay,
  Group, Text, Modal, Grid,
} from '@mantine/core'
import { IconEye, IconLink, IconFileText } from '@tabler/icons-react'
import { usePerfilGuard } from '@/hooks/usePerfilGuard'
import { useAprovacoesCliente } from '@/data/hooks/portal-representante/useAprovacoesCliente'
import type { AprovacaoCliente, StatusAprovacao } from '@/data/hooks/portal-representante/types'

const statusColors: Record<StatusAprovacao, string> = {
  PENDENTE: 'yellow',
  APROVADA: 'green',
  REJEITADA: 'red',
}

const statusLabels: Record<StatusAprovacao, string> = {
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
}

const tipoLabels: Record<string, string> = {
  VINCULACAO: 'Vinculação',
  ALTERACAO_FISCAL: 'Alteração Fiscal',
}

export default function AprovacoesClientePage() {
  usePerfilGuard(['ADMIN', 'SUPER_ADMIN'])
  useEffect(() => { document.title = 'Vizor - Portal Representante - Aprovações de Clientes' }, [])

  const { data: aprovacoes, isLoading } = useAprovacoesCliente()

  const [modalAberto, setModalAberto] = useState(false)
  const [aprovacaoSelecionada, setAprovacaoSelecionada] = useState<AprovacaoCliente | null>(null)

  function handleVerDetalhes(aprovacao: AprovacaoCliente) {
    setAprovacaoSelecionada(aprovacao)
    setModalAberto(true)
  }

  const items = aprovacoes || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Portal Representante / Aprovações de Clientes</Text>
      <Text size="xl" fw={600} mb="lg">Aprovações de Clientes</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Representante</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Tipo de Alteração</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Data da Solicitação</Table.Th>
              <Table.Th style={{ width: 80 }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.representanteNome}</Table.Td>
                <Table.Td>{item.clienteNome}</Table.Td>
                <Table.Td>
                  <Badge
                    variant="light"
                    size="sm"
                    leftSection={
                      item.tipo === 'VINCULACAO'
                        ? <IconLink size={12} />
                        : <IconFileText size={12} />
                    }
                  >
                    {tipoLabels[item.tipo] || item.tipo}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={statusColors[item.status] || 'gray'}>
                    {statusLabels[item.status] || item.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {new Date(item.criadoEm).toLocaleDateString('pt-BR')}
                </Table.Td>
                <Table.Td>
                  {item.status === 'PENDENTE' && (
                    <Tooltip label="Ver detalhes">
                      <ActionIcon variant="subtle" color="gray" onClick={() => handleVerDetalhes(item)}>
                        <IconEye size={18} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-8 text-zinc-500">
                  Nenhuma aprovação encontrada
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal de detalhes - comparação lado a lado */}
      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title="Detalhes da Solicitação"
        size="lg"
      >
        {aprovacaoSelecionada && (
          <div>
            <Group mb="md">
              <Text size="sm" fw={500}>Representante:</Text>
              <Text size="sm">{aprovacaoSelecionada.representanteNome}</Text>
            </Group>
            <Group mb="md">
              <Text size="sm" fw={500}>Cliente:</Text>
              <Text size="sm">{aprovacaoSelecionada.clienteNome}</Text>
            </Group>
            <Group mb="lg">
              <Text size="sm" fw={500}>Tipo:</Text>
              <Badge variant="light" size="sm">
                {tipoLabels[aprovacaoSelecionada.tipo] || aprovacaoSelecionada.tipo}
              </Badge>
            </Group>

            <Text size="sm" fw={600} mb="xs">Comparação de Dados</Text>

            <Grid mb="xs">
              <Grid.Col span={4}>
                <Text size="xs" fw={600} c="dimmed">Campo</Text>
              </Grid.Col>
              <Grid.Col span={4}>
                <Text size="xs" fw={600} c="dimmed">Dados Anteriores</Text>
              </Grid.Col>
              <Grid.Col span={4}>
                <Text size="xs" fw={600} c="dimmed">Dados Novos</Text>
              </Grid.Col>
            </Grid>

            {Object.keys(aprovacaoSelecionada.dadosNovos).map((key) => {
              const valorAnterior = aprovacaoSelecionada.dadosAnteriores?.[key]
              const valorNovo = aprovacaoSelecionada.dadosNovos[key]
              const alterado = String(valorAnterior ?? '') !== String(valorNovo ?? '')

              return (
                <Grid
                  key={key}
                  style={{
                    backgroundColor: alterado ? '#fefce8' : undefined,
                    borderRadius: 4,
                    padding: '4px 0',
                  }}
                >
                  <Grid.Col span={4}>
                    <Text size="sm" fw={500}>{key}</Text>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Text size="sm" c={alterado ? 'red' : undefined}>
                      {String(valorAnterior ?? '—')}
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Text size="sm" c={alterado ? 'green' : undefined} fw={alterado ? 600 : undefined}>
                      {String(valorNovo ?? '—')}
                    </Text>
                  </Grid.Col>
                </Grid>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}
