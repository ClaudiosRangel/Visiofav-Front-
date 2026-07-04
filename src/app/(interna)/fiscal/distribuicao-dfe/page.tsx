'use client'

import { useEffect, useState } from 'react'
import {
  Stack, Text, Title, Table, Badge, Button, Card, Group,
  LoadingOverlay, Modal, Select, SimpleGrid, ThemeIcon,
} from '@mantine/core'
import { IconCloudDownload, IconFileImport, IconClock, IconInbox } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import {
  useDistribuicaoDfe,
  type DocumentoDistribuicaoDfe,
  type StatusDistribuicaoDfe,
} from '@/data/hooks/fiscal/useDistribuicaoDfe'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const STATUS_COLORS: Record<StatusDistribuicaoDfe, string> = {
  PENDENTE: 'blue',
  PROCESSADO: 'yellow',
  ENTRADA_GERADA: 'green',
}

const STATUS_LABELS: Record<StatusDistribuicaoDfe, string> = {
  PENDENTE: 'Pendente',
  PROCESSADO: 'Processado',
  ENTRADA_GERADA: 'Entrada Gerada',
}

export default function DistribuicaoDfePage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Notas do Fornecedor (DFe)' }, [])

  const { useListar, useStatus, useConsultar, useGerarEntrada } = useDistribuicaoDfe()
  const [statusFiltro, setStatusFiltro] = useState<string | null>(null)

  const { data: listagem, isLoading } = useListar(
    statusFiltro ? { status: statusFiltro as StatusDistribuicaoDfe } : undefined,
  )
  const { data: statusInfo } = useStatus()
  const consultarMutation = useConsultar()
  const gerarEntradaMutation = useGerarEntrada()

  const [selectedDoc, setSelectedDoc] = useState<DocumentoDistribuicaoDfe | null>(null)

  function handleConsultar() {
    consultarMutation.mutate(undefined, {
      onSuccess: (resultado) => {
        notifications.show({
          title: resultado.documentosProcessados > 0 ? 'Novas notas encontradas' : 'Consulta concluída',
          message: resultado.mensagem,
          color: resultado.documentosProcessados > 0 ? 'green' : 'blue',
        })
      },
      onError: (error: any) => {
        notifications.show({
          title: 'Erro ao consultar a SEFAZ',
          message: error?.response?.data?.message || 'Não foi possível consultar a Distribuição DFe. Verifique se há um certificado digital ativo cadastrado.',
          color: 'red',
        })
      },
    })
  }

  function handleGerarEntrada(id: string) {
    gerarEntradaMutation.mutate(id, {
      onSuccess: () => {
        notifications.show({
          title: 'Entrada gerada',
          message: 'Documento fiscal de entrada gerado com sucesso a partir da nota.',
          color: 'green',
        })
        setSelectedDoc(null)
      },
      onError: (error: any) => {
        notifications.show({
          title: 'Erro ao gerar entrada',
          message: error?.response?.data?.message || 'Não foi possível gerar a entrada para esta nota.',
          color: 'red',
        })
      },
    })
  }

  const rows = (listagem?.data ?? []).map((item) => (
    <Table.Tr
      key={item.id}
      onClick={() => setSelectedDoc(item)}
      style={{ cursor: 'pointer' }}
    >
      <Table.Td>
        <Badge variant="light" color={item.tipo === 'NFE' ? 'blue' : 'grape'}>
          {item.tipo}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm" lineClamp={1} maw={260}>
          {item.chaveAcesso}
        </Text>
      </Table.Td>
      <Table.Td>{item.emitenteRazao || item.emitenteCnpj}</Table.Td>
      <Table.Td>
        {item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </Table.Td>
      <Table.Td>{new Date(item.dataEmissao).toLocaleDateString('pt-BR')}</Table.Td>
      <Table.Td>
        <Badge color={STATUS_COLORS[item.status] || 'gray'}>
          {STATUS_LABELS[item.status] || item.status}
        </Badge>
      </Table.Td>
    </Table.Tr>
  ))

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Início / Fiscal / Notas do Fornecedor (DFe)</Text>
      <Group justify="space-between" align="center">
        <div>
          <Title order={3}>Notas do Fornecedor (DFe)</Title>
          <Text size="sm" c="dimmed">
            Consulta direto na SEFAZ as NF-e/CT-e emitidas contra o CNPJ da empresa e permite gerar o lançamento de entrada.
          </Text>
        </div>
        <Button
          leftSection={<IconCloudDownload size={16} />}
          onClick={handleConsultar}
          loading={consultarMutation.isPending}
        >
          Verificar Notas na SEFAZ
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Card withBorder p="lg">
          <Group>
            <ThemeIcon variant="light" color="blue" size={42} radius="md">
              <IconInbox size={22} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Pendentes de lançamento</Text>
              <Text size="xl" fw={700}>{statusInfo?.documentosPendentesLancamento ?? '-'}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder p="lg">
          <Group>
            <ThemeIcon variant="light" color="gray" size={42} radius="md">
              <IconClock size={22} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Último NSU consultado</Text>
              <Text size="xl" fw={700}>{statusInfo?.ultimoNsu ?? '-'}</Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      <Card withBorder p="lg">
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Documentos recebidos</Text>
          <Select
            placeholder="Filtrar por status"
            data={[
              { value: 'PENDENTE', label: 'Pendente' },
              { value: 'PROCESSADO', label: 'Processado' },
              { value: 'ENTRADA_GERADA', label: 'Entrada Gerada' },
            ]}
            value={statusFiltro}
            onChange={setStatusFiltro}
            clearable
            w={220}
          />
        </Group>

        <div style={{ position: 'relative', minHeight: 100 }}>
          <LoadingOverlay visible={isLoading} />

          {!isLoading && (!listagem?.data || listagem.data.length === 0) ? (
            <Text ta="center" c="dimmed" py="xl">
              Nenhuma nota encontrada. Clique em &quot;Verificar Notas na SEFAZ&quot; para consultar.
            </Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Chave de Acesso</Table.Th>
                  <Table.Th>Emitente</Table.Th>
                  <Table.Th>Valor</Table.Th>
                  <Table.Th>Emissão</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          )}
        </div>
      </Card>

      {/* Modal Detalhe */}
      <Modal
        opened={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
        title="Detalhes da Nota"
        size="lg"
      >
        {selectedDoc && (
          <Stack gap="md">
            <Group gap="lg">
              <div>
                <Text size="xs" c="dimmed">Chave de Acesso</Text>
                <Text size="sm" fw={500}>{selectedDoc.chaveAcesso}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Emitente</Text>
                <Text size="sm" fw={500}>{selectedDoc.emitenteRazao || selectedDoc.emitenteCnpj}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Valor</Text>
                <Text size="sm" fw={500}>
                  {selectedDoc.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Status</Text>
                <Badge color={STATUS_COLORS[selectedDoc.status] || 'gray'}>
                  {STATUS_LABELS[selectedDoc.status] || selectedDoc.status}
                </Badge>
              </div>
            </Group>

            {selectedDoc.status === 'PENDENTE' || selectedDoc.status === 'PROCESSADO' ? (
              <Button
                leftSection={<IconFileImport size={16} />}
                onClick={() => handleGerarEntrada(selectedDoc.id)}
                loading={gerarEntradaMutation.isPending}
                fullWidth
              >
                Gerar Entrada
              </Button>
            ) : (
              <Text size="sm" c="green" ta="center">
                Esta nota já possui entrada gerada.
              </Text>
            )}
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
