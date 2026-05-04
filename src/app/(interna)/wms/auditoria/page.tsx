'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Select, TextInput, LoadingOverlay,
  Pagination, Modal,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconSearch, IconShieldCheck } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const acaoColors: Record<string, string> = {
  CRIAR: 'green', ATUALIZAR: 'blue', EXCLUIR: 'red', CONFERIR: 'cyan',
  APROVAR: 'teal', REJEITAR: 'orange', TRANSFERIR: 'grape',
}

const entidadeColors: Record<string, string> = {
  ESTOQUE: 'blue', CONFERENCIA: 'cyan', ENDERECAMENTO: 'teal',
  SEPARACAO: 'grape', CARREGAMENTO: 'orange', INVENTARIO: 'yellow',
}

export default function AuditoriaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Auditoria' }, [])

  const [page, setPage] = useState(1)
  const [entidade, setEntidade] = useState<string | null>(null)
  const [acao, setAcao] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)
  const [detalheModal, setDetalheModal] = useState<any>(null)

  const { data: response, isLoading } = useQuery<any>({
    queryKey: ['auditoria', page, entidade, acao, search, dataInicio?.toISOString(), dataFim?.toISOString()],
    queryFn: async () => {
      const params: any = { page, limit: 30 }
      if (entidade) params.entidade = entidade
      if (acao) params.acao = acao
      if (search) params.search = search
      if (dataInicio) params.dataInicio = dataInicio.toISOString().split('T')[0]
      if (dataFim) params.dataFim = dataFim.toISOString().split('T')[0]
      const { data } = await api.get('/auditoria', { params })
      return data
    },
  })

  // Entidades disponíveis
  const { data: entidadesResp } = useQuery<string[]>({
    queryKey: ['auditoria-entidades'],
    queryFn: async () => { const { data } = await api.get('/auditoria/entidades'); return data },
  })

  const logs = response?.data || []
  const totalPages = response?.totalPages || 1
  const entidadeOptions = (entidadesResp || []).map((e) => ({ value: e, label: e }))

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Auditoria</Text>
      <Text size="xl" fw={600} mb="lg">Log de Auditoria</Text>

      {/* Filtros */}
      <Card mb="md">
        <Group gap="sm">
          <Select label="Entidade" data={entidadeOptions} value={entidade}
            onChange={(v) => { setEntidade(v); setPage(1) }} clearable className="w-44" placeholder="Todas" />
          <Select label="Ação" data={[
            { value: 'CRIAR', label: 'Criar' }, { value: 'ATUALIZAR', label: 'Atualizar' },
            { value: 'EXCLUIR', label: 'Excluir' }, { value: 'CONFERIR', label: 'Conferir' },
            { value: 'APROVAR', label: 'Aprovar' }, { value: 'REJEITAR', label: 'Rejeitar' },
            { value: 'TRANSFERIR', label: 'Transferir' },
          ]} value={acao} onChange={(v) => { setAcao(v); setPage(1) }} clearable className="w-36" placeholder="Todas" />
          <TextInput label="Buscar" placeholder="Descrição..." leftSection={<IconSearch size={16} />}
            value={search} onChange={(e) => { setSearch(e.currentTarget.value); setPage(1) }} className="w-60" />
          <DateInput label="De" value={dataInicio} onChange={(v) => { setDataInicio(v); setPage(1) }}
            valueFormat="DD/MM/YYYY" clearable className="w-36" />
          <DateInput label="Até" value={dataFim} onChange={(v) => { setDataFim(v); setPage(1) }}
            valueFormat="DD/MM/YYYY" clearable className="w-36" />
        </Group>
      </Card>

      {/* Tabela */}
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <IconShieldCheck size={20} className="text-blue-500" />
            <Text fw={600}>Registros ({response?.total || 0})</Text>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data/Hora</Table.Th>
              <Table.Th>Entidade</Table.Th>
              <Table.Th>Ação</Table.Th>
              <Table.Th>Descrição</Table.Th>
              <Table.Th>Usuário</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {logs.map((log: any) => (
              <Table.Tr key={log.id} className="cursor-pointer" onClick={() => setDetalheModal(log)}>
                <Table.Td className="text-sm">{new Date(log.criadoEm).toLocaleString('pt-BR')}</Table.Td>
                <Table.Td>
                  <Badge color={entidadeColors[log.entidade] || 'gray'} variant="light" size="sm">{log.entidade}</Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={acaoColors[log.acao] || 'gray'} variant="light" size="sm">{log.acao}</Badge>
                </Table.Td>
                <Table.Td className="max-w-[400px] truncate text-sm">{log.descricao}</Table.Td>
                <Table.Td className="text-sm">{log.usuario?.nome || '—'}</Table.Td>
              </Table.Tr>
            ))}
            {logs.length === 0 && (
              <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum registro de auditoria</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </Group>
        )}
      </Card>

      {/* Modal Detalhe */}
      <Modal opened={!!detalheModal} onClose={() => setDetalheModal(null)} title="Detalhe do Log" size="lg" centered>
        {detalheModal && (
          <div>
            <Group gap="sm" mb="md">
              <Badge color={entidadeColors[detalheModal.entidade] || 'gray'}>{detalheModal.entidade}</Badge>
              <Badge color={acaoColors[detalheModal.acao] || 'gray'}>{detalheModal.acao}</Badge>
            </Group>
            <Text size="sm" mb="xs"><strong>Data:</strong> {new Date(detalheModal.criadoEm).toLocaleString('pt-BR')}</Text>
            <Text size="sm" mb="xs"><strong>Usuário:</strong> {detalheModal.usuario?.nome || '—'} ({detalheModal.usuario?.email || ''})</Text>
            <Text size="sm" mb="xs"><strong>ID Entidade:</strong> <span className="font-mono">{detalheModal.entidadeId}</span></Text>
            <Text size="sm" mb="md"><strong>Descrição:</strong> {detalheModal.descricao}</Text>
            {detalheModal.dados && (
              <>
                <Text size="sm" fw={600} mb="xs">Dados:</Text>
                <Card withBorder bg="gray.0" p="sm">
                  <pre className="text-xs overflow-auto max-h-60">{JSON.stringify(JSON.parse(detalheModal.dados), null, 2)}</pre>
                </Card>
              </>
            )}
            {detalheModal.ip && <Text size="xs" c="dimmed" mt="sm">IP: {detalheModal.ip}</Text>}
          </div>
        )}
      </Modal>
    </div>
  )
}
