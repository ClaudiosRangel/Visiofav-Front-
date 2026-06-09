'use client'

import { useState } from 'react'
import {
  Modal, Button, Select, TextInput, NumberInput, Textarea, Group, Stack,
  ActionIcon, Text, Card, Divider,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface Tarifa {
  tipo: string
  valorUnitario: number | ''
  carenciaDias: number | ''
  descricao: string
}

interface ContratoModalProps {
  opened: boolean
  onClose: () => void
  onSuccess: () => void
}

const PERIODICIDADE_OPTIONS = [
  { value: 'MENSAL', label: 'Mensal' },
  { value: 'QUINZENAL', label: 'Quinzenal' },
  { value: 'SEMANAL', label: 'Semanal' },
]

const MOEDA_OPTIONS = [
  { value: 'BRL', label: 'BRL - Real' },
  { value: 'USD', label: 'USD - Dólar' },
  { value: 'EUR', label: 'EUR - Euro' },
]

const TARIFA_TIPO_OPTIONS = [
  { value: 'ARMAZENAGEM', label: 'Armazenagem' },
  { value: 'MOVIMENTACAO', label: 'Movimentação' },
  { value: 'PICKING', label: 'Picking' },
  { value: 'EXPEDICAO', label: 'Expedição' },
  { value: 'RECEBIMENTO', label: 'Recebimento' },
  { value: 'VALOR_FIXO', label: 'Valor Fixo' },
  { value: 'AD_VALOREM', label: 'Ad Valorem' },
]

export function ContratoModal({ opened, onClose, onSuccess }: ContratoModalProps) {
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)
  const [periodicidade, setPeriodicidade] = useState<string | null>(null)
  const [moeda, setMoeda] = useState<string | null>('BRL')
  const [observacao, setObservacao] = useState('')
  const [tarifas, setTarifas] = useState<Tarifa[]>([
    { tipo: '', valorUnitario: '', carenciaDias: '', descricao: '' },
  ])

  const { data: clientesResp } = useQuery<any>({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data } = await api.get('/clientes', { params: { limit: 200 } })
      return data
    },
  })

  const clienteOptions = (clientesResp?.data || []).map((c: any) => ({
    value: String(c.id),
    label: c.nome || c.razaoSocial,
  }))

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/faturamento/contratos', payload)
      return data
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Contrato criado com sucesso', color: 'green' })
      resetForm()
      onSuccess()
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Erro ao criar contrato',
        color: 'red',
      })
    },
  })

  function resetForm() {
    setClienteId(null)
    setDataInicio(null)
    setDataFim(null)
    setPeriodicidade(null)
    setMoeda('BRL')
    setObservacao('')
    setTarifas([{ tipo: '', valorUnitario: '', carenciaDias: '', descricao: '' }])
  }

  function addTarifa() {
    setTarifas([...tarifas, { tipo: '', valorUnitario: '', carenciaDias: '', descricao: '' }])
  }

  function removeTarifa(index: number) {
    setTarifas(tarifas.filter((_, i) => i !== index))
  }

  function updateTarifa(index: number, field: keyof Tarifa, value: any) {
    const updated = [...tarifas]
    updated[index] = { ...updated[index], [field]: value }
    setTarifas(updated)
  }

  function handleSubmit() {
    if (!clienteId || !dataInicio || !periodicidade) {
      notifications.show({ title: 'Atenção', message: 'Preencha os campos obrigatórios', color: 'yellow' })
      return
    }

    const payload = {
      clienteId: Number(clienteId),
      dataInicio: dataInicio.toISOString(),
      dataFim: dataFim?.toISOString() || null,
      periodicidade,
      moeda: moeda || 'BRL',
      observacao: observacao || null,
      tarifas: tarifas
        .filter((t) => t.tipo && t.valorUnitario !== '')
        .map((t) => ({
          tipo: t.tipo,
          valorUnitario: Number(t.valorUnitario),
          carenciaDias: t.carenciaDias ? Number(t.carenciaDias) : null,
          descricao: t.descricao || null,
        })),
    }

    mutation.mutate(payload)
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Novo Contrato"
      size="xl"
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        <Select
          label="Cliente"
          placeholder="Selecione o cliente"
          data={clienteOptions}
          value={clienteId}
          onChange={setClienteId}
          searchable
          required
        />

        <Group grow>
          <DateInput
            label="Data Início"
            placeholder="Selecione a data"
            value={dataInicio}
            onChange={setDataInicio}
            required
            valueFormat="DD/MM/YYYY"
          />
          <DateInput
            label="Data Fim"
            placeholder="Selecione a data"
            value={dataFim}
            onChange={setDataFim}
            valueFormat="DD/MM/YYYY"
          />
        </Group>

        <Group grow>
          <Select
            label="Periodicidade"
            placeholder="Selecione"
            data={PERIODICIDADE_OPTIONS}
            value={periodicidade}
            onChange={setPeriodicidade}
            required
          />
          <Select
            label="Moeda"
            placeholder="Selecione"
            data={MOEDA_OPTIONS}
            value={moeda}
            onChange={setMoeda}
          />
        </Group>

        <Textarea
          label="Observação"
          placeholder="Observações sobre o contrato"
          value={observacao}
          onChange={(e) => setObservacao(e.currentTarget.value)}
          rows={3}
        />

        <Divider label="Tarifas" labelPosition="left" />

        {tarifas.map((tarifa, index) => (
          <Card key={index} withBorder p="sm">
            <Group align="flex-end" gap="sm">
              <Select
                label="Tipo"
                placeholder="Tipo tarifa"
                data={TARIFA_TIPO_OPTIONS}
                value={tarifa.tipo}
                onChange={(val) => updateTarifa(index, 'tipo', val || '')}
                style={{ flex: 1 }}
              />
              <NumberInput
                label="Valor Unitário"
                placeholder="0.00"
                value={tarifa.valorUnitario}
                onChange={(val) => updateTarifa(index, 'valorUnitario', val)}
                min={0}
                decimalScale={2}
                style={{ flex: 1 }}
              />
              <NumberInput
                label="Carência (dias)"
                placeholder="Opcional"
                value={tarifa.carenciaDias}
                onChange={(val) => updateTarifa(index, 'carenciaDias', val)}
                min={0}
                style={{ flex: 1 }}
              />
              <TextInput
                label="Descrição"
                placeholder="Descrição"
                value={tarifa.descricao}
                onChange={(e) => updateTarifa(index, 'descricao', e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <ActionIcon
                color="red"
                variant="subtle"
                onClick={() => removeTarifa(index)}
                disabled={tarifas.length <= 1}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Card>
        ))}

        <Button variant="light" leftSection={<IconPlus size={14} />} onClick={addTarifa} size="sm">
          Adicionar Tarifa
        </Button>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>Salvar Contrato</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
