'use client'

import { useState, useRef, useEffect } from 'react'
import { Button, Card, Group, Text, Table, FileInput, LoadingOverlay, Alert, Badge, Divider, Stepper } from '@mantine/core'
import { IconArrowLeft, IconUpload, IconCheck, IconAlertCircle, IconEye, IconExternalLink, IconCalendar } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter } from 'next/navigation'
import AgendamentoDocaModal from '@/components/wms/AgendamentoDocaModal'

export default function ImportarXmlPage() {
  useModuloGuard('COMPRAS')
  useEffect(() => { document.title = 'Vizor - Compras - Importar XML' }, [])
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any>(null)
  const [resultado, setResultado] = useState<any>(null)
  const [step, setStep] = useState(0) // 0=upload, 1=preview, 2=resultado
  const fileRef = useRef<File | null>(null)
  const [dataEntrega, setDataEntrega] = useState<Date | null>(null)
  const [agendaModalOpen, setAgendaModalOpen] = useState(false)
  const [agendaId, setAgendaId] = useState<string | null>(null)

  const previewMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecione um arquivo XML')
      fileRef.current = file
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/compras/preview-xml', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => { setPreview(data); setStep(1) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  const importar = useMutation({
    mutationFn: async () => {
      if (!fileRef.current) throw new Error('Arquivo não encontrado')
      const formData = new FormData()
      formData.append('file', fileRef.current)
      if (dataEntrega) formData.append('dataEntrega', dataEntrega.toISOString().split('T')[0])
      const { data } = await api.post('/compras/importar-xml', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => { setResultado(data); setStep(2); notifications.show({ title: 'Sucesso', message: 'XML importado com sucesso', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  function resetAll() { setFile(null); setPreview(null); setResultado(null); setStep(0); fileRef.current = null; setDataEntrega(null) }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Compras / Importar XML</Text>
      <Group mb="lg">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/compras/pedidos')}>Voltar</Button>
        <Text size="xl" fw={600}>Importar NF-e (XML)</Text>
      </Group>

      <Stepper active={step} mb="xl">
        <Stepper.Step label="Upload" description="Selecionar arquivo" />
        <Stepper.Step label="Preview" description="Conferir dados" />
        <Stepper.Step label="Resultado" description="Importação concluída" />
      </Stepper>

      {/* ETAPA 0 — Upload */}
      {step === 0 && (
        <Card pos="relative">
          <LoadingOverlay visible={previewMut.isPending} />
          <Text fw={500} mb="sm">Upload do arquivo XML da NF-e</Text>
          <Text size="sm" c="dimmed" mb="md">
            Selecione o XML da NF-e recebida do fornecedor. O sistema irá extrair os dados e mostrar um preview antes de confirmar.
          </Text>

          <FileInput
            label="Arquivo XML"
            placeholder="Selecione o arquivo .xml"
            accept=".xml"
            leftSection={<IconUpload size={16} />}
            value={file}
            onChange={setFile}
            className="max-w-lg mb-4"
          />

          <Button onClick={() => previewMut.mutate()} disabled={!file} loading={previewMut.isPending} leftSection={<IconEye size={16} />}>
            Visualizar Dados
          </Button>
        </Card>
      )}

      {/* ETAPA 1 — Preview */}
      {step === 1 && preview && (
        <>
          <Card mb="md">
            <Text fw={600} mb="sm">Dados do Emitente (Fornecedor)</Text>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Text size="sm" c="dimmed">Razão Social</Text>
                <Text fw={500}>{preview.emitente.razaoSocial}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">CNPJ</Text>
                <Text className="font-mono">{preview.emitente.cnpj}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Status</Text>
                <Badge color={preview.emitente.existente ? 'green' : 'blue'} variant="light">
                  {preview.emitente.existente ? '✓ Já cadastrado' : '+ Será cadastrado'}
                </Badge>
              </div>
            </div>
          </Card>

          <Card mb="md">
            <Text fw={600} mb="sm">Dados da Nota</Text>
            <div className="grid grid-cols-3 gap-4">
              <div><Text size="sm" c="dimmed">Número</Text><Text fw={500}>{preview.nota.numero}</Text></div>
              <div><Text size="sm" c="dimmed">Série</Text><Text>{preview.nota.serie}</Text></div>
              <div><Text size="sm" c="dimmed">Data Emissão</Text><Text>{preview.nota.dataEmissao ? new Date(preview.nota.dataEmissao).toLocaleDateString('pt-BR') : '—'}</Text></div>
            </div>
          </Card>

          <Card mb="md">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>Itens ({preview.itens.length})</Text>
              <Group gap="sm">
                <Badge color="green" variant="light">{preview.resumo.produtosExistentes} existentes</Badge>
                <Badge color="blue" variant="light">{preview.resumo.produtosNovos} novos</Badge>
              </Group>
            </Group>

            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Unidade</Table.Th><Table.Th>NCM</Table.Th>
                  <Table.Th>Qtd</Table.Th><Table.Th>Preço Unit.</Table.Th><Table.Th>Total</Table.Th><Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {preview.itens.map((item: any, idx: number) => (
                  <Table.Tr key={idx}>
                    <Table.Td className="font-mono">{item.cProd}</Table.Td>
                    <Table.Td>{item.xProd}</Table.Td>
                    <Table.Td>{item.uCom || '—'}</Table.Td>
                    <Table.Td className="font-mono text-sm">{item.ncm || '—'}</Table.Td>
                    <Table.Td>{item.qCom}</Table.Td>
                    <Table.Td>{item.vUnCom.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                    <Table.Td fw={500}>{item.vProd.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                    <Table.Td>
                      <Badge color={item.produtoExistente ? 'green' : 'blue'} variant="light" size="sm">
                        {item.produtoExistente ? '✓ Existente' : '+ Novo'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Divider my="md" />
            <Group justify="flex-end">
              <Text size="lg" fw={700}>
                Total: {preview.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </Group>
          </Card>

          {preview.resumo.fornecedorNovo && (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light" mb="md">
              O fornecedor <strong>{preview.emitente.razaoSocial}</strong> (CNPJ: {preview.emitente.cnpj}) será cadastrado automaticamente.
            </Alert>
          )}

          {preview.resumo.produtosNovos > 0 && (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light" mb="md">
              {preview.resumo.produtosNovos} produto(s) novo(s) serão cadastrados automaticamente.
            </Alert>
          )}

          <Group justify="space-between">
            <Button variant="default" onClick={() => setStep(0)}>← Voltar</Button>
            <Button onClick={() => importar.mutate()} loading={importar.isPending} leftSection={<IconCheck size={16} />} color="green">
              Confirmar Importação
            </Button>
          </Group>
        </>
      )}

      {/* ETAPA 2 — Resultado */}
      {step === 2 && resultado && (
        <Card>
          <Alert icon={<IconCheck size={16} />} title="Importação concluída com sucesso!" color="green" mb="md">
            A NF-e foi importada e os registros foram criados no sistema.
          </Alert>

          <Table striped mb="md">
            <Table.Tbody>
              <Table.Tr>
                <Table.Td fw={500}>Pedido de Compra</Table.Td>
                <Table.Td>
                  <Group gap="sm">
                    <Text>#{resultado.pedido?.numero}</Text>
                    <Button size="xs" variant="light" leftSection={<IconExternalLink size={14} />} onClick={() => router.push(`/compras/pedidos/${resultado.pedido?.id}`)}>
                      Ver Pedido
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Valor Total</Table.Td>
                <Table.Td>{Number(resultado.compra?.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>

          <Group>
            <Button variant="default" onClick={resetAll}>Importar outro XML</Button>
            <Button variant="light" leftSection={<IconCalendar size={16} />}
              onClick={() => setAgendaModalOpen(true)}
              color={agendaId ? 'teal' : 'blue'}>
              {agendaId ? '✅ Agendado' : 'Agendar Recebimento'}
            </Button>
            <Button onClick={() => router.push('/compras/compras-efetivadas')}>Ver Compras Efetivadas</Button>
          </Group>

          {agendaId && (
            <Alert icon={<IconCalendar size={16} />} color="teal" variant="light" mt="sm">
              Recebimento agendado na doca com sucesso.
            </Alert>
          )}
        </Card>
      )}

      {/* Modal Agendamento de Doca — usa CNPJ para buscar fornecedor (já cadastrado após importação) */}
      <AgendamentoDocaModal
        opened={agendaModalOpen}
        onClose={() => setAgendaModalOpen(false)}
        onAgendado={(id) => { setAgendaId(id) }}
        fornecedorCnpj={preview?.emitente?.cnpj || resultado?.fornecedorCnpj || undefined}
      />
    </div>
  )
}
