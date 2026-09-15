'use client'

import { useEffect, useState } from 'react'
import { Card, Group, Text, Table, Badge, Title, Stack, LoadingOverlay, ActionIcon, Tooltip, Modal, Image, CopyButton, Button } from '@mantine/core'
import { IconQrcode, IconCopy, IconCheck } from '@tabler/icons-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { cobrancaApi, type PixCobranca } from '@/hooks/financeiro/useCobrancaApi'
import { formatarBRL } from '@/lib/financeiro/format'

const statusColor: Record<string, string> = { ATIVA: 'blue', PAGA: 'green', EXPIRADA: 'gray' }

export default function PixPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - PIX' }, [])
  const [qrModal, setQrModal] = useState<{ brcode: string; img: string } | null>(null)

  const { data: cobrancas = [], isLoading } = useQuery<PixCobranca[]>({ queryKey: ['cob-pix'], queryFn: cobrancaApi.listarPix })

  const verQr = useMutation({
    mutationFn: (c: PixCobranca) => cobrancaApi.qrcodePix(c.id).then((r) => ({ brcode: c.brcode, img: r.qrcode })),
    onSuccess: (r) => setQrModal(r),
  })

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Title order={3}>Cobranças PIX</Title>
      <Card withBorder padding="sm">
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>TXID</Table.Th><Table.Th ta="right">Valor</Table.Th><Table.Th>Status</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {cobrancas.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td><Text size="xs" ff="monospace">{c.txid}</Text></Table.Td>
                <Table.Td ta="right">{formatarBRL(c.valor)}</Table.Td>
                <Table.Td><Badge variant="light" color={statusColor[c.status] ?? 'gray'}>{c.status}</Badge></Table.Td>
                <Table.Td><Tooltip label="Ver QR Code"><ActionIcon variant="subtle" onClick={() => verQr.mutate(c)}><IconQrcode size={16} /></ActionIcon></Tooltip></Table.Td>
              </Table.Tr>
            ))}
            {cobrancas.length === 0 && !isLoading && <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center" py="md">Nenhuma cobrança PIX. Gere a partir de Contas a Receber.</Text></Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>
      <Modal opened={Boolean(qrModal)} onClose={() => setQrModal(null)} title="QR Code PIX" centered>
        {qrModal && (
          <Stack align="center">
            {qrModal.img ? <Image src={qrModal.img} w={220} h={220} alt="QR Code PIX" /> : <Text c="dimmed">QR indisponível</Text>}
            <Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>{qrModal.brcode}</Text>
            <CopyButton value={qrModal.brcode}>{({ copied, copy }) => <Button variant="light" leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy}>{copied ? 'Copiado' : 'Copiar copia-e-cola'}</Button>}</CopyButton>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
