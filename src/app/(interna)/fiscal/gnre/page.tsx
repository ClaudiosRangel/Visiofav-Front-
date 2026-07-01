'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Button,
  Group,
  Modal,
  TextInput,
  NumberInput,
  SimpleGrid,
  Card,
  Text,
  Stack,
  ActionIcon,
  Tooltip,
  Select,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconPlus, IconCash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { ListagemFiscal, type ColumnDef } from '@/components/fiscal/ListagemFiscal'
import { StatusBadge } from '@/components/fiscal/StatusBadge'
import { gnreCrud, type Gnre } from '@/data/hooks/fiscal/useCadastrosFiscais'
import { useGnre } from '@/data/hooks/fiscal/useGnre'

const UF_OPTIONS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
].map((uf) => ({ value: uf, label: uf }))

const GNRE_STATUS_COLORS: Record<string, string> = {
  PENDENTE: 'blue',
  PAGO: 'green',
  VENCIDO: 'red',
}

export default function GnrePage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - GNRE' }, [])

  const [modalOpen, setModalOpen] = useState(false)

  // Form state
  const [ufDestino, setUfDestino] = useState<string | null>(null)
  const [codigoReceita, setCodigoReceita] = useState('')
  const [referencia, setReferencia] = useState('')
  const [valor, setValor] = useState<number | string>('')
  const [vencimento, setVencimento] = useState<Date | null>(null)

  const criar = gnreCrud.useCriar()
  const { usePagar } = useGnre()
  const pagar = usePagar()

  // Fetch data for summary
  const { data: listData } = gnreCrud.useListar({ limit: 1000 })

  // Summary consolidated by UF and status
  const resumo = useMemo(() => {
    const items = listData?.data ?? []
    const map: Record<string, { pendente: number; pago: number; vencido: number; total: number }> = {}

    items.forEach((item) => {
      if (!map[item.ufDestino]) {
        map[item.ufDestino] = { pendente: 0, pago: 0, vencido: 0, total: 0 }
      }
      const entry = map[item.ufDestino]
      entry.total += item.valor
      if (item.status === 'PENDENTE') entry.pendente += item.valor
      if (item.status === 'PAGO') entry.pago += item.valor
      if (item.status === 'VENCIDO') entry.vencido += item.valor
    })

    return map
  }, [listData])

  function resetForm() {
    setUfDestino(null)
    setCodigoReceita('')
    setReferencia('')
    setValor('')
    setVencimento(null)
  }

  function abrirNovo() {
    resetForm()
    setModalOpen(true)
  }

  function fecharModal() {
    setModalOpen(false)
  }

  function handleSalvar() {
    if (!ufDestino || !codigoReceita || !valor || !vencimento) {
      notifications.show({
        title: 'Campos obrigatórios',
        message: 'Preencha todos os campos obrigatórios.',
        color: 'orange',
      })
      return
    }

    const payload: any = {
      ufDestino,
      codigoReceita,
      referencia,
      valor: Number(valor),
      vencimento: vencimento.toISOString().split('T')[0],
    }

    criar.mutate(payload, {
      onSuccess: () => {
        notifications.show({ title: 'Sucesso', message: 'GNRE gerada com sucesso', color: 'green' })
        fecharModal()
      },
      onError: (err: any) => {
        notifications.show({
          title: 'Erro',
          message: err?.response?.data?.message || 'Falha ao gerar GNRE',
          color: 'red',
        })
      },
    })
  }

  function handlePagar(gnre: Gnre) {
    if (!confirm(`Confirma registro de pagamento da GNRE para ${gnre.ufDestino} - R$ ${gnre.valor.toFixed(2)}?`)) return

    pagar.mutate(gnre.id, {
      onSuccess: () => {
        notifications.show({ title: 'Sucesso', message: 'Pagamento registrado com sucesso', color: 'green' })
      },
      onError: (err: any) => {
        notifications.show({
          title: 'Erro',
          message: err?.response?.data?.message || 'Falha ao registrar pagamento',
          color: 'red',
        })
      },
    })
  }

  const columns: ColumnDef<Gnre>[] = [
    { key: 'ufDestino', label: 'UF' },
    { key: 'codigoReceita', label: 'Receita' },
    {
      key: 'valor',
      label: 'Valor',
      render: (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'referencia',
      label: 'Vencimento/Referência',
      render: (_value: string, item: Gnre) => item.referencia || '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => <StatusBadge status={value} colorMap={GNRE_STATUS_COLORS} />,
    },
  ]

  const isFormValid = !!ufDestino && codigoReceita.trim().length > 0 && Number(valor) > 0 && !!vencimento

  const resumoEntries = Object.entries(resumo)

  return (
    <Stack gap="md">
      {/* Summary cards */}
      {resumoEntries.length > 0 && (
        <div>
          <Text size="sm" c="dimmed" mb={4}>Início / Fiscal / GNRE</Text>
          <Text size="xl" fw={600} mb="sm">Resumo por UF</Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm" mb="lg">
            {resumoEntries.map(([uf, dados]) => (
              <Card key={uf} withBorder p="sm">
                <Text fw={700} size="lg">{uf}</Text>
                <Group gap="xs" mt={4}>
                  <StatusBadge status="PENDENTE" colorMap={GNRE_STATUS_COLORS} />
                  <Text size="sm">R$ {dados.pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                </Group>
                <Group gap="xs" mt={2}>
                  <StatusBadge status="PAGO" colorMap={GNRE_STATUS_COLORS} />
                  <Text size="sm">R$ {dados.pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                </Group>
                <Group gap="xs" mt={2}>
                  <StatusBadge status="VENCIDO" colorMap={GNRE_STATUS_COLORS} />
                  <Text size="sm">R$ {dados.vencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  Total: R$ {dados.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        </div>
      )}

      {/* Listing */}
      <Group justify="flex-end" mb="sm">
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>
          Nova GNRE
        </Button>
      </Group>

      <ListagemFiscal<Gnre>
        queryKey={['fiscal-gnre']}
        endpoint="/fiscal/gnre"
        columns={columns}
        title="GNRE — Guias de Recolhimento"
        breadcrumb="Início / Fiscal / GNRE"
        filters={[
          {
            key: 'ufDestino',
            label: 'UF',
            type: 'select',
            options: UF_OPTIONS,
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'PENDENTE', label: 'Pendente' },
              { value: 'PAGO', label: 'Pago' },
              { value: 'VENCIDO', label: 'Vencido' },
            ],
          },
        ]}
        actions={(item) => (
          <Group gap={4}>
            {item.status === 'PENDENTE' && (
              <Tooltip label="Registrar Pagamento">
                <ActionIcon
                  variant="light"
                  color="green"
                  onClick={() => handlePagar(item)}
                  loading={pagar.isPending}
                >
                  <IconCash size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        )}
        statusColors={GNRE_STATUS_COLORS}
      />

      {/* Modal Nova GNRE */}
      <Modal
        opened={modalOpen}
        onClose={fecharModal}
        title="Nova GNRE"
        size="md"
        centered
      >
        <SimpleGrid cols={1} spacing="sm" mb="sm">
          <Select
            label="UF Destino *"
            placeholder="Selecione a UF"
            data={UF_OPTIONS}
            value={ufDestino}
            onChange={setUfDestino}
            searchable
          />
          <TextInput
            label="Código Receita *"
            placeholder="Código da receita"
            value={codigoReceita}
            onChange={(e) => setCodigoReceita(e.currentTarget.value)}
          />
          <TextInput
            label="Referência"
            placeholder="Período de referência (ex: 01/2025)"
            value={referencia}
            onChange={(e) => setReferencia(e.currentTarget.value)}
          />
          <NumberInput
            label="Valor *"
            placeholder="0,00"
            value={valor}
            onChange={setValor}
            min={0.01}
            decimalScale={2}
            prefix="R$ "
            thousandSeparator="."
            decimalSeparator=","
          />
          <DateInput
            label="Vencimento *"
            placeholder="Data de vencimento"
            value={vencimento}
            onChange={setVencimento}
            valueFormat="DD/MM/YYYY"
          />
        </SimpleGrid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={fecharModal}>Cancelar</Button>
          <Button
            onClick={handleSalvar}
            loading={criar.isPending}
            disabled={!isFormValid}
          >
            Gerar GNRE
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}
