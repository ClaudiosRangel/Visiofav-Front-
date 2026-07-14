'use client'

import { useState } from 'react'
import { Card, Table, Badge, Button, Group, TextInput, Select, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconSearch, IconClockPause } from '@tabler/icons-react'
import {
  useFilaExcecoes,
  useResolverHold,
  useResolverCceNaFila,
  type FiltrosFilaExcecoes,
  type ItemFilaExcecoes,
} from '@/data/hooks/useFilaExcecoes'

const TIPO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'HOLD', label: 'Em espera (Hold)' },
  { value: 'CCE', label: 'Pendência CC-e' },
  { value: 'SENHA', label: 'Aguardando senha' },
]

function getTipoBadge(tipo: ItemFilaExcecoes['tipo']) {
  switch (tipo) {
    case 'HOLD':
      return <Badge color="grape" variant="light">Em espera</Badge>
    case 'CCE':
      return <Badge color="orange" variant="light">Pendência CC-e</Badge>
    case 'SENHA':
      return <Badge color="yellow" variant="light">Aguardando senha</Badge>
    default:
      return <Badge color="gray" variant="light">{tipo}</Badge>
  }
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString('pt-BR')
  } catch {
    return dateStr
  }
}

export default function FilaExcecoesPage() {
  const [fornecedor, setFornecedor] = useState('')
  const [tipo, setTipo] = useState<string>('')

  const filtros: FiltrosFilaExcecoes = {
    ...(fornecedor ? { fornecedor } : {}),
    ...(tipo ? { tipo: tipo as any } : {}),
  }

  const { data, isLoading } = useFilaExcecoes(filtros)
  const resolverHold = useResolverHold()
  const resolverCce = useResolverCceNaFila()

  function handleResolverHold(item: ItemFilaExcecoes, acao: 'ACEITAR' | 'REJEITAR' | 'RETORNAR_SEGUNDA_CONFERENCIA') {
    const acaoLabel = acao === 'ACEITAR' ? 'aceitar a divergência' : acao === 'REJEITAR' ? 'rejeitar o item' : 'retornar para segunda conferência'
    modals.openConfirmModal({
      title: 'Resolver Exceção',
      children: <Text size="sm">Confirma {acaoLabel} para &quot;{item.descricaoProduto}&quot;?</Text>,
      labels: { confirm: 'Confirmar', cancel: 'Cancelar' },
      confirmProps: { color: acao === 'REJEITAR' ? 'red' : 'green' },
      onConfirm: async () => {
        try {
          await resolverHold.mutateAsync({ itemNotaEntradaId: item.origemId, acao })
          notifications.show({ title: 'Sucesso', message: 'Exceção resolvida', color: 'green' })
        } catch (err: any) {
          notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao resolver exceção', color: 'red' })
        }
      },
    })
  }

  function handleResolverCce(item: ItemFilaExcecoes, status: 'RESOLVIDA' | 'CANCELADA') {
    modals.openConfirmModal({
      title: status === 'RESOLVIDA' ? 'Resolver Pendência CC-e' : 'Cancelar Pendência CC-e',
      children: <Text size="sm">Confirma esta ação para &quot;{item.descricaoProduto}&quot;?</Text>,
      labels: { confirm: 'Confirmar', cancel: 'Cancelar' },
      confirmProps: { color: status === 'CANCELADA' ? 'red' : 'green' },
      onConfirm: async () => {
        try {
          await resolverCce.mutateAsync({ pendenciaId: item.origemId, status })
          notifications.show({ title: 'Sucesso', message: 'Pendência atualizada', color: 'green' })
        } catch (err: any) {
          notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao atualizar pendência', color: 'red' })
        }
      },
    })
  }

  const itens = data?.data ?? []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>
        Início / WMS / Fila de Exceções
      </Text>
      <Group mb="lg">
        <IconClockPause size={24} className="text-grape-500" />
        <Text size="xl" fw={600}>Fila de Exceções</Text>
      </Group>

      <Card shadow="sm" padding="md" radius="md" mb="md">
        <Group grow align="flex-end">
          <TextInput
            label="Fornecedor"
            placeholder="Buscar por fornecedor..."
            leftSection={<IconSearch size={16} />}
            value={fornecedor}
            onChange={(e) => setFornecedor(e.currentTarget.value)}
          />
          <Select
            label="Tipo"
            data={TIPO_OPTIONS}
            value={tipo}
            onChange={(v) => setTipo(v || '')}
            clearable
          />
        </Group>
      </Card>

      <Card shadow="sm" padding="md" radius="md">
        {isLoading ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">Carregando...</Text>
        ) : itens.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            Nenhuma exceção pendente
          </Text>
        ) : (
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Nota</Table.Th>
                <Table.Th>Fornecedor</Table.Th>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Motivo</Table.Th>
                <Table.Th>Criado em</Table.Th>
                <Table.Th>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itens.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>{getTipoBadge(item.tipo)}</Table.Td>
                  <Table.Td>{item.notaNumero}</Table.Td>
                  <Table.Td>{item.fornecedor ?? '—'}</Table.Td>
                  <Table.Td>{item.descricaoProduto}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{item.motivo}</Text>
                    {item.motivoDetalhe && <Text size="xs" c="dimmed">{item.motivoDetalhe}</Text>}
                  </Table.Td>
                  <Table.Td>{formatDate(item.criadoEm)}</Table.Td>
                  <Table.Td>
                    {item.tipo === 'HOLD' && (
                      <Group gap="xs">
                        <Button size="xs" variant="light" color="green" loading={resolverHold.isPending}
                          onClick={() => handleResolverHold(item, 'ACEITAR')}>
                          Aceitar
                        </Button>
                        <Button size="xs" variant="light" color="red" loading={resolverHold.isPending}
                          onClick={() => handleResolverHold(item, 'REJEITAR')}>
                          Rejeitar
                        </Button>
                        <Button size="xs" variant="light" color="gray" loading={resolverHold.isPending}
                          onClick={() => handleResolverHold(item, 'RETORNAR_SEGUNDA_CONFERENCIA')}>
                          Retornar p/ 2ª conf.
                        </Button>
                      </Group>
                    )}
                    {item.tipo === 'CCE' && (
                      <Group gap="xs">
                        <Button size="xs" variant="light" color="green" loading={resolverCce.isPending}
                          onClick={() => handleResolverCce(item, 'RESOLVIDA')}>
                          Resolver
                        </Button>
                        <Button size="xs" variant="light" color="red" loading={resolverCce.isPending}
                          onClick={() => handleResolverCce(item, 'CANCELADA')}>
                          Cancelar
                        </Button>
                      </Group>
                    )}
                    {item.tipo === 'SENHA' && (
                      <Text size="xs" c="dimmed">Autorize via tela de Conferência de Entrada</Text>
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
