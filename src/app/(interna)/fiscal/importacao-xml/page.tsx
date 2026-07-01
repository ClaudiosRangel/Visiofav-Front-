'use client'

import { useEffect, useState } from 'react'
import {
  Stack, Text, Title, Table, Badge, Button, Card, Group,
  LoadingOverlay, Modal, FileInput,
} from '@mantine/core'
import { IconUpload, IconFileImport } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useImportacaoXml, type ImportacaoXml } from '@/data/hooks/fiscal/useImportacaoXml'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const STATUS_COLORS: Record<string, string> = {
  IMPORTADO: 'blue',
  PROCESSADO: 'green',
  ERRO: 'red',
}

export default function ImportacaoXmlPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Importação XML' }, [])

  const { useListar, useUpload, useGerarEntrada } = useImportacaoXml()
  const { data: listagem, isLoading } = useListar()
  const uploadMutation = useUpload()
  const gerarEntradaMutation = useGerarEntrada()

  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [selectedXml, setSelectedXml] = useState<ImportacaoXml | null>(null)

  function handleUpload() {
    if (selectedFiles.length === 0) return

    uploadMutation.mutate(selectedFiles, {
      onSuccess: () => {
        notifications.show({
          title: 'Upload realizado',
          message: `${selectedFiles.length} arquivo(s) XML importado(s) com sucesso.`,
          color: 'green',
        })
        setUploadModalOpen(false)
        setSelectedFiles([])
      },
      onError: (error: any) => {
        notifications.show({
          title: 'Erro no upload',
          message: error?.response?.data?.message || 'Não foi possível fazer o upload dos arquivos XML.',
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
          message: 'Nota de entrada gerada com sucesso a partir do XML importado.',
          color: 'green',
        })
        setSelectedXml(null)
      },
      onError: (error: any) => {
        notifications.show({
          title: 'Erro ao gerar entrada',
          message: error?.response?.data?.message || 'Não foi possível gerar a nota de entrada.',
          color: 'red',
        })
      },
    })
  }

  const rows = (listagem?.data ?? []).map((item) => (
    <Table.Tr
      key={item.id}
      onClick={() => setSelectedXml(item)}
      style={{ cursor: 'pointer' }}
    >
      <Table.Td>
        <Text size="sm" lineClamp={1} maw={280}>
          {item.chaveAcesso}
        </Text>
      </Table.Td>
      <Table.Td>{item.fornecedor}</Table.Td>
      <Table.Td>
        {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </Table.Td>
      <Table.Td>{new Date(item.data).toLocaleDateString('pt-BR')}</Table.Td>
      <Table.Td>
        <Badge color={STATUS_COLORS[item.status] || 'gray'}>
          {item.status}
        </Badge>
      </Table.Td>
    </Table.Tr>
  ))

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Início / Fiscal / Importação XML</Text>
      <Group justify="space-between" align="center">
        <Title order={3}>Importação XML</Title>
        <Button
          leftSection={<IconUpload size={16} />}
          onClick={() => setUploadModalOpen(true)}
        >
          Upload XML
        </Button>
      </Group>

      <Card withBorder p="lg">
        <div style={{ position: 'relative', minHeight: 100 }}>
          <LoadingOverlay visible={isLoading} />

          {!isLoading && (!listagem?.data || listagem.data.length === 0) ? (
            <Text ta="center" c="dimmed" py="xl">
              Nenhum XML importado ainda.
            </Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Chave</Table.Th>
                  <Table.Th>Fornecedor</Table.Th>
                  <Table.Th>Valor</Table.Th>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          )}
        </div>
      </Card>

      {/* Modal Upload XML */}
      <Modal
        opened={uploadModalOpen}
        onClose={() => { setUploadModalOpen(false); setSelectedFiles([]) }}
        title="Upload de Arquivos XML"
        size="md"
        centered
      >
        <Stack gap="md">
          <FileInput
            label="Selecione arquivos XML"
            placeholder="Clique para selecionar .xml"
            accept=".xml"
            multiple
            value={selectedFiles}
            onChange={(files) => setSelectedFiles(files)}
            leftSection={<IconUpload size={16} />}
          />
          <Button
            onClick={handleUpload}
            loading={uploadMutation.isPending}
            disabled={selectedFiles.length === 0}
            fullWidth
          >
            Enviar {selectedFiles.length > 0 ? `(${selectedFiles.length} arquivo${selectedFiles.length > 1 ? 's' : ''})` : ''}
          </Button>
        </Stack>
      </Modal>

      {/* Modal Detalhe XML (itens + de-para + gerar entrada) */}
      <Modal
        opened={!!selectedXml}
        onClose={() => setSelectedXml(null)}
        title="Detalhes do XML Importado"
        size="lg"
      >
        {selectedXml && (
          <Stack gap="md">
            <Group gap="lg">
              <div>
                <Text size="xs" c="dimmed">Chave de Acesso</Text>
                <Text size="sm" fw={500}>{selectedXml.chaveAcesso}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Fornecedor</Text>
                <Text size="sm" fw={500}>{selectedXml.fornecedor}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Valor</Text>
                <Text size="sm" fw={500}>
                  {selectedXml.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Status</Text>
                <Badge color={STATUS_COLORS[selectedXml.status] || 'gray'}>
                  {selectedXml.status}
                </Badge>
              </div>
            </Group>

            <Card withBorder p="sm">
              <Text size="sm" fw={600} mb="xs">Itens — De-Para (Produto Fornecedor → Produto Interno)</Text>
              <Text size="sm" c="dimmed">
                Os itens do XML serão exibidos aqui com o mapeamento de-para entre o produto do fornecedor e o produto interno do sistema.
              </Text>
            </Card>

            {selectedXml.status === 'IMPORTADO' && (
              <Button
                leftSection={<IconFileImport size={16} />}
                onClick={() => handleGerarEntrada(selectedXml.id)}
                loading={gerarEntradaMutation.isPending}
                fullWidth
              >
                Gerar Entrada
              </Button>
            )}

            {selectedXml.status === 'PROCESSADO' && (
              <Text size="sm" c="green" ta="center">
                Este XML já foi processado e a entrada foi gerada.
              </Text>
            )}

            {selectedXml.status === 'ERRO' && (
              <Text size="sm" c="red" ta="center">
                Houve um erro no processamento deste XML. Verifique os dados e tente novamente.
              </Text>
            )}
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
