'use client'

import { useEffect, useState } from 'react'
import {
  Stack, Text, Title, Table, Card, Group,
  LoadingOverlay, Select, TextInput, Pagination, Modal, Code, Badge,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useAuditoriaFiscal, type LogAuditoria } from '@/data/hooks/fiscal/useAuditoriaFiscal'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const OPERACAO_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'EMISSAO', label: 'Emissão' },
  { value: 'CANCELAMENTO', label: 'Cancelamento' },
  { value: 'CARTA_CORRECAO', label: 'Carta de Correção' },
  { value: 'INUTILIZACAO', label: 'Inutilização' },
  { value: 'CONTINGENCIA', label: 'Contingência' },
  { value: 'RETRANSMISSAO', label: 'Retransmissão' },
  { value: 'UPLOAD', label: 'Upload' },
  { value: 'EXCLUSAO', label: 'Exclusão' },
  { value: 'MANIFESTO', label: 'Manifesto' },
]

export default function AuditoriaFiscalPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Auditoria' }, [])

  const { useListar } = useAuditoriaFiscal()

  const [page, setPage] = useState(1)
  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)
  const [usuario, setUsuario] = useState('')
  const [operacao, setOperacao] = useState<string>('')
  const [documento, setDocumento] = useState('')
  const [selectedLog, setSelectedLog] = useState<LogAuditoria | null>(null)

  const params = {
    page,
    limit: 20,
    ...(dataInicio && { dataInicio: dataInicio.toISOString().split('T')[0] }),
    ...(dataFim && { dataFim: dataFim.toISOString().split('T')[0] }),
    ...(usuario && { usuario }),
    ...(operacao && { operacao }),
    ...(documento && { busca: documento }),
  }

  const { data: listagem, isLoading } = useListar(params)

  const totalPages = listagem?.totalPages ?? 1

  const rows = (listagem?.data ?? []).map((item) => (
    <Table.Tr
      key={item.id}
      onClick={() => setSelectedLog(item)}
      style={{ cursor: 'pointer' }}
    >
      <Table.Td>
        {new Date(item.dataHora).toLocaleString('pt-BR')}
      </Table.Td>
      <Table.Td>{item.usuario}</Table.Td>
      <Table.Td>
        <Badge variant="light" color="gray">
          {item.operacao}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm" lineClamp={1} maw={200}>
          {item.documento}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed" lineClamp={1} maw={250}>
          {typeof item.detalhes === 'object'
            ? JSON.stringify(item.detalhes).slice(0, 60) + '...'
            : String(item.detalhes)}
        </Text>
      </Table.Td>
    </Table.Tr>
  ))

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Início / Fiscal / Auditoria</Text>
      <Title order={3}>Auditoria Fiscal</Title>

      {/* Filtros */}
      <Card withBorder p="md">
        <Group gap="md" align="end">
          <DateInput
            label="Data Início"
            placeholder="Início"
            value={dataInicio}
            onChange={setDataInicio}
            clearable
            valueFormat="DD/MM/YYYY"
          />
          <DateInput
            label="Data Fim"
            placeholder="Fim"
            value={dataFim}
            onChange={setDataFim}
            clearable
            valueFormat="DD/MM/YYYY"
          />
          <TextInput
            label="Usuário"
            placeholder="Filtrar por usuário"
            value={usuario}
            onChange={(e) => setUsuario(e.currentTarget.value)}
          />
          <Select
            label="Tipo Operação"
            placeholder="Todas"
            data={OPERACAO_OPTIONS}
            value={operacao}
            onChange={(val) => setOperacao(val || '')}
            clearable
          />
          <TextInput
            label="Documento"
            placeholder="Buscar por documento"
            value={documento}
            onChange={(e) => setDocumento(e.currentTarget.value)}
          />
        </Group>
      </Card>

      {/* Tabela */}
      <Card withBorder p="lg">
        <div style={{ position: 'relative', minHeight: 100 }}>
          <LoadingOverlay visible={isLoading} />

          {!isLoading && (!listagem?.data || listagem.data.length === 0) ? (
            <Text ta="center" c="dimmed" py="xl">
              Nenhum registro de auditoria encontrado.
            </Text>
          ) : (
            <>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Data/Hora</Table.Th>
                    <Table.Th>Usuário</Table.Th>
                    <Table.Th>Operação</Table.Th>
                    <Table.Th>Documento</Table.Th>
                    <Table.Th>Detalhes</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
              </Table>

              {totalPages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination
                    value={page}
                    onChange={setPage}
                    total={totalPages}
                  />
                </Group>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Modal Detalhes do Log */}
      <Modal
        opened={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Detalhes do Log de Auditoria"
        size="lg"
      >
        {selectedLog && (
          <Stack gap="md">
            <Group gap="lg" wrap="wrap">
              <div>
                <Text size="xs" c="dimmed">Data/Hora</Text>
                <Text size="sm" fw={500}>
                  {new Date(selectedLog.dataHora).toLocaleString('pt-BR')}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Usuário</Text>
                <Text size="sm" fw={500}>{selectedLog.usuario}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Operação</Text>
                <Badge variant="light" color="gray">{selectedLog.operacao}</Badge>
              </div>
              <div>
                <Text size="xs" c="dimmed">Documento</Text>
                <Text size="sm" fw={500}>{selectedLog.documento}</Text>
              </div>
            </Group>

            <div>
              <Text size="xs" c="dimmed" mb="xs">Payload (antes/depois)</Text>
              <Code block>
                {JSON.stringify(selectedLog.detalhes, null, 2)}
              </Code>
            </div>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
