'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Button, Badge, Code, Stack, Alert,
} from '@mantine/core'
import { IconDownload, IconInfoCircle, IconApi } from '@tabler/icons-react'
import { DatePickerInput } from '@mantine/dates'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { notifications } from '@mantine/notifications'

const ENDPOINTS = [
  {
    metodo: 'GET',
    path: '/api/bi/exportar/kpis',
    descricao: 'Exporta todos os KPIs consolidados por período',
    parametros: 'dataInicio, dataFim',
  },
  {
    metodo: 'GET',
    path: '/api/bi/exportar/custos',
    descricao: 'Exporta breakdown de custos por operação',
    parametros: 'dataInicio, dataFim',
  },
  {
    metodo: 'GET',
    path: '/api/bi/exportar/movimentacoes',
    descricao: 'Exporta dados de movimentações para análise',
    parametros: 'dataInicio, dataFim, tipoOperacao',
  },
  {
    metodo: 'GET',
    path: '/api/bi/exportar/ocupacao',
    descricao: 'Exporta histórico de ocupação do armazém',
    parametros: 'dataInicio, dataFim',
  },
  {
    metodo: 'GET',
    path: '/api/bi/exportar/produtividade',
    descricao: 'Exporta métricas de produtividade por operador/equipe',
    parametros: 'dataInicio, dataFim',
  },
]

export default function BiExportarPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Exportar Power BI' }, [])

  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(new Date().setDate(new Date().getDate() - 30)),
    new Date(),
  ])
  const [downloading, setDownloading] = useState(false)

  async function handleExport() {
    if (!dateRange[0] || !dateRange[1]) {
      notifications.show({ title: 'Atenção', message: 'Selecione o período', color: 'yellow' })
      return
    }

    setDownloading(true)
    try {
      const response = await api.get('/bi/exportar', {
        params: {
          dataInicio: dateRange[0].toISOString().split('T')[0],
          dataFim: dateRange[1].toISOString().split('T')[0],
        },
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `bi-export-${dateRange[0].toISOString().split('T')[0]}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      notifications.show({ title: 'Sucesso', message: 'Arquivo exportado com sucesso', color: 'green' })
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao exportar dados', color: 'red' })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / BI Avançado / Exportação</Text>
      <Text size="xl" fw={600} mb="lg">Exportação Power BI</Text>

      <Alert icon={<IconInfoCircle size={16} />} color="blue" mb="md">
        Use os endpoints abaixo para conectar o Power BI diretamente ao WMS via API REST.
        Alternativamente, baixe um arquivo consolidado usando o botão de download.
      </Alert>

      {/* Download direto */}
      <Card withBorder mb="xl">
        <Text fw={500} mb="md">Download de Dados</Text>
        <Group align="end">
          <DatePickerInput
            type="range"
            label="Período"
            placeholder="Selecione o período"
            value={dateRange}
            onChange={setDateRange}
            w={320}
          />
          <Button
            leftSection={<IconDownload size={16} />}
            loading={downloading}
            onClick={handleExport}
          >
            Exportar Excel
          </Button>
        </Group>
      </Card>

      {/* Documentação dos endpoints */}
      <Card withBorder>
        <Group mb="md" gap="xs">
          <IconApi size={20} />
          <Text fw={500}>Endpoints Disponíveis para Integração</Text>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Método</Table.Th>
              <Table.Th>Endpoint</Table.Th>
              <Table.Th>Descrição</Table.Th>
              <Table.Th>Parâmetros</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ENDPOINTS.map((ep) => (
              <Table.Tr key={ep.path}>
                <Table.Td>
                  <Badge color="green" variant="filled" size="sm">{ep.metodo}</Badge>
                </Table.Td>
                <Table.Td>
                  <Code>{ep.path}</Code>
                </Table.Td>
                <Table.Td>{ep.descricao}</Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">{ep.parametros}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Card withBorder mt="md" bg="gray.0">
          <Text size="sm" fw={500} mb="xs">Exemplo de uso no Power BI</Text>
          <Code block>
{`// Power Query M - Fonte de dados Web
let
    Source = Web.Contents(
        "https://seu-dominio.com/api/bi/exportar/kpis",
        [
            Query = [dataInicio = "2024-01-01", dataFim = "2024-12-31"],
            Headers = [Authorization = "Bearer SEU_TOKEN"]
        ]
    ),
    JsonResponse = Json.Document(Source)
in
    JsonResponse`}
          </Code>
        </Card>
      </Card>
    </div>
  )
}
