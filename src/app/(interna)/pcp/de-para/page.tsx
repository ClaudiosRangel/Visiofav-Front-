'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Card, Group, Button, Text, Badge, Table,
  Select, TextInput, ActionIcon, Modal, Alert,
} from '@mantine/core'
import { IconArrowLeft, IconTrash, IconSearch, IconLink } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface DeParaItem {
  id: string
  sistemaOrigem: string
  tipoEntidade: string
  codigoExterno: string
  nomeExterno: string
  entidadeInternaId: string
  criadoEm: string
}

export default function DeParaPage() {
  useEffect(() => { document.title = 'PCP - De/Para Importação' }, [])
  const router = useRouter()

  const [dados, setDados] = useState<DeParaItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmLimpar, setConfirmLimpar] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const params: any = { limit: 100 }
      if (filtroTipo) params.tipoEntidade = filtroTipo
      const res = await api.get('/pcp/de-para-importacao', { params })
      setDados(res.data.data || [])
      setTotal(res.data.total || 0)
    } catch {
      notifications.show({ title: 'Erro', message: 'Erro ao carregar mapeamentos', color: 'red' })
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [filtroTipo])

  async function excluir(id: string) {
    try {
      await api.delete(`/pcp/de-para-importacao/${id}`)
      notifications.show({ title: 'Removido', message: 'Mapeamento excluído', color: 'green' })
      setConfirmDelete(null)
      carregar()
    } catch {
      notifications.show({ title: 'Erro', message: 'Erro ao excluir', color: 'red' })
    }
  }

  async function limparCentros() {
    try {
      const res = await api.delete('/pcp/de-para-importacao/limpar-centros')
      notifications.show({ title: 'Limpo', message: res.data.message, color: 'green' })
      setConfirmLimpar(false)
      carregar()
    } catch {
      notifications.show({ title: 'Erro', message: 'Erro ao limpar', color: 'red' })
    }
  }

  function corTipo(tipo: string) {
    const m: Record<string, string> = { CLIENTE: 'blue', PRODUTO: 'violet', MATERIAL: 'cyan', CENTRO_PRODUCAO: 'green' }
    return m[tipo] || 'gray'
  }

  function labelTipo(tipo: string) {
    const m: Record<string, string> = { CLIENTE: 'Cliente', PRODUTO: 'Produto', MATERIAL: 'Material', CENTRO_PRODUCAO: 'Centro/Máquina' }
    return m[tipo] || tipo
  }

  return (
    <Stack gap="md">
      <Group>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/pcp/ordens-producao')}>Voltar</Button>
        <Title order={3}>De/Para — Mapeamentos de Importação</Title>
      </Group>

      <Card shadow="sm" padding="lg">
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <IconLink size={20} />
            <Text fw={600}>Vínculos cadastrados: {total}</Text>
          </Group>
          <Group gap="sm">
            <Select
              size="xs"
              placeholder="Filtrar por tipo"
              clearable
              data={[
                { value: 'CLIENTE', label: 'Cliente' },
                { value: 'PRODUTO', label: 'Produto' },
                { value: 'MATERIAL', label: 'Material' },
                { value: 'CENTRO_PRODUCAO', label: 'Centro/Máquina' },
              ]}
              value={filtroTipo}
              onChange={setFiltroTipo}
              style={{ width: 180 }}
            />
            <Button size="xs" color="red" variant="light" onClick={() => setConfirmLimpar(true)}>
              Limpar centros
            </Button>
          </Group>
        </Group>

        <Text size="xs" c="dimmed" mb="md">
          Esses são os mapeamentos "de/para" usados na importação de PDFs. A coluna "De (PDF)" mostra a descrição extraída do PDF, e "Para (Sistema)" mostra a entidade vinculada no sistema.
        </Text>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>De (PDF)</Table.Th>
              <Table.Th>Para (Sistema)</Table.Th>
              <Table.Th>Criado em</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {dados.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td><Badge size="xs" color={corTipo(item.tipoEntidade)}>{labelTipo(item.tipoEntidade)}</Badge></Table.Td>
                <Table.Td><Text size="xs" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.codigoExterno}</Text></Table.Td>
                <Table.Td><Text size="xs">{item.nomeExterno}</Text></Table.Td>
                <Table.Td><Text size="xs" c="dimmed">{new Date(item.criadoEm).toLocaleDateString('pt-BR')}</Text></Table.Td>
                <Table.Td>
                  <ActionIcon size="sm" color="red" variant="subtle" onClick={() => setConfirmDelete(item.id)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
            {dados.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}><Text size="sm" c="dimmed" ta="center" py="xl">Nenhum mapeamento encontrado. Importe um PDF e confirme para criar os vínculos.</Text></Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal confirmar exclusão individual */}
      <Modal opened={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Excluir mapeamento" centered size="xs">
        <Text size="sm" mb="md">Tem certeza que deseja excluir esse mapeamento?</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button color="red" onClick={() => confirmDelete && excluir(confirmDelete)}>Excluir</Button>
        </Group>
      </Modal>

      {/* Modal confirmar limpeza de centros */}
      <Modal opened={confirmLimpar} onClose={() => setConfirmLimpar(false)} title="Limpar mapeamentos de centros" centered size="sm">
        <Alert color="yellow" mb="md">
          <Text size="sm">Isso removerá TODOS os mapeamentos de centros/máquinas. Na próxima importação, o sistema não reconhecerá as etapas automaticamente e você precisará reconfigurar.</Text>
        </Alert>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmLimpar(false)}>Cancelar</Button>
          <Button color="red" onClick={limparCentros}>Limpar todos</Button>
        </Group>
      </Modal>
    </Stack>
  )
}
