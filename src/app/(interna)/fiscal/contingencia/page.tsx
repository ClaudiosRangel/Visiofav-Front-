'use client'

import { useEffect } from 'react'
import {
  Badge, Table, Button, Card, Stack, Title, Text, LoadingOverlay, Group,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useContingencia } from '@/data/hooks/fiscal/useContingencia'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function ContingenciaPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Contingência' }, [])

  const { useStatus, useFila, useRetransmitir, useRetransmitirTodos } = useContingencia()

  const { data: status, isLoading: isLoadingStatus } = useStatus()
  const { data: fila, isLoading: isLoadingFila } = useFila()
  const retransmitir = useRetransmitir()
  const retransmitirTodos = useRetransmitirTodos()

  useEffect(() => {
    if (retransmitir.isError) {
      notifications.show({
        title: 'Erro ao retransmitir',
        message: (retransmitir.error as any)?.response?.data?.message || 'Não foi possível retransmitir o documento.',
        color: 'red',
      })
    }
    if (retransmitir.isSuccess) {
      notifications.show({
        title: 'Retransmitido',
        message: 'Documento retransmitido com sucesso.',
        color: 'green',
      })
    }
  }, [retransmitir.isError, retransmitir.isSuccess, retransmitir.error])

  useEffect(() => {
    if (retransmitirTodos.isError) {
      notifications.show({
        title: 'Erro ao retransmitir',
        message: (retransmitirTodos.error as any)?.response?.data?.message || 'Não foi possível retransmitir os documentos.',
        color: 'red',
      })
    }
    if (retransmitirTodos.isSuccess) {
      notifications.show({
        title: 'Retransmitidos',
        message: 'Todos os documentos foram retransmitidos com sucesso.',
        color: 'green',
      })
    }
  }, [retransmitirTodos.isError, retransmitirTodos.isSuccess, retransmitirTodos.error])

  const itens = fila?.data ?? []

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Início / Fiscal / Contingência</Text>
      <Title order={3}>Contingência</Title>

      {/* Status SEFAZ */}
      <Card withBorder p="md">
        <div style={{ position: 'relative', minHeight: 40 }}>
          <LoadingOverlay visible={isLoadingStatus} />
          <Group>
            <Text fw={600}>Status SEFAZ:</Text>
            {status && (
              <Badge color={status.sefazOnline ? 'green' : 'red'} size="lg">
                {status.sefazOnline ? 'Online' : 'Offline'}
              </Badge>
            )}
            {status && (
              <Text size="sm" c="dimmed">
                Última verificação: {new Date(status.ultimaVerificacao).toLocaleString('pt-BR')}
              </Text>
            )}
            {status && (
              <Text size="sm" c="dimmed">
                Pendentes: {status.totalPendentes}
              </Text>
            )}
          </Group>
        </div>
      </Card>

      {/* Ações em massa */}
      <Group>
        <Button
          onClick={() => retransmitirTodos.mutate()}
          loading={retransmitirTodos.isPending}
          color="teal"
        >
          Retransmitir Todos
        </Button>
      </Group>

      {/* Fila de contingência */}
      <Card withBorder p="md">
        <div style={{ position: 'relative', minHeight: 120 }}>
          <LoadingOverlay visible={isLoadingFila} />

          {itens.length === 0 && !isLoadingFila ? (
            <Text ta="center" c="dimmed" py="xl">
              Nenhum documento na fila de contingência.
            </Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tipo Documento</Table.Th>
                  <Table.Th>Número</Table.Th>
                  <Table.Th>Data Enfileiramento</Table.Th>
                  <Table.Th>Tentativas</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {itens.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>{item.tipoDocumento}</Table.Td>
                    <Table.Td>{item.numero}</Table.Td>
                    <Table.Td>{new Date(item.dataEnfileiramento).toLocaleString('pt-BR')}</Table.Td>
                    <Table.Td>{item.tentativas}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          item.status === 'TRANSMITIDO' ? 'green'
                            : item.status === 'FALHA' ? 'red'
                              : 'gray'
                        }
                        size="sm"
                      >
                        {item.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => retransmitir.mutate(item.id)}
                        loading={retransmitir.isPending && retransmitir.variables === item.id}
                      >
                        Retransmitir
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </div>
      </Card>
    </Stack>
  )
}
