'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, Select, FileInput, Table, Alert, LoadingOverlay, Code } from '@mantine/core'
import { IconUpload, IconCheck, IconDownload, IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const TIPOS = [
  { value: 'notas-entrada', label: 'Notas de Entrada (Recebimento)' },
  { value: 'pedidos-separacao', label: 'Pedidos de Separação (Venda)' },
  { value: 'produtos', label: 'Cadastro de Produtos' },
]

export default function ImportarPage() {
  useModuloGuard('WMS')
  const [tipo, setTipo] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [resultado, setResultado] = useState<any>(null)

  const importar = useMutation({
    mutationFn: async () => {
      if (!tipo || !file) throw new Error('Selecione tipo e arquivo')
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post(`/v1/integracao/importar/${tipo}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => {
      setResultado(data)
      notifications.show({ title: 'Sucesso', message: 'Arquivo processado', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  const downloadTemplate = async () => {
    if (!tipo) return
    try {
      const { data } = await api.get(`/v1/integracao/importar/templates/${tipo}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `template_${tipo}.csv`
      a.click()
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao baixar template', color: 'red' })
    }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Integração / Importar</Text>
      <Text size="xl" fw={600} mb="lg">Importação de Arquivos</Text>

      <Card mb="md" pos="relative">
        <LoadingOverlay visible={importar.isPending} />
        <Text fw={500} mb="sm">Upload de arquivo CSV ou XML</Text>
        <Text size="sm" c="dimmed" mb="md">
          Selecione o tipo de importação, baixe o template CSV e preencha com seus dados.
        </Text>

        <div className="flex flex-col gap-4 max-w-lg">
          <Select label="Tipo de Importação" data={TIPOS} value={tipo} onChange={(v) => { setTipo(v); setFile(null); setResultado(null) }} />

          {tipo && (
            <Button variant="light" leftSection={<IconDownload size={16} />} onClick={downloadTemplate} className="w-fit">
              Baixar Template CSV
            </Button>
          )}

          <FileInput
            label="Arquivo"
            placeholder="Selecione .csv ou .xml"
            accept=".csv,.xml"
            leftSection={<IconUpload size={16} />}
            value={file}
            onChange={(f) => { setFile(f); setResultado(null) }}
            disabled={!tipo}
          />

          <Button onClick={() => importar.mutate()} disabled={!tipo || !file} loading={importar.isPending} leftSection={<IconCheck size={16} />} className="w-fit">
            Importar
          </Button>
        </div>
      </Card>

      {resultado && (
        <Card>
          <Alert icon={<IconCheck size={16} />} title="Importação concluída" color="green" mb="md">
            {resultado.importadas} registros importados de {resultado.totalLinhas} linhas.
            {resultado.rejeitadas > 0 && ` ${resultado.rejeitadas} linhas rejeitadas.`}
          </Alert>

          {resultado.erros?.length > 0 && (
            <>
              <Text fw={500} mb="sm" c="red">Erros encontrados:</Text>
              <Table striped>
                <Table.Thead><Table.Tr><Table.Th>Linha</Table.Th><Table.Th>Campo</Table.Th><Table.Th>Mensagem</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {resultado.erros.map((e: any, idx: number) => (
                    <Table.Tr key={idx}><Table.Td>{e.linha}</Table.Td><Table.Td>{e.campo}</Table.Td><Table.Td>{e.mensagem}</Table.Td></Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          )}
        </Card>
      )}
    </div>
  )
}
