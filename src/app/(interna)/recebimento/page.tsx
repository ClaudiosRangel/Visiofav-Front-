'use client'

import { useState, useEffect } from 'react'
import { Card, Group, Text, SimpleGrid, ThemeIcon, Badge, Table, Button, LoadingOverlay, ActionIcon, Tooltip } from '@mantine/core'
import { IconFileInvoice, IconClipboardCheck, IconMapPin, IconTruckDelivery, IconPlus, IconEye, IconTrash, IconUpload, IconLink } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useRouter } from 'next/navigation'
import { useNotasEntrada, useCriarNotaEntrada, useAlterarStatusNota, useExcluirNotaEntrada } from '@/data/hooks/useNotaEntrada'
import { useCentrosDistribuicao } from '@/data/hooks/useCentroDistribuicao'
import { api } from '@/lib/api'
import NotaDetalheModal from './NotaDetalheModal'
import NotaEntradaModal from './NotaEntradaModal'

const statusColor: Record<string, string> = { PENDENTE: 'orange', CONFERIDA: 'blue', ENDERECADA: 'green', CANCELADA: 'red' }

export default function RecebimentoPage() {
  useEffect(() => { document.title = 'Vizor - WMS - Recebimento' }, [])
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const [importedData, setImportedData] = useState<any>(null)

  const { data: response, isLoading } = useNotasEntrada()
  const criarNota = useCriarNotaEntrada()
  const alterarStatus = useAlterarStatusNota()
  const excluirNota = useExcluirNotaEntrada()
  const { data: cdsResp } = useCentrosDistribuicao({ limit: 1 })

  const notas = response?.data || []
  const countByStatus = (s: string) => notas.filter((n: any) => n.status === s).length

  async function handleImportXml() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xml'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return

      const formData = new FormData()
      formData.append('file', file)

      try {
        const resp = await api.post('/notas-entrada/importar-xml', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        setImportedData(resp.data)
        setModalOpen(true)
        notifications.show({ title: 'XML importado', message: `NF ${resp.data.numero} - ${resp.data.itens?.length || 0} itens`, color: 'blue' })
      } catch (err: any) {
        notifications.show({ title: 'Erro', message: err.response?.data?.message || 'Falha ao importar XML', color: 'red' })
      }
    }
    input.click()
  }

  function handleNew() {
    setImportedData(null)
    setModalOpen(true)
  }

  async function handleSaveNota(data: any) {
    try {
      await criarNota.mutateAsync(data)
      notifications.show({ title: 'Sucesso', message: 'Nota criada', color: 'green' })
      setModalOpen(false)
      setImportedData(null)
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao criar', color: 'red' })
    }
  }

  async function handleStatusChange(id: string, status: string) {
    if (status === 'ENDERECADA') {
      const cdId = cdsResp?.data?.[0]?.id
      if (!cdId) { notifications.show({ title: 'Erro', message: 'Nenhum CD cadastrado', color: 'red' }); return }
      try {
        const resp = await api.post('/operacoes/enderecamento-automatico', { notaEntradaId: id, centroDistribuicaoId: cdId })
        notifications.show({ title: 'Sucesso', message: resp.data.message, color: 'green' })
        window.location.reload()
      } catch (err: any) {
        notifications.show({ title: 'Erro', message: err.response?.data?.message || 'Falha', color: 'red' })
      }
      return
    }
    try { await alterarStatus.mutateAsync({ id, status }); notifications.show({ title: 'Sucesso', message: `Status: ${status}`, color: 'green' }) }
    catch { notifications.show({ title: 'Erro', message: 'Falha', color: 'red' }) }
  }

  async function handleDelete(id: string, num: number) {
    if (!confirm(`Excluir NF ${num}?`)) return
    try { await excluirNota.mutateAsync(id); notifications.show({ title: 'Sucesso', message: 'Excluída', color: 'green' }) }
    catch { notifications.show({ title: 'Erro', message: 'Falha', color: 'red' }) }
  }

  const stats = [
    { title: 'Pendentes', value: String(countByStatus('PENDENTE')), icon: IconFileInvoice, color: 'orange' },
    { title: 'Conferidas', value: String(countByStatus('CONFERIDA')), icon: IconClipboardCheck, color: 'blue' },
    { title: 'Endereçadas', value: String(countByStatus('ENDERECADA')), icon: IconMapPin, color: 'grape' },
    { title: 'Total', value: String(notas.length), icon: IconTruckDelivery, color: 'green' },
  ]

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Recebimento</Text>
      <Text size="xl" fw={600} mb="lg">Recebimento</Text>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="xl">
        {stats.map((s) => (
          <Card key={s.title}><Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>{s.title}</Text><Text size="xl" fw={700} mt={4}>{s.value}</Text></div><ThemeIcon color={s.color} variant="light" size={48} radius="md"><s.icon size={24} /></ThemeIcon></Group></Card>
        ))}
      </SimpleGrid>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <Text fw={600}>Notas Fiscais de Entrada</Text>
          <Group>
            <Button variant="light" color="blue" leftSection={<IconUpload size={16} />} onClick={handleImportXml}>Importar XML</Button>
            <Button variant="light" color="grape" leftSection={<IconLink size={16} />} onClick={() => router.push('/recebimento/importar-xml-depara')}>Importar XML (De-Para)</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Nova Nota</Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>NF</Table.Th><Table.Th>Série</Table.Th><Table.Th>Fornecedor</Table.Th><Table.Th>CNPJ</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Entrada</Table.Th><Table.Th>Itens</Table.Th><Table.Th>Status</Table.Th><Table.Th>Ações</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {notas.map((nota: any) => (
              <Table.Tr key={nota.id}>
                <Table.Td><Text fw={500}>{nota.numero}</Text></Table.Td>
                <Table.Td>{nota.serie || '-'}</Table.Td>
                <Table.Td>{nota.fornecedor || '-'}</Table.Td>
                <Table.Td className="text-sm text-zinc-500">{nota.fornecedorDoc || '-'}</Table.Td>
                <Table.Td><Badge color="primary" variant="light">{nota.tipo}</Badge></Table.Td>
                <Table.Td>{nota.dataEntrada ? new Date(nota.dataEntrada).toLocaleDateString('pt-BR') : '-'}</Table.Td>
                <Table.Td>{nota.itens?.length || 0}</Table.Td>
                <Table.Td><Badge color={statusColor[nota.status]} variant="light">{nota.status}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Detalhes"><ActionIcon variant="subtle" color="gray" onClick={() => setDetalheId(nota.id)}><IconEye size={18} /></ActionIcon></Tooltip>
                    {nota.status === 'PENDENTE' && <Button size="xs" variant="light" onClick={() => handleStatusChange(nota.id, 'CONFERIDA')}>Conferir</Button>}
                    {nota.status === 'CONFERIDA' && <Button size="xs" variant="light" color="grape" onClick={() => handleStatusChange(nota.id, 'ENDERECADA')}>Endereçar</Button>}
                    {nota.status === 'ENDERECADA' && <Badge color="green" variant="light">Concluído</Badge>}
                    {nota.status === 'PENDENTE' && <Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => handleDelete(nota.id, nota.numero)}><IconTrash size={18} /></ActionIcon></Tooltip>}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && notas.length === 0 && <Table.Tr><Table.Td colSpan={9} className="text-center py-8 text-zinc-500">Nenhuma nota</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>

      <NotaEntradaModal
        opened={modalOpen}
        onClose={() => { setModalOpen(false); setImportedData(null) }}
        onSave={handleSaveNota}
        importedData={importedData}
        saving={criarNota.isPending}
      />
      <NotaDetalheModal notaId={detalheId} onClose={() => setDetalheId(null)} />
    </div>
  )
}
