'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, TextInput, Modal,
  LoadingOverlay, Select, Stack,
} from '@mantine/core'
import { IconPlus, IconPower } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'

interface PontoConsolidacao {
  id: string
  nome: string
  enderecoId: string
  cdId: string
  ativo: boolean
}

export default function PontosConsolidacaoPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Pontos de Consolidação' }, [])

  const queryClient = useQueryClient()
  const [opened, { open, close }] = useDisclosure(false)

  const [nome, setNome] = useState('')
  const [enderecoId, setEnderecoId] = useState<string | null>(null)
  const [cdId, setCdId] = useState<string | null>(null)

  const { data: pontos = [], isLoading } = useQuery<PontoConsolidacao[]>({
    queryKey: ['picking-zona', 'pontos-consolidacao'],
    queryFn: async () => {
      const { data } = await api.get('/picking-zona/pontos-consolidacao')
      return data
    },
  })

  const { data: enderecosOptions = [] } = useQuery<{ value: string; label: string }[]>({
    queryKey: ['picking-zona', 'enderecos-options'],
    queryFn: async () => {
      const { data } = await api.get('/enderecos', { params: { tipo: 'CONSOLIDACAO' } })
      return data.map((e: any) => ({ value: e.id, label: e.codigo || e.id }))
    },
  })

  const { data: cdsOptions = [] } = useQuery<{ value: string; label: string }[]>({
    queryKey: ['picking-zona', 'cds-options'],
    queryFn: async () => {
      const { data } = await api.get('/centros-distribuicao')
      return data.map((cd: any) => ({ value: cd.id, label: cd.nome }))
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: { nome: string; enderecoId: string; cdId: string }) => {
      await api.post('/picking-zona/pontos-consolidacao', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['picking-zona', 'pontos-consolidacao'] })
      notifications.show({ title: 'Sucesso', message: 'Ponto de consolidação criado', color: 'green' })
      handleClose()
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Falha ao criar ponto', color: 'red' })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/picking-zona/pontos-consolidacao/${id}/desativar`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['picking-zona', 'pontos-consolidacao'] })
      notifications.show({ title: 'Sucesso', message: 'Ponto desativado', color: 'green' })
    },
  })

  function handleClose() {
    setNome('')
    setEnderecoId(null)
    setCdId(null)
    close()
  }

  function handleSubmit() {
    if (!nome || !enderecoId || !cdId) return
    createMutation.mutate({ nome, enderecoId, cdId })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Separação / Picking por Zona / Pontos de Consolidação</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Pontos de Consolidação</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Novo Ponto
        </Button>
      </Group>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Endereço</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pontos.map((ponto) => (
              <Table.Tr key={ponto.id}>
                <Table.Td>{ponto.nome}</Table.Td>
                <Table.Td className="font-mono">{ponto.enderecoId}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={ponto.ativo ? 'green' : 'gray'}>
                    {ponto.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {ponto.ativo && (
                    <Button
                      variant="subtle"
                      size="xs"
                      color="orange"
                      leftSection={<IconPower size={14} />}
                      onClick={() => deactivateMutation.mutate(ponto.id)}
                    >
                      Desativar
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {pontos.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={4} className="text-center py-8 text-zinc-500">
                  Nenhum ponto de consolidação cadastrado
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Novo Ponto */}
      <Modal opened={opened} onClose={handleClose} title="Novo Ponto de Consolidação">
        <Stack>
          <TextInput
            label="Nome"
            placeholder="Ex: Ponto Consolidação A"
            value={nome}
            onChange={(e) => setNome(e.currentTarget.value)}
            required
          />
          <Select
            label="Endereço"
            placeholder="Selecione o endereço"
            data={enderecosOptions}
            value={enderecoId}
            onChange={setEnderecoId}
            searchable
            required
          />
          <Select
            label="Centro de Distribuição"
            placeholder="Selecione o CD"
            data={cdsOptions}
            value={cdId}
            onChange={setCdId}
            required
          />
          <Button onClick={handleSubmit} loading={createMutation.isPending} fullWidth>
            Criar Ponto
          </Button>
        </Stack>
      </Modal>
    </div>
  )
}
