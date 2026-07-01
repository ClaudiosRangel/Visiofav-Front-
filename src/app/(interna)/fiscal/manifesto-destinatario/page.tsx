'use client'

import { useEffect, useState } from 'react'
import {
  Stack, Text, Title, Table, Badge, Button, Card, Group,
  LoadingOverlay, Select, TextInput,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import {
  IconCheck, IconQuestionMark, IconX, IconEyeCheck,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useManifesto, type NfeRecebida, type EventoManifesto } from '@/data/hooks/fiscal/useManifesto'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const SITUACAO_COLORS: Record<string, string> = {
  SEM_MANIFESTO: 'gray',
  CIENCIA: 'blue',
  CONFIRMADA: 'green',
  DESCONHECIDA: 'orange',
  NAO_REALIZADA: 'red',
}

const SITUACAO_LABELS: Record<string, string> = {
  SEM_MANIFESTO: 'Sem Manifesto',
  CIENCIA: 'Ciência',
  CONFIRMADA: 'Confirmada',
  DESCONHECIDA: 'Desconhecida',
  NAO_REALIZADA: 'Não Realizada',
}

const SITUACAO_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'SEM_MANIFESTO', label: 'Sem Manifesto' },
  { value: 'CIENCIA', label: 'Ciência' },
  { value: 'CONFIRMADA', label: 'Confirmada' },
  { value: 'DESCONHECIDA', label: 'Desconhecida' },
  { value: 'NAO_REALIZADA', label: 'Não Realizada' },
]

export default function ManifestoDestinatarioPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Manifesto Destinatário' }, [])

  const { useListar, useManifestar } = useManifesto()

  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)
  const [situacao, setSituacao] = useState<string>('')
  const [emitente, setEmitente] = useState('')

  const params = {
    ...(dataInicio && { dataInicio: dataInicio.toISOString().split('T')[0] }),
    ...(dataFim && { dataFim: dataFim.toISOString().split('T')[0] }),
    ...(situacao && { situacao }),
    ...(emitente && { busca: emitente }),
  }

  const { data: listagem, isLoading } = useListar(params)
  const manifestarMutation = useManifestar()

  function handleManifestar(chave: string, evento: EventoManifesto) {
    manifestarMutation.mutate(
      { chave, evento },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Manifesto registrado',
            message: `Evento "${evento}" registrado com sucesso.`,
            color: 'green',
          })
        },
        onError: (error: any) => {
          notifications.show({
            title: 'Erro ao manifestar',
            message: error?.response?.data?.message || 'Não foi possível registrar o manifesto.',
            color: 'red',
          })
        },
      },
    )
  }

  const rows = (listagem?.data ?? []).map((item: NfeRecebida) => (
    <Table.Tr key={item.chaveAcesso}>
      <Table.Td>
        <Text size="sm" lineClamp={1} maw={280}>
          {item.chaveAcesso}
        </Text>
      </Table.Td>
      <Table.Td>{item.emitente}</Table.Td>
      <Table.Td>
        {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </Table.Td>
      <Table.Td>{new Date(item.dataEmissao).toLocaleDateString('pt-BR')}</Table.Td>
      <Table.Td>
        <Badge color={SITUACAO_COLORS[item.situacaoManifesto] || 'gray'}>
          {SITUACAO_LABELS[item.situacaoManifesto] || item.situacaoManifesto}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <Button
            size="xs"
            variant="light"
            color="blue"
            leftSection={<IconEyeCheck size={14} />}
            onClick={() => handleManifestar(item.chaveAcesso, 'ciencia')}
            loading={manifestarMutation.isPending}
          >
            Ciência
          </Button>
          <Button
            size="xs"
            variant="light"
            color="green"
            leftSection={<IconCheck size={14} />}
            onClick={() => handleManifestar(item.chaveAcesso, 'confirmacao')}
            loading={manifestarMutation.isPending}
          >
            Confirmação
          </Button>
          <Button
            size="xs"
            variant="light"
            color="orange"
            leftSection={<IconQuestionMark size={14} />}
            onClick={() => handleManifestar(item.chaveAcesso, 'desconhecimento')}
            loading={manifestarMutation.isPending}
          >
            Desconhecimento
          </Button>
          <Button
            size="xs"
            variant="light"
            color="red"
            leftSection={<IconX size={14} />}
            onClick={() => handleManifestar(item.chaveAcesso, 'nao-realizada')}
            loading={manifestarMutation.isPending}
          >
            Não Realizada
          </Button>
        </Group>
      </Table.Td>
    </Table.Tr>
  ))

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Início / Fiscal / Manifesto Destinatário</Text>
      <Title order={3}>Manifesto do Destinatário</Title>

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
          <Select
            label="Situação"
            placeholder="Todas"
            data={SITUACAO_OPTIONS}
            value={situacao}
            onChange={(val) => setSituacao(val || '')}
            clearable
          />
          <TextInput
            label="Emitente"
            placeholder="Buscar por emitente"
            value={emitente}
            onChange={(e) => setEmitente(e.currentTarget.value)}
          />
        </Group>
      </Card>

      {/* Tabela */}
      <Card withBorder p="lg">
        <div style={{ position: 'relative', minHeight: 100 }}>
          <LoadingOverlay visible={isLoading} />

          {!isLoading && (!listagem?.data || listagem.data.length === 0) ? (
            <Text ta="center" c="dimmed" py="xl">
              Nenhuma NF-e recebida encontrada.
            </Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Chave</Table.Th>
                  <Table.Th>Emitente</Table.Th>
                  <Table.Th>Valor</Table.Th>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Situação</Table.Th>
                  <Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          )}
        </div>
      </Card>
    </Stack>
  )
}
