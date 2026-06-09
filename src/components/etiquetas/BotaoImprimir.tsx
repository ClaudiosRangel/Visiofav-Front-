'use client'

import { useState } from 'react'
import {
  Button, Modal, Select, NumberInput, Stack, Group, Text, Badge,
} from '@mantine/core'
import { IconPrinter } from '@tabler/icons-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'

interface BotaoImprimirProps {
  /** Single item to print (referência) */
  referenciaId?: string
  /** Multiple items for batch printing */
  itens?: Array<{ referenciaId: string; dadosVariaveis?: Record<string, string> }>
  /** Operation context (RECEBIMENTO, SEPARACAO, EXPEDICAO) */
  operacao?: string
  /** Custom button label */
  label?: string
  /** Button variant */
  variant?: string
  /** Button size */
  size?: string
  /** Compact mode (icon only) */
  compact?: boolean
}

/**
 * Reusable print button component that opens a modal to select
 * template + printer and sends to the ZPL print queue.
 * Supports single and batch (lote) printing modes.
 */
export default function BotaoImprimir({
  referenciaId,
  itens,
  operacao,
  label = 'Imprimir',
  variant = 'light',
  size = 'sm',
  compact = false,
}: BotaoImprimirProps) {
  const [opened, setOpened] = useState(false)
  const [templateId, setTemplateId] = useState<string>('')
  const [impressoraId, setImpressoraId] = useState<string>('')
  const [quantidade, setQuantidade] = useState(1)
  const [prioridade, setPrioridade] = useState<string>('NORMAL')

  const isBatch = !!(itens && itens.length > 0)
  const totalItens = isBatch ? itens!.length : 1

  // Load templates
  const { data: templatesResp } = useQuery<any>({
    queryKey: ['etiquetas-zpl-templates-select'],
    queryFn: async () => {
      const { data } = await api.get('/etiquetas-zpl/templates', { params: { limit: 100 } })
      return data
    },
    enabled: opened,
  })

  // Load printers
  const { data: impressorasResp } = useQuery<any>({
    queryKey: ['etiquetas-zpl-impressoras-select'],
    queryFn: async () => {
      const { data } = await api.get('/etiquetas-zpl/impressoras', { params: { limit: 100 } })
      return data
    },
    enabled: opened,
  })

  const templates = templatesResp?.data || templatesResp || []
  const impressoras = impressorasResp?.data || impressorasResp || []

  const enviar = useMutation({
    mutationFn: async () => {
      if (isBatch) {
        // Batch mode: POST /etiquetas-zpl/imprimir-lote
        await api.post('/etiquetas-zpl/imprimir-lote', {
          templateId,
          impressoraId,
          quantidade,
          prioridade,
          operacao,
          itens: itens!.map((item) => ({
            referenciaId: item.referenciaId,
            dadosVariaveis: item.dadosVariaveis || {},
          })),
        })
      } else {
        // Single mode: POST /etiquetas-zpl/imprimir
        await api.post('/etiquetas-zpl/imprimir', {
          templateId,
          impressoraId,
          quantidade,
          prioridade,
          operacao,
          referenciaId,
          dadosVariaveis: {},
        })
      }
    },
    onSuccess: () => {
      notifications.show({
        title: 'Enviado para fila',
        message: isBatch
          ? `${totalItens} etiqueta(s) enviadas para impressão`
          : 'Etiqueta enviada para a fila de impressão',
        color: 'green',
      })
      setOpened(false)
      resetForm()
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao enviar', color: 'red' })
    },
  })

  function resetForm() {
    setTemplateId('')
    setImpressoraId('')
    setQuantidade(1)
    setPrioridade('NORMAL')
  }

  function handleSubmit() {
    if (!templateId || !impressoraId) {
      notifications.show({ title: 'Atenção', message: 'Selecione template e impressora', color: 'yellow' })
      return
    }
    enviar.mutate()
  }

  return (
    <>
      {compact ? (
        <Button
          variant={variant}
          size={size}
          onClick={() => setOpened(true)}
          leftSection={<IconPrinter size={14} />}
          px="xs"
        >
          <IconPrinter size={16} />
        </Button>
      ) : (
        <Button
          variant={variant}
          size={size}
          leftSection={<IconPrinter size={14} />}
          onClick={() => setOpened(true)}
        >
          {label}
          {isBatch && <Badge size="xs" ml={6} variant="filled">{totalItens}</Badge>}
        </Button>
      )}

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={isBatch ? `Imprimir Lote (${totalItens} itens)` : 'Imprimir Etiqueta'}
        size="sm"
      >
        <Stack gap="sm">
          <Select
            label="Template"
            placeholder="Selecione o template"
            value={templateId}
            onChange={(v) => setTemplateId(v || '')}
            data={(Array.isArray(templates) ? templates : []).map((t: any) => ({
              value: t.id,
              label: `${t.nome} (${t.tipo})`,
            }))}
          />
          <Select
            label="Impressora"
            placeholder="Selecione a impressora"
            value={impressoraId}
            onChange={(v) => setImpressoraId(v || '')}
            data={(Array.isArray(impressoras) ? impressoras : []).map((i: any) => ({
              value: i.id,
              label: `${i.nome} (${i.ip}:${i.porta})`,
            }))}
          />
          <Group grow>
            <NumberInput
              label="Cópias"
              value={quantidade}
              onChange={(v) => setQuantidade(typeof v === 'number' ? v : 1)}
              min={1}
              max={100}
            />
            <Select
              label="Prioridade"
              value={prioridade}
              onChange={(v) => setPrioridade(v || 'NORMAL')}
              data={[
                { value: 'URGENTE', label: 'Urgente' },
                { value: 'NORMAL', label: 'Normal' },
                { value: 'BAIXA', label: 'Baixa' },
              ]}
            />
          </Group>

          {isBatch && (
            <Text size="xs" c="dimmed">
              Serão impressas {totalItens} × {quantidade} = {totalItens * quantidade} etiqueta(s) total
            </Text>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setOpened(false)}>Cancelar</Button>
            <Button
              leftSection={<IconPrinter size={16} />}
              onClick={handleSubmit}
              loading={enviar.isPending}
            >
              Enviar para Fila
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
