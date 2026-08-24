'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { IconPlus, IconSearch, IconUsers } from '@tabler/icons-react'
import { usePortalRepClientes } from '@/data/hooks/portal-rep-app/usePortalRepClientes'
import { formatarDocumento, formatarTelefone } from '@/components/portal-rep/formatters'
import { PullToRefresh } from '@/components/portal-rep/PullToRefresh'
import { SkeletonCard } from '@/components/portal-rep/SkeletonCard'
import { EmptyState } from '@/components/portal-rep/EmptyState'
import type { ClienteCarteira } from '@/data/hooks/portal-rep-app/types'

function filtrarClientes(clientes: ClienteCarteira[], termo: string): ClienteCarteira[] {
  if (!termo.trim()) return clientes
  const termoNorm = termo.trim().toLowerCase()
  return clientes.filter((c) => {
    const nome = (c.nomeFantasia || c.razaoSocial).toLowerCase()
    const doc = c.cpfCnpj.toLowerCase()
    const cidade = (c.cidade || '').toLowerCase()
    return nome.includes(termoNorm) || doc.includes(termoNorm) || cidade.includes(termoNorm)
  })
}

export default function ClientesPage() {
  const router = useRouter()
  const { data: clientes, isLoading, refetch } = usePortalRepClientes()
  const [busca, setBusca] = useState('')

  const clientesFiltrados = useMemo(
    () => filtrarClientes(clientes ?? [], busca),
    [clientes, busca],
  )

  const handleRefresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  const handleNovoCliente = () => router.push('/portal-rep/clientes/novo')
  const handleClienteClick = (id: string) => router.push(`/portal-rep/clientes/${id}`)

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <Stack gap="md" p="md">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Title order={3}>Clientes</Title>
          {/* Botão de novo cliente visível apenas em desktop (≥ md) */}
          <Button
            leftSection={<IconPlus size={18} />}
            onClick={handleNovoCliente}
            visibleFrom="md"
          >
            Novo Cliente
          </Button>
        </Group>

        {/* Campo de busca */}
        <TextInput
          placeholder="Buscar por nome, CPF/CNPJ ou cidade..."
          leftSection={<IconSearch size={18} />}
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
        />

        {/* Loading */}
        {isLoading && (
          <Stack gap="sm">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonCard key={i} lines={3} />
            ))}
          </Stack>
        )}

        {/* Empty state */}
        {!isLoading && clientesFiltrados.length === 0 && (
          <EmptyState
            icon={IconUsers}
            title={busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente na carteira'}
            description={
              busca
                ? 'Tente buscar com outro termo'
                : 'Cadastre seu primeiro cliente tocando no botão +'
            }
          />
        )}

        {/* Lista de clientes — Cards em mobile (< md), Tabela em desktop (≥ md) */}
        {!isLoading && clientesFiltrados.length > 0 && (
          <>
            {/* Cards — visíveis apenas em mobile */}
            <Stack gap="sm" hiddenFrom="md">
              {clientesFiltrados.map((cliente) => (
                <Card
                  key={cliente.id}
                  className="portal-rep-touchable"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleClienteClick(cliente.id)}
                >
                  <Stack gap={4}>
                    <Text fw={600} lineClamp={1}>
                      {cliente.nomeFantasia || cliente.razaoSocial}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {formatarDocumento(cliente.cpfCnpj)}
                    </Text>
                    <Group gap="xs" wrap="wrap">
                      {cliente.cidade && (
                        <Text size="sm" c="dimmed">
                          {cliente.cidade}
                          {cliente.uf ? `/${cliente.uf}` : ''}
                        </Text>
                      )}
                      {cliente.telefone && (
                        <Text size="sm" c="dimmed">
                          {formatarTelefone(cliente.telefone)}
                        </Text>
                      )}
                    </Group>
                  </Stack>
                </Card>
              ))}
            </Stack>

            {/* Tabela — visível apenas em desktop */}
            <Box visibleFrom="md">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nome</Table.Th>
                    <Table.Th>CPF/CNPJ</Table.Th>
                    <Table.Th>Cidade/UF</Table.Th>
                    <Table.Th>Telefone</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {clientesFiltrados.map((cliente) => (
                    <Table.Tr
                      key={cliente.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleClienteClick(cliente.id)}
                    >
                      <Table.Td>
                        {cliente.nomeFantasia || cliente.razaoSocial}
                      </Table.Td>
                      <Table.Td>{formatarDocumento(cliente.cpfCnpj)}</Table.Td>
                      <Table.Td>
                        {cliente.cidade
                          ? `${cliente.cidade}${cliente.uf ? `/${cliente.uf}` : ''}`
                          : '—'}
                      </Table.Td>
                      <Table.Td>
                        {cliente.telefone ? formatarTelefone(cliente.telefone) : '—'}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          </>
        )}
      </Stack>

      {/* FAB — fixo no canto inferior direito, visível apenas em mobile */}
      <ActionIcon
        hiddenFrom="md"
        color="green"
        size={56}
        radius="xl"
        variant="filled"
        onClick={handleNovoCliente}
        aria-label="Novo Cliente"
        style={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        }}
      >
        <IconPlus size={28} />
      </ActionIcon>
    </PullToRefresh>
  )
}
