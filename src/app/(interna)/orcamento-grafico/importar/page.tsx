'use client'

import { useState, useCallback } from 'react'
import {
  Title, Stack, Paper, Group, Button, Table, Badge, Text,
  Alert, Progress, FileInput, ScrollArea,
} from '@mantine/core'
import { IconUpload, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface RegistroImportacao {
  descricao: string
  tipo: string
  unidade: string
  precoUnitario: number
  dataVigencia?: string
  valido: boolean
  erros: string[]
}

interface PreviewResponse {
  importacaoId: string
  totalRegistros: number
  totalValidos: number
  totalErros: number
  registros: RegistroImportacao[]
}

export default function ImportarMateriaisPage() {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [resultado, setResultado] = useState<{ totalImportados: number; message: string } | null>(null)

  const handleUpload = useCallback(async () => {
    if (!arquivo) return
    setCarregando(true)
    setPreview(null)
    setResultado(null)

    try {
      const formData = new FormData()
      formData.append('file', arquivo)

      const response = await api.post('/orcamento-grafico/importar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPreview(response.data)
    } catch (err: any) {
      notifications.show({
        title: 'Erro no upload',
        message: err.response?.data?.message || 'Falha ao processar arquivo',
        color: 'red',
      })
    } finally {
      setCarregando(false)
    }
  }, [arquivo])

  const handleConfirmar = useCallback(async () => {
    if (!preview) return
    setConfirmando(true)

    try {
      const response = await api.post('/orcamento-grafico/importar/confirmar', {
        importacaoId: preview.importacaoId,
      })
      setResultado(response.data)
      setPreview(null)
      notifications.show({
        title: 'Importação concluída',
        message: response.data.message,
        color: 'green',
      })
    } catch (err: any) {
      notifications.show({
        title: 'Erro na importação',
        message: err.response?.data?.message || 'Falha ao confirmar importação',
        color: 'red',
      })
    } finally {
      setConfirmando(false)
    }
  }, [preview])

  return (
    <Stack gap="lg" p="md">
      <Title order={2}>Importar Materiais e Preços</Title>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Envie um arquivo CSV com as colunas: descricao, tipo, unidade, precoUnitario, dataVigencia (opcional).
            Separador aceito: ; ou ,
          </Text>

          <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
            <Text size="sm">
              <strong>Tipos válidos:</strong> PAPEL, TINTA, VERNIZ, COLA, FACA, BOPP, OUTRO<br />
              <strong>Unidades válidas:</strong> KG, M2, UN, LT, ML, M, PC, FL, RS<br />
              <strong>Preço:</strong> use vírgula como decimal (ex: 15,50) ou ponto (ex: 15.50)
            </Text>
          </Alert>

          <Group>
            <FileInput
              placeholder="Selecione o arquivo CSV"
              accept=".csv,.xlsx,.xls"
              value={arquivo}
              onChange={setArquivo}
              style={{ flex: 1 }}
            />
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={handleUpload}
              loading={carregando}
              disabled={!arquivo}
            >
              Enviar
            </Button>
          </Group>
        </Stack>
      </Paper>

      {preview && (
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>Preview da Importação</Title>
              <Group gap="xs">
                <Badge color="green" size="lg">{preview.totalValidos} válidos</Badge>
                {preview.totalErros > 0 && (
                  <Badge color="red" size="lg">{preview.totalErros} com erro</Badge>
                )}
              </Group>
            </Group>

            <Progress
              value={(preview.totalValidos / preview.totalRegistros) * 100}
              color="green"
              size="lg"
            />

            <ScrollArea h={400}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Descrição</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Unidade</Table.Th>
                    <Table.Th>Preço Unit.</Table.Th>
                    <Table.Th>Erros</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {preview.registros.map((reg, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td>
                        {reg.valido ? (
                          <IconCheck size={16} color="green" />
                        ) : (
                          <IconX size={16} color="red" />
                        )}
                      </Table.Td>
                      <Table.Td>{reg.descricao || '-'}</Table.Td>
                      <Table.Td>
                        <Badge size="sm" variant="light">{reg.tipo}</Badge>
                      </Table.Td>
                      <Table.Td>{reg.unidade}</Table.Td>
                      <Table.Td>
                        {reg.precoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </Table.Td>
                      <Table.Td>
                        {reg.erros.length > 0 && (
                          <Text size="xs" c="red">{reg.erros.join('; ')}</Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPreview(null)}>Cancelar</Button>
              <Button
                color="green"
                leftSection={<IconCheck size={16} />}
                onClick={handleConfirmar}
                loading={confirmando}
                disabled={preview.totalValidos === 0}
              >
                Confirmar Importação ({preview.totalValidos} registros)
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}

      {resultado && (
        <Alert icon={<IconCheck size={16} />} color="green" variant="light">
          {resultado.message}
        </Alert>
      )}
    </Stack>
  )
}
