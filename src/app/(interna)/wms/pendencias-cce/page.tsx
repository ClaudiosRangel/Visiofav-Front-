'use client'

import { useState } from 'react'
import { Card, Table, Badge, Button, Group, TextInput, Select, Text, Stack } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconSearch, IconAlertCircle } from '@tabler/icons-react'
import { usePendenciasCce, useResolverPendencia, type FiltrosPendencia, type PendenciaCce } from '@/data/hooks/usePendenciasCce'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'AGUARDANDO_CCE', label: 'Pendente' },
  { value: 'CANCELADA', label: 'CCE Emitida' },
  { value: 'RESOLVIDA', label: 'Resolvida' },
]

function getStatusBadge(status: PendenciaCce['status']) {
  switch (status) {
    case 'AGUARDANDO_CCE':
      return <Badge color="orange" variant="light">Pendente</Badge>
    case 'RESOLVIDA':
      return <Badge color="green" variant="light">Resolvida</Badge>
    case 'CANCELADA':
      return <Badge color="blue" variant="light">CCE Emitida</Badge>
    default:
      return <Badge color="gray" variant="light">{status}</Badge>
  }
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR')
  } catch {
    return dateStr
  }
}

export default function PendenciasCcePage() {
  const [fornecedor, setFornecedor] = useState('')
  const [dataInicial, setDataInicial] = useState<Date | null>(null)
  const [dataFinal, setDataFinal] = useState<Date | null>(null)
  const [status, setStatus] = useState<string>('')

  const filtros: FiltrosPendencia = {
    ...(fornecedor ? { fornecedor } : {}),
    ...(dataInicial ? { dataInicial: dataInicial.toISOString().split('T')[0] } : {}),
    ...(dataFinal ? { dataFinal: dataFinal.toISOString().split('T')[0] } : {}),
    ...(status ? { status } : {}),
  }

  const { data: pendencias, isLoading } = usePendenciasCce(filtros)
  const resolver = useResolverPendencia()

  function handleResolver(id: string) {
    modals.openConfirmModal({
      title: 'Resolver Pendência',
      children: <Text size="sm">Confirma a resolução desta pendência?</Text>,
      labels: { confirm: 'Confirmar', cancel: 'Cancelar' },
      confirmProps: { color: 'green' },
      onConfirm: async () => {
        try {
          await resolver.mutateAsync({ id, status: 'RESOLVIDA' })
          notifications.show({ title: 'Sucesso', message: 'Pendência resolvida', color: 'green' })
        } catch (err: any) {
          const msg = err?.response?.data?.error?.message
            || err?.response?.data?.message
            || 'Erro ao resolver pendência'
          notifications.show({ title: 'Erro', message: msg, color: 'red' })
        }
      },
    })
  }

  function handleCancelar(id: string) {
    modals.openConfirmModal({
      title: 'Cancelar Pendência',
      children: <Text size="sm">Confirma o cancelamento desta pendência?</Text>,
      labels: { confirm: 'Confirmar', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await resolver.mutateAsync({ id, status: 'CANCELADA' })
          notifications.show({ title: 'Sucesso', message: 'Pendência cancelada', color: 'green' })
        } catch (err: any) {
          const msg = err?.response?.data?.error?.message
            || err?.response?.data?.message
            || 'Erro ao cancelar pendência'
          notifications.show({ title: 'Erro', message: msg, color: 'red' })
        }
      },
    })
  }

  // Sort by criadoEm descending
  const sortedPendencias = [...(pendencias || [])].sort(
    (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
  )

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>
        Início / WMS / Pendências CC-e
      </Text>
      <Group mb="lg">
        <IconAlertCircle size={24} className="text-orange-500" />
        <Text size="xl" fw={600}>Pendências CC-e</Text>
      </Group>

      {/* Filtros */}
      <Card shadow="sm" padding="md" radius="md" mb="md">
        <Group grow align="flex-end">
          <TextInput
            label="Fornecedor"
            placeholder="Buscar por fornecedor..."
            leftSection={<IconSearch size={16} />}
            value={fornecedor}
            onChange={(e) => setFornecedor(e.currentTarget.value)}
          />
          <DateInput
            label="Data Inicial"
            placeholder="dd/mm/aaaa"
            valueFormat="DD/MM/YYYY"
            clearable
            value={dataInicial}
            onChange={setDataInicial}
          />
          <DateInput
            label="Data Final"
            placeholder="dd/mm/aaaa"
            valueFormat="DD/MM/YYYY"
            clearable
            value={dataFinal}
            onChange={setDataFinal}
          />
          <Select
            label="Status"
            data={STATUS_OPTIONS}
            value={status}
            onChange={(v) => setStatus(v || '')}
            clearable
          />
        </Group>
      </Card>

      {/* Tabela */}
      <Card shadow="sm" padding="md" radius="md">
        {isLoading ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">Carregando...</Text>
        ) : sortedPendencias.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            Nenhuma pendência encontrada
          </Text>
        ) : (
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Fornecedor</Table.Th>
                <Table.Th>Nota Fiscal</Table.Th>
                <Table.Th>Data Criação</Table.Th>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Motivo</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedPendencias.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.fornecedor}</Table.Td>
                  <Table.Td>{p.notaFiscal}</Table.Td>
                  <Table.Td>{formatDate(p.criadoEm)}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{p.descricaoProduto}</Text>
                    <Text size="xs" c="dimmed">{p.codigoProduto}</Text>
                  </Table.Td>
                  <Table.Td>{p.motivo}</Table.Td>
                  <Table.Td>{getStatusBadge(p.status)}</Table.Td>
                  <Table.Td>
                    {p.status === 'AGUARDANDO_CCE' && (
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          color="green"
                          onClick={() => handleResolver(p.id)}
                          loading={resolver.isPending}
                        >
                          Resolver
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          onClick={() => handleCancelar(p.id)}
                          loading={resolver.isPending}
                        >
                          Cancelar
                        </Button>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
