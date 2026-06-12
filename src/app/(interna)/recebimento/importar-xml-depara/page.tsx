'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, FileInput, LoadingOverlay,
  Alert, Stepper, Divider,
} from '@mantine/core'
import {
  IconArrowLeft, IconUpload, IconCheck, IconAlertCircle, IconLink,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useRouter } from 'next/navigation'
import { useImportarXmlDepara, ImportarXmlDeparaResponse } from '@/data/hooks/useDepara'
import { useCriarNotaEntrada } from '@/data/hooks/useNotaEntrada'
import PendingMappingModal, { PendingXmlItem, ResolvedXmlItem } from '@/components/depara/PendingMappingModal'

export default function ImportarXmlDeparaPage() {
  useEffect(() => { document.title = 'Vizor - Recebimento - Importar XML (De-Para)' }, [])
  const router = useRouter()

  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState(0) // 0=upload, 1=resultado, 2=concluido
  const [resultado, setResultado] = useState<ImportarXmlDeparaResponse | null>(null)
  const [pendingModalOpen, setPendingModalOpen] = useState(false)
  const [resolvedFromModal, setResolvedFromModal] = useState<ResolvedXmlItem[]>([])
  const [allItemsResolved, setAllItemsResolved] = useState(false)

  const importarMut = useImportarXmlDepara()
  const criarNotaMut = useCriarNotaEntrada()

  const hasPendingItems = resultado && resultado.totalPendentes > 0 && !allItemsResolved

  async function handleUpload() {
    if (!file) return
    try {
      const data = await importarMut.mutateAsync(file)
      setResultado(data)
      setStep(1)

      if (data.totalPendentes > 0) {
        setPendingModalOpen(true)
        notifications.show({
          title: 'Itens pendentes',
          message: `${data.totalPendentes} item(ns) precisam de amarração manual`,
          color: 'orange',
        })
      } else {
        setAllItemsResolved(true)
        notifications.show({
          title: 'Todos resolvidos!',
          message: `${data.totalResolvidos} item(ns) resolvidos automaticamente`,
          color: 'green',
        })
      }
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao processar XML',
        color: 'red',
      })
    }
  }

  function handleItemResolved(index: number, resolved: ResolvedXmlItem) {
    setResolvedFromModal(prev => [...prev, resolved])
  }

  function handleAllResolved() {
    setAllItemsResolved(true)
  }

  async function handleCriarNota() {
    if (!resultado) return

    // Combine resolved items from API + manually resolved
    const allResolved = [
      ...resultado.resolvidos,
      ...resolvedFromModal,
    ]

    const itens = allResolved.map(r => ({
      produtoId: r.produtoId,
      skuId: r.skuId || undefined,
      quantidade: r.quantidadeConvertida,
      quantidadeOriginal: r.quantidadeOriginal,
      valorUnitario: r.xmlItem.valorUnitario,
      valorTotal: r.xmlItem.valorTotal,
      unidade: r.unidadeInterna,
      codigoProduto: r.xmlItem.codigoProdutoFornecedor,
      descricao: r.xmlItem.descricao,
      ncm: r.xmlItem.ncm,
    }))

    try {
      await criarNotaMut.mutateAsync({
        numero: Number(resultado.nota.numero) || 0,
        serie: resultado.nota.serie,
        fornecedor: resultado.nota.fornecedor,
        fornecedorDoc: resultado.nota.fornecedorDoc,
        dataEmissao: resultado.nota.dataEmissao,
        tipo: resultado.nota.tipo || 'COMPRA',
        itens,
      })
      setStep(2)
      notifications.show({ title: 'Sucesso', message: 'Nota de entrada criada com sucesso', color: 'green' })
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao criar nota de entrada',
        color: 'red',
      })
    }
  }

  function resetAll() {
    setFile(null)
    setResultado(null)
    setStep(0)
    setResolvedFromModal([])
    setAllItemsResolved(false)
  }

  const totalResolvidos = (resultado?.totalResolvidos || 0) + resolvedFromModal.length

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Recebimento / Importar XML (De-Para)</Text>
      <Group mb="lg">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/recebimento')}>
          Voltar
        </Button>
        <Text size="xl" fw={600}>Importar NF-e com De-Para</Text>
      </Group>

      <Stepper active={step} mb="xl">
        <Stepper.Step label="Upload" description="Selecionar XML" />
        <Stepper.Step label="Resolução" description="Vincular itens" />
        <Stepper.Step label="Concluído" description="Nota criada" />
      </Stepper>

      {/* ETAPA 0 — Upload */}
      {step === 0 && (
        <Card pos="relative">
          <LoadingOverlay visible={importarMut.isPending} />
          <Text fw={500} mb="sm">Upload do arquivo XML da NF-e</Text>
          <Text size="sm" c="dimmed" mb="md">
            O sistema irá resolver automaticamente os itens usando mapeamentos De-Para cadastrados,
            códigos EAN e EAN tributário. Itens não resolvidos serão apresentados para amarração manual.
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

          <Button
            onClick={handleUpload}
            disabled={!file}
            loading={importarMut.isPending}
            leftSection={<IconUpload size={16} />}
          >
            Processar XML
          </Button>
        </Card>
      )}

      {/* ETAPA 1 — Resultado da resolução */}
      {step === 1 && resultado && (
        <>
          {/* Header da nota */}
          <Card mb="md">
            <Text fw={600} mb="sm">Dados da Nota</Text>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Text size="sm" c="dimmed">Número</Text>
                <Text fw={500}>{resultado.nota.numero}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Série</Text>
                <Text>{resultado.nota.serie || '—'}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Fornecedor</Text>
                <Text>{resultado.nota.fornecedor}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">CNPJ</Text>
                <Text className="font-mono">{resultado.nota.fornecedorDoc}</Text>
              </div>
            </div>
          </Card>

          {/* Resumo */}
          <Card mb="md">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>Resumo da Resolução</Text>
              <Group gap="sm">
                <Badge color="green" variant="light" size="lg">
                  {totalResolvidos} resolvido(s)
                </Badge>
                {hasPendingItems && (
                  <Badge color="orange" variant="light" size="lg">
                    {resultado.totalPendentes - resolvedFromModal.length} pendente(s)
                  </Badge>
                )}
              </Group>
            </Group>

            {hasPendingItems && (
              <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light" mb="md">
                Existem itens pendentes de amarração. Vincule todos os itens antes de criar a nota de entrada.
              </Alert>
            )}

            {allItemsResolved && (
              <Alert icon={<IconCheck size={16} />} color="green" variant="light" mb="md">
                Todos os itens foram resolvidos! Você pode criar a nota de entrada.
              </Alert>
            )}
          </Card>

          {/* Itens resolvidos */}
          {resultado.resolvidos.length > 0 && (
            <Card mb="md">
              <Text fw={600} mb="sm">Itens Resolvidos Automaticamente ({resultado.resolvidos.length})</Text>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Código Forn.</Table.Th>
                    <Table.Th>Descrição</Table.Th>
                    <Table.Th>Produto Interno</Table.Th>
                    <Table.Th>Qtd Original</Table.Th>
                    <Table.Th>Qtd Convertida</Table.Th>
                    <Table.Th>Resolvido por</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {resultado.resolvidos.map((item, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td className="font-mono">{item.xmlItem.codigoProdutoFornecedor}</Table.Td>
                      <Table.Td>{item.xmlItem.descricao}</Table.Td>
                      <Table.Td>{item.produtoNome}</Table.Td>
                      <Table.Td>{item.quantidadeOriginal} {item.xmlItem.unidade}</Table.Td>
                      <Table.Td>{item.quantidadeConvertida} {item.unidadeInterna}</Table.Td>
                      <Table.Td>
                        <Badge
                          color={item.resolvidoPor === 'DEPARA' ? 'blue' : item.resolvidoPor === 'EAN_TRIB' ? 'grape' : 'cyan'}
                          variant="light"
                          size="sm"
                        >
                          {item.resolvidoPor}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}

          {/* Itens resolvidos manualmente */}
          {resolvedFromModal.length > 0 && (
            <Card mb="md">
              <Text fw={600} mb="sm">Itens Vinculados Manualmente ({resolvedFromModal.length})</Text>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Código Forn.</Table.Th>
                    <Table.Th>Descrição</Table.Th>
                    <Table.Th>Produto Interno</Table.Th>
                    <Table.Th>Qtd Original</Table.Th>
                    <Table.Th>Qtd Convertida</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {resolvedFromModal.map((item, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td className="font-mono">{item.xmlItem.codigoProdutoFornecedor}</Table.Td>
                      <Table.Td>{item.xmlItem.descricao}</Table.Td>
                      <Table.Td>{item.produtoNome}</Table.Td>
                      <Table.Td>{item.quantidadeOriginal} {item.xmlItem.unidade}</Table.Td>
                      <Table.Td>{item.quantidadeConvertida} {item.unidadeInterna}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}

          <Divider my="md" />

          <Group justify="space-between">
            <Group>
              <Button variant="default" onClick={resetAll}>← Voltar ao Upload</Button>
              {hasPendingItems && (
                <Button
                  leftSection={<IconLink size={16} />}
                  color="orange"
                  onClick={() => setPendingModalOpen(true)}
                >
                  Resolver Itens Pendentes ({resultado.totalPendentes - resolvedFromModal.length})
                </Button>
              )}
            </Group>
            <Button
              leftSection={<IconCheck size={16} />}
              color="green"
              onClick={handleCriarNota}
              loading={criarNotaMut.isPending}
              disabled={!allItemsResolved}
            >
              Criar Nota de Entrada
            </Button>
          </Group>
        </>
      )}

      {/* ETAPA 2 — Concluído */}
      {step === 2 && (
        <Card>
          <Alert icon={<IconCheck size={16} />} title="Nota de entrada criada!" color="green" mb="md">
            A NF-e foi processada e a nota de entrada foi criada com todos os itens resolvidos.
          </Alert>

          <Group>
            <Button variant="default" onClick={resetAll}>Importar outro XML</Button>
            <Button onClick={() => router.push('/recebimento')}>Ver Recebimento</Button>
          </Group>
        </Card>
      )}

      {/* Modal de amarração manual */}
      {resultado && resultado.pendentes.length > 0 && (
        <PendingMappingModal
          opened={pendingModalOpen}
          onClose={() => setPendingModalOpen(false)}
          pendingItems={resultado.pendentes}
          fornecedorId={resultado.nota.fornecedorId}
          onItemResolved={handleItemResolved}
          onAllResolved={handleAllResolved}
        />
      )}
    </div>
  )
}
