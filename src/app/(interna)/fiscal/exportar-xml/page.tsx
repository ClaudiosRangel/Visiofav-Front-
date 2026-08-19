'use client'

import { useEffect, useState } from 'react'
import {
  Paper, Title, Text, Grid, Select, Button, Group, Badge, Table, TextInput, Modal, Stack, SegmentedControl,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { IconDownload, IconSearch, IconMail } from '@tabler/icons-react'
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

const FORMATOS = [
  { value: 'xml', label: 'Somente XML' },
  { value: 'pdf', label: 'Somente PDF' },
  { value: 'ambos', label: 'XML + PDF' },
]

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export default function ExportarXmlPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Baixar / Enviar Arquivos' }, [])

  const [tipo, setTipo] = useState('TODOS')
  const [formato, setFormato] = useState('xml')
  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)
  const [resumo, setResumo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emails, setEmails] = useState('')
  const [enviando, setEnviando] = useState(false)

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
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao consultar', color: 'red' })
    }
    setLoading(false)
  }

  async function baixarZip() {
    if (!dataInicio || !dataFim) return
    setDownloading(true)
    try {
      const response = await api.get('/fiscal/exportar-xml', {
        params: { tipo, formato, dataInicio: formatDate(dataInicio), dataFim: formatDate(dataFim) },
        responseType: 'blob',
      })
      const blob = new Blob([response.data], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Arquivos_${tipo}_${formatDate(dataInicio)}_a_${formatDate(dataFim)}.zip`
      a.click()
      URL.revokeObjectURL(url)
      notifications.show({ title: 'Download iniciado', message: `${resumo?.total || 0} arquivo(s)`, color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao exportar', color: 'red' })
    }
    setDownloading(false)
  }

  async function enviarPorEmail() {
    const listaEmails = emails.split(',').map(e => e.trim()).filter(Boolean)
    if (listaEmails.length === 0) {
      notifications.show({ title: 'Atenção', message: 'Informe ao menos um e-mail', color: 'yellow' })
      return
    }
    if (!dataInicio || !dataFim) return
    setEnviando(true)
    try {
      await api.post('/fiscal/exportar-xml/enviar-email', {
        tipo, formato,
        dataInicio: formatDate(dataInicio),
        dataFim: formatDate(dataFim),
        emails: listaEmails,
      })
      notifications.show({ title: 'Enviado', message: `Arquivos enviados para ${listaEmails.length} e-mail(s)`, color: 'green' })
      setEmailModalOpen(false)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao enviar', color: 'red' })
    }
    setEnviando(false)
  }

  return (
    <Paper p="md">
      <Title order={3} mb="xs">Baixar / Enviar Arquivos (XML / PDF)</Title>
      <Text size="sm" c="dimmed" mb="lg">
        Início / Fiscal / Baixar Arquivos
      </Text>

      <Grid mb="lg" align="end">
        <Grid.Col span={2}>
          <Select label="Tipo de Documento" data={TIPOS_DOC} value={tipo}
            onChange={(v) => setTipo(v || 'TODOS')} />
        </Grid.Col>
        <Grid.Col span={2}>
          <DateInput label="Data Início" value={dataInicio}
            onChange={setDataInicio} valueFormat="DD/MM/YYYY" clearable />
        </Grid.Col>
        <Grid.Col span={2}>
          <DateInput label="Data Fim" value={dataFim}
            onChange={setDataFim} valueFormat="DD/MM/YYYY" clearable />
        </Grid.Col>
        <Grid.Col span={3}>
          <Text size="sm" fw={500} mb={4}>Formato</Text>
          <SegmentedControl data={FORMATOS} value={formato} onChange={setFormato} size="xs" fullWidth />
        </Grid.Col>
        <Grid.Col span={3}>
          <Button leftSection={<IconSearch size={16} />} onClick={consultarResumo}
            loading={loading} fullWidth>
            Consultar
          </Button>
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
            <Group gap="sm">
              <Button leftSection={<IconMail size={16} />} variant="light"
                onClick={() => setEmailModalOpen(true)} disabled={resumo.total === 0}>
                Enviar por E-mail
              </Button>
              <Button leftSection={<IconDownload size={16} />} color="green"
                onClick={baixarZip} loading={downloading} disabled={resumo.total === 0}>
                Baixar ZIP ({resumo.total} {formato === 'xml' ? 'XMLs' : formato === 'pdf' ? 'PDFs' : 'arquivos'})
              </Button>
            </Group>
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
                    <Table.Td><Badge variant="light">{item.tipo}</Badge></Table.Td>
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

      {/* Modal de envio por e-mail */}
      <Modal opened={emailModalOpen} onClose={() => setEmailModalOpen(false)} title="Enviar Arquivos por E-mail">
        <Stack gap="sm">
          <Text size="sm">
            {resumo?.total || 0} documento(s) serão enviados como ZIP ({formato === 'xml' ? 'XMLs' : formato === 'pdf' ? 'PDFs' : 'XML + PDF'}).
          </Text>
          <TextInput
            label="E-mails (separados por vírgula)"
            placeholder="contador@email.com, financeiro@email.com"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            required
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setEmailModalOpen(false)}>Cancelar</Button>
            <Button leftSection={<IconMail size={16} />} onClick={enviarPorEmail} loading={enviando}>
              Enviar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  )
}
