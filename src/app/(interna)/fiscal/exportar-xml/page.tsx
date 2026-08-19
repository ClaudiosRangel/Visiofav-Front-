'use client'

import { useEffect, useState } from 'react'
import {
  Paper,
  Title,
  Text,
  Grid,
  Select,
  Button,
  Group,
  Badge,
  Table,
  Loader,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { IconDownload, IconSearch } from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { api } from '@/lib/api'

const TIPOS_DOC = [
  { value: 'TODOS', label: 'Todos os Documentos' },
  { value: 'NFE', label: 'NF-e (Nota Fiscal)' },
  { value: 'NFCE', label: 'NFC-e (Cupom Fiscal)' },
  { value: 'CTE', label: 'CT-e (Transporte)' },
  { value: 'MDFE', label: 'MDF-e (Manifesto)' },
  { value: 'NFSE', label: 'NFS-e (Serviço)' },
]

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export default function ExportarXmlPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Exportar XMLs' }, [])

  const [tipo, setTipo] = useState('TODOS')
  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)
  const [resumo, setResumo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function consultarResumo() {
    if (!dataInicio || !dataFim) {
      notifications.show({ title: 'Atenção', message: 'Informe o período', color: 'yellow' })
      return
    }
    setLoading(true)
    try {
      const { data } = await api.get('/fiscal/exportar-xml/resumo', {
        params: { tipo, dataInicio: formatDate(dataInicio), dataFim: formatDate(dataFim) },
      })
      setResumo(data)
    } catch (err: any) {
      setResumo(null)
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao consultar',
        color: 'red',
      })
    }
    setLoading(false)
  }

  async function baixarZip() {
    if (!dataInicio || !dataFim) return
    setDownloading(true)
    try {
      const response = await api.get('/fiscal/exportar-xml', {
        params: { tipo, dataInicio: formatDate(dataInicio), dataFim: formatDate(dataFim) },
        responseType: 'blob',
      })
      const blob = new Blob([response.data], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `XMLs_${tipo}_${formatDate(dataInicio)}_a_${formatDate(dataFim)}.zip`
      a.click()
      URL.revokeObjectURL(url)
      notifications.show({ title: 'Sucesso', message: 'Download iniciado', color: 'green' })
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao exportar',
        color: 'red',
      })
    }
    setDownloading(false)
  }

  return (
    <Paper p="md">
      <Title order={3} mb="xs">Baixar / Enviar Arquivos (XML / PDF)</Title>
      <Text size="sm" c="dimmed" mb="lg">
        Início / Fiscal / Baixar Arquivos
      </Text>

      <Grid mb="lg">
        <Grid.Col span={3}>
          <Select label="Tipo de Documento" data={TIPOS_DOC} value={tipo}
            onChange={(v) => setTipo(v || 'TODOS')} />
        </Grid.Col>
        <Grid.Col span={3}>
          <DateInput label="Data Início" value={dataInicio}
            onChange={setDataInicio} valueFormat="DD/MM/YYYY" clearable />
        </Grid.Col>
        <Grid.Col span={3}>
          <DateInput label="Data Fim" value={dataFim}
            onChange={setDataFim} valueFormat="DD/MM/YYYY" clearable />
        </Grid.Col>
        <Grid.Col span={3}>
          <Group mt={24} gap="sm">
            <Button leftSection={<IconSearch size={16} />} onClick={consultarResumo}
              loading={loading} variant="light">
              Consultar
            </Button>
          </Group>
        </Grid.Col>
      </Grid>

      {resumo && (
        <Paper p="md" withBorder>
          <Group justify="space-between" mb="md">
            <div>
              <Text fw={600}>Documentos encontrados: {resumo.total}</Text>
              <Text size="sm" c="dimmed">
                Período: {resumo.periodo.inicio} a {resumo.periodo.fim}
              </Text>
            </div>
            <Button leftSection={<IconDownload size={16} />} color="green"
              onClick={baixarZip} loading={downloading}
              disabled={resumo.total === 0}>
              Baixar ZIP ({resumo.total} XMLs)
            </Button>
          </Group>

          {resumo.porTipo && resumo.porTipo.length > 0 && (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Quantidade</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {resumo.porTipo.map((item: any, idx: number) => (
                  <Table.Tr key={idx}>
                    <Table.Td>
                      <Badge variant="light">{item.tipo}</Badge>
                    </Table.Td>
                    <Table.Td>{item.status}</Table.Td>
                    <Table.Td>{item.quantidade}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      )}

      {!resumo && !loading && (
        <Text c="dimmed" ta="center" mt="xl">
          Selecione o período e clique em "Consultar" para ver os documentos disponíveis.
        </Text>
      )}
    </Paper>
  )
}
