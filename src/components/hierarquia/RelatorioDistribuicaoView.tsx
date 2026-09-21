'use client'

import { useEffect, useState } from 'react'
import {
  Card, Group, Text, Table, Button, LoadingOverlay, Badge, Alert, Divider,
} from '@mantine/core'
import { IconChartBar, IconDownload, IconAlertCircle } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

/**
 * Relatório de distribuição de produtos por nível da Hierarquia Mercadológica
 * (Fase 2). Compartilhado por WMS e Compras via wrappers finos.
 */

interface LinhaDistribuicao {
  id: string
  tipo: string
  codigo: string
  codigoHierarquico: string
  descricao: string
  contagem: number
}

interface Distribuicao {
  niveis: LinhaDistribuicao[]
  totalComHierarquia: number
  totalSemHierarquia: number
  totalGeral: number
}

const TIPO_LABEL: Record<string, string> = {
  DEPARTAMENTO: 'Departamento',
  SECAO: 'Seção',
  CATEGORIA: 'Categoria',
  SUBCATEGORIA: 'Subcategoria / Família',
}

interface Props {
  breadcrumb?: string
  modulosPermitidos?: string[]
}

export default function RelatorioDistribuicaoView({
  breadcrumb = 'Relatório de Distribuição por Nível',
  modulosPermitidos = ['WMS', 'COMPRAS'],
}: Props) {
  useModuloGuard(modulosPermitidos)
  useEffect(() => { document.title = 'Vizor - Distribuição por Hierarquia' }, [])

  const { data, isLoading, isError } = useQuery<Distribuicao>({
    queryKey: ['hierarquia-distribuicao'],
    queryFn: async () => {
      const { data } = await api.get('/hierarquia-mercadologica/relatorio/distribuicao')
      return data
    },
  })

  const [baixando, setBaixando] = useState(false)
  async function exportar(formato: 'csv' | 'xlsx') {
    setBaixando(true)
    try {
      const resp = await api.get('/hierarquia-mercadologica/relatorio/distribuicao/export', {
        params: { formato },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(resp.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `distribuicao-hierarquia.${formato === 'xlsx' ? 'xls' : 'csv'}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao exportar', color: 'red' })
    } finally {
      setBaixando(false)
    }
  }

  // Agrupa por tipo para exibição, preservando a ordem hierárquica dos códigos.
  const porTipo = (tipo: string) => (data?.niveis || []).filter((n) => n.tipo === tipo)

  return (
    <div className="p-4">
      <Text size="xs" c="dimmed" mb={4}>{breadcrumb}</Text>
      <Group justify="space-between" mb="md">
        <Group gap={8}>
          <IconChartBar size={22} />
          <Text size="xl" fw={600}>Distribuição por Hierarquia Mercadológica</Text>
        </Group>
        <Group gap={8}>
          <Button variant="light" leftSection={<IconDownload size={16} />} loading={baixando} onClick={() => exportar('csv')}>
            Exportar CSV
          </Button>
          <Button variant="light" leftSection={<IconDownload size={16} />} loading={baixando} onClick={() => exportar('xlsx')}>
            Exportar Excel
          </Button>
        </Group>
      </Group>

      {isError && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          Não foi possível gerar o relatório de distribuição.
        </Alert>
      )}

      {data && (
        <Group mb="md" gap="sm">
          <Badge color="teal" variant="light" size="lg">Com hierarquia: {data.totalComHierarquia}</Badge>
          <Badge color="gray" variant="light" size="lg">Sem hierarquia: {data.totalSemHierarquia}</Badge>
          <Badge color="blue" variant="light" size="lg">Total: {data.totalGeral}</Badge>
        </Group>
      )}

      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        {(['DEPARTAMENTO', 'SECAO', 'CATEGORIA', 'SUBCATEGORIA'] as const).map((tipo) => {
          const linhas = porTipo(tipo)
          if (linhas.length === 0) return null
          return (
            <div key={tipo} className="mb-4">
              <Divider label={TIPO_LABEL[tipo]} labelPosition="left" mb="xs" />
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 200 }}>Código</Table.Th>
                    <Table.Th>Descrição</Table.Th>
                    <Table.Th style={{ width: 120 }} ta="right">Produtos</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {linhas.map((n) => (
                    <Table.Tr key={n.id}>
                      <Table.Td><Text ff="monospace" fw={500}>{n.codigoHierarquico}</Text></Table.Td>
                      <Table.Td>{n.descricao}</Table.Td>
                      <Table.Td ta="right">{n.contagem}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )
        })}
        {data && data.niveis.length === 0 && !isLoading && (
          <Text c="dimmed" ta="center" py="md">Nenhum nível mercadológico cadastrado.</Text>
        )}
      </Card>
    </div>
  )
}
