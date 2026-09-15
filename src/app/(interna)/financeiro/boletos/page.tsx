'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Group, Text, Table, Badge, Title, Stack, LoadingOverlay, Checkbox, FileButton, CopyButton, ActionIcon, Tooltip } from '@mantine/core'
import { IconFileText, IconChecks, IconUpload, IconCopy, IconCheck } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { cobrancaApi, type Boleto, type Convenio } from '@/hooks/financeiro/useCobrancaApi'
import { api } from '@/lib/api'
import { formatarBRL, formatarData } from '@/lib/financeiro/format'

const statusColor: Record<string, string> = { GERADO: 'blue', REGISTRADO: 'yellow', LIQUIDADO: 'green', BAIXADO: 'gray' }

export default function BoletosPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Boletos' }, [])
  const qc = useQueryClient()
  const [sel, setSel] = useState<string[]>([])
  const [convenioId, setConvenioId] = useState<string | null>(null)

  const { data: boletos = [], isLoading } = useQuery<Boleto[]>({ queryKey: ['cob-boletos'], queryFn: () => cobrancaApi.listarBoletos() })
  const { data: convenios = [] } = useQuery<Convenio[]>({ queryKey: ['cob-convenios'], queryFn: cobrancaApi.listarConvenios })

  const remessa = useMutation({
    mutationFn: () => cobrancaApi.gerarRemessa(convenioId!, sel),
    onSuccess: (r: any) => {
      const blob = new Blob([r.conteudo], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = r.nomeArquivo; a.click(); URL.revokeObjectURL(url)
      notifications.show({ color: 'green', message: `Remessa gerada (${r.boletos} boletos)` })
      setSel([]); qc.invalidateQueries({ queryKey: ['cob-boletos'] })
    },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })

  const retorno = useMutation({
    mutationFn: async (file: File) => cobrancaApi.processarRetorno(await file.text()),
    onSuccess: (r: any) => { notifications.show({ color: 'green', message: r.jaProcessado ? 'Retorno já processado' : `${r.liquidados} liquidado(s), ${r.orfaos} órfão(s)` }); qc.invalidateQueries({ queryKey: ['cob-boletos'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })

  async function abrirPdf(id: string) {
    const resp = await api.get(cobrancaApi.urlBoletoPdf(id), { responseType: 'blob' })
    const url = URL.createObjectURL(resp.data as Blob)
    window.open(url, '_blank')
  }

  const convenioAuto = convenioId ?? convenios[0]?.id ?? null

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between">
        <Title order={3}>Boletos</Title>
        <Group>
          {sel.length > 0 && convenioAuto && (
            <Button color="blue" leftSection={<IconChecks size={16} />} loading={remessa.isPending} onClick={() => { setConvenioId(convenioAuto); remessa.mutate() }}>Gerar remessa ({sel.length})</Button>
          )}
          <FileButton onChange={(f) => f && retorno.mutate(f)} accept=".ret,.txt">
            {(props) => <Button {...props} variant="light" leftSection={<IconUpload size={16} />} loading={retorno.isPending}>Importar retorno</Button>}
          </FileButton>
        </Group>
      </Group>
      <Card withBorder padding="sm">
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th w={40} /><Table.Th>Nosso Número</Table.Th><Table.Th>Linha Digitável</Table.Th><Table.Th ta="right">Valor</Table.Th><Table.Th>Vencimento</Table.Th><Table.Th>Status</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {boletos.map((b) => (
              <Table.Tr key={b.id}>
                <Table.Td>{b.status === 'GERADO' && <Checkbox checked={sel.includes(b.id)} onChange={(e) => setSel((s) => e.currentTarget.checked ? [...s, b.id] : s.filter((x) => x !== b.id))} />}</Table.Td>
                <Table.Td>{b.nossoNumero}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Text size="xs" ff="monospace">{b.linhaDigitavel}</Text>
                    <CopyButton value={b.linhaDigitavel}>{({ copied, copy }) => <ActionIcon size="xs" variant="subtle" onClick={copy}>{copied ? <IconCheck size={12} /> : <IconCopy size={12} />}</ActionIcon>}</CopyButton>
                  </Group>
                </Table.Td>
                <Table.Td ta="right">{formatarBRL(Number(b.valor))}</Table.Td>
                <Table.Td>{formatarData(b.vencimento)}</Table.Td>
                <Table.Td><Badge variant="light" color={statusColor[b.status] ?? 'gray'}>{b.status}</Badge></Table.Td>
                <Table.Td><Tooltip label="Abrir PDF"><ActionIcon variant="subtle" onClick={() => abrirPdf(b.id)}><IconFileText size={16} /></ActionIcon></Tooltip></Table.Td>
              </Table.Tr>
            ))}
            {boletos.length === 0 && !isLoading && <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center" py="md">Nenhum boleto. Emita a partir de Contas a Receber.</Text></Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  )
}
