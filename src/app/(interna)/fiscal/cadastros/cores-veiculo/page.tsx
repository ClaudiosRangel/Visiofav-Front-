'use client'

import { useEffect, useState } from 'react'
import {
  Text,
  Card,
  Table,
  Button,
  Group,
  TextInput,
  Modal,
  ActionIcon,
  LoadingOverlay,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconTrash, IconEdit, IconSeedling } from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useCte } from '@/data/hooks/fiscal/useCte'

export default function CoresVeiculoPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Cores de Veículo' }, [])

  const { useListarCores, useCriarCor, useSeedCores } = useCte()
  const { data: cores, isLoading, refetch } = useListarCores()
  const criarMutation = useCriarCor()
  const seedMutation = useSeedCores()

  const [modalAberto, setModalAberto] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)

  function abrirNovo() {
    setCodigo('')
    setDescricao('')
    setEditandoId(null)
    setModalAberto(true)
  }

  function abrirEditar(cor: { id: string; codigo: string; descricao: string }) {
    setCodigo(cor.codigo)
    setDescricao(cor.descricao)
    setEditandoId(cor.id)
    setModalAberto(true)
  }

  function salvar() {
    if (!codigo.trim() || !descricao.trim()) {
      notifications.show({ title: 'Erro', message: 'Código e descrição são obrigatórios', color: 'red' })
      return
    }
    criarMutation.mutate({ codigo: codigo.trim(), descricao: descricao.trim() }, {
      onSuccess: () => {
        notifications.show({ title: 'Sucesso', message: 'Cor salva', color: 'green' })
        setModalAberto(false)
        refetch()
      },
      onError: (err: any) => {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
      },
    })
  }

  function handleSeed() {
    seedMutation.mutate(undefined, {
      onSuccess: (data: any) => {
        notifications.show({ title: 'Sucesso', message: `${data.criadas} cor(es) criada(s) de ${data.total} padrão`, color: 'green' })
        refetch()
      },
      onError: (err: any) => {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
      },
    })
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta cor?')) return
    try {
      const { api } = await import('@/lib/api')
      await api.delete(`/fiscal/cte/cores/${id}`)
      notifications.show({ title: 'Excluído', message: 'Cor removida', color: 'green' })
      refetch()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Fiscal / Cadastros / Cores de Veículo</Text>
      <Text size="xl" fw={600} mb="lg">Cores de Veículo (DENATRAN)</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md">
          <Text size="sm" c="dimmed">
            Códigos usados no campo &lt;cCor&gt; do CT-e para veículos novos
          </Text>
          <Group gap="xs">
            <Button size="xs" variant="light" leftSection={<IconSeedling size={14} />}
              onClick={handleSeed} loading={seedMutation.isPending}>
              Popular padrão DENATRAN
            </Button>
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={abrirNovo}>
              Nova Cor
            </Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 100 }}>Código</Table.Th>
              <Table.Th>Descrição</Table.Th>
              <Table.Th style={{ width: 100 }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(!cores || cores.length === 0) && !isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>
                  <Text c="dimmed">Nenhuma cor cadastrada. Clique em "Popular padrão DENATRAN" para começar.</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              (cores || []).map((cor) => (
                <Table.Tr key={cor.id}>
                  <Table.Td fw={600}>{cor.codigo}</Table.Td>
                  <Table.Td>{cor.descricao}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" color="blue" onClick={() => abrirEditar(cor)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => excluir(cor.id)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title={editandoId ? 'Editar Cor' : 'Nova Cor'}>
        <TextInput label="Código (máx. 4 caracteres)" value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={4} mb="sm" />
        <TextInput label="Descrição da Cor" value={descricao}
          onChange={(e) => setDescricao(e.target.value.toUpperCase())} mb="md" />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setModalAberto(false)}>Cancelar</Button>
          <Button onClick={salvar} loading={criarMutation.isPending}>Salvar</Button>
        </Group>
      </Modal>
    </div>
  )
}
