'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, Stack, NumberInput, Alert, Divider } from '@mantine/core'
import { IconFileDownload, IconFileSpreadsheet, IconInfoCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** Dispara o download de um arquivo texto/CSV no navegador. */
function baixarTexto(nome: string, conteudo: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([conteudo], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportacaoTab() {
  const hoje = new Date()
  const [ano, setAno] = useState<number | ''>(hoje.getFullYear())
  const [mes, setMes] = useState<number | ''>(hoje.getMonth() + 1)
  const [gerando, setGerando] = useState(false)
  const [baixandoCsv, setBaixandoCsv] = useState<string | null>(null)

  const { data: empresa } = useQuery<any>({
    queryKey: ['empresa-minha-id'],
    queryFn: () => api.get('/empresas/minha').then((r) => r.data),
  })

  const gerarEcd = async () => {
    if (!empresa?.id) { notifications.show({ color: 'red', message: 'Empresa da sessão não identificada' }); return }
    setGerando(true)
    try {
      const { data } = await api.post('/fiscal/sped/ecd', { empresaId: empresa.id, ano: Number(ano), mes: Number(mes) })
      notifications.show({ color: 'green', message: `ECD gerada: ${data.nomeArquivo} (${data.totalRegistros} registros)` })
    } catch (e: any) {
      notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Falha ao gerar ECD' })
    } finally {
      setGerando(false)
    }
  }

  const baixarCsv = async (tipo: 'diario' | 'balancete') => {
    setBaixandoCsv(tipo)
    try {
      const { data } = await api.get(`/financeiro/contabil/exportar/${tipo}`, { responseType: 'text' })
      baixarTexto(`${tipo}-contabil.csv`, typeof data === 'string' ? data : String(data))
    } catch (e: any) {
      notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Falha na exportação' })
    } finally {
      setBaixandoCsv(null)
    }
  }

  return (
    <Stack>
      <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
        A ECD usa a contabilidade real (plano de contas + lançamentos) quando existe; caso contrário, deriva dos documentos fiscais. O CSV exporta o diário e o balancete para importar em software contábil (Domínio/Fortes).
      </Alert>

      <Card withBorder padding="md">
        <Text fw={600} mb="sm">SPED Contábil (ECD)</Text>
        <Group align="flex-end">
          <NumberInput label="Ano" value={ano} onChange={(v) => setAno(v as number)} min={2000} max={2100} w={120} />
          <NumberInput label="Mês" value={mes} onChange={(v) => setMes(v as number)} min={1} max={12} w={100} />
          <Button leftSection={<IconFileDownload size={16} />} loading={gerando} onClick={gerarEcd}>Gerar ECD</Button>
        </Group>
      </Card>

      <Divider />

      <Card withBorder padding="md">
        <Text fw={600} mb="sm">Exportação CSV (para software contábil)</Text>
        <Group>
          <Button variant="light" leftSection={<IconFileSpreadsheet size={16} />} loading={baixandoCsv === 'balancete'} onClick={() => baixarCsv('balancete')}>Baixar Balancete (CSV)</Button>
          <Button variant="light" leftSection={<IconFileSpreadsheet size={16} />} loading={baixandoCsv === 'diario'} onClick={() => baixarCsv('diario')}>Baixar Diário (CSV)</Button>
        </Group>
      </Card>
    </Stack>
  )
}
