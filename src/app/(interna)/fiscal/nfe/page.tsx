'use client'

import { useState, useEffect } from 'react'
import { Button, Group } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { ListagemFiscal, type ColumnDef, type FilterConfig } from '@/components/fiscal/ListagemFiscal'
import { StatusBadge, FISCAL_STATUS_COLORS } from '@/components/fiscal/StatusBadge'
import { ModalCancelamento } from '@/components/fiscal/ModalCancelamento'
import { ModalCartaCorrecao } from '@/components/fiscal/ModalCartaCorrecao'
import { useNfe } from '@/data/hooks/fiscal/useNfe'

interface NfeItem {
  id: string
  numero: number
  serie: number
  chaveAcesso: string | null
  destRazao: string | null
  valorTotal: number
  status: string
  dataEmissao: string
}

const columns: ColumnDef<NfeItem>[] = [
  { key: 'numero', label: 'Número' },
  { key: 'serie', label: 'Série' },
  {
    key: 'chaveAcesso',
    label: 'Chave de Acesso',
    render: (value: string | null) => value ? `${value.substring(0, 25)}...` : '—',
  },
  { key: 'destRazao', label: 'Destinatário', render: (value: string | null) => value ?? '—' },
  {
    key: 'valorTotal',
    label: 'Valor',
    render: (value: number) =>
      value != null
        ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '—',
  },
  {
    key: 'status',
    label: 'Status',
    render: (value: string) => <StatusBadge status={value} />,
  },
  {
    key: 'dataEmissao',
    label: 'Data Emissão',
    render: (value: string) =>
      value ? new Date(value).toLocaleDateString('pt-BR') : '—',
  },
]

const filters: FilterConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'PENDENTE', label: 'Pendente' },
      { value: 'AUTORIZADA', label: 'Autorizada' },
      { value: 'REJEITADA', label: 'Rejeitada' },
      { value: 'CANCELADA', label: 'Cancelada' },
      { value: 'DENEGADA', label: 'Denegada' },
      { value: 'CONTINGENCIA', label: 'Contingência' },
    ],
  },
  {
    key: 'destRazao',
    label: 'Destinatário',
    type: 'text',
  },
]

export default function NfePage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - NF-e' }, [])

  const { useCancelar, useCartaCorrecao } = useNfe()
  const cancelarMutation = useCancelar()
  const cartaCorrecaoMutation = useCartaCorrecao()

  const [cancelarItemId, setCancelarItemId] = useState<string | null>(null)
  const [cceItemId, setCceItemId] = useState<string | null>(null)

  function handleCancelar(justificativa: string) {
    if (!cancelarItemId) return
    cancelarMutation.mutate(
      { id: cancelarItemId, justificativa },
      {
        onSuccess: () => {
          notifications.show({ title: 'Sucesso', message: 'NF-e cancelada com sucesso', color: 'green' })
          setCancelarItemId(null)
        },
        onError: (err: any) => {
          notifications.show({
            title: 'Erro',
            message: err?.response?.data?.message || 'Erro ao cancelar NF-e',
            color: 'red',
          })
        },
      },
    )
  }

  function handleCartaCorrecao(textoCorrecao: string) {
    if (!cceItemId) return
    cartaCorrecaoMutation.mutate(
      { id: cceItemId, textoCorrecao },
      {
        onSuccess: () => {
          notifications.show({ title: 'Sucesso', message: 'Carta de Correção enviada com sucesso', color: 'green' })
          setCceItemId(null)
        },
        onError: (err: any) => {
          notifications.show({
            title: 'Erro',
            message: err?.response?.data?.message || 'Erro ao enviar Carta de Correção',
            color: 'red',
          })
        },
      },
    )
  }

  return (
    <>
      <ListagemFiscal<NfeItem>
        queryKey={['fiscal', 'nfe']}
        endpoint="/fiscal/nfe"
        columns={columns}
        filters={filters}
        title="Notas Fiscais Eletrônicas (NF-e)"
        breadcrumb="Início / Fiscal / NF-e"
        createButton={{ label: 'Nova NF-e', href: '/fiscal/nfe/nova' }}
        statusColors={FISCAL_STATUS_COLORS}
        actions={(item) =>
          item.status === 'AUTORIZADA' ? (
            <Group gap={4}>
              <Button
                size="compact-xs"
                variant="subtle"
                color="red"
                onClick={() => setCancelarItemId(item.id)}
              >
                Cancelar
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                color="teal"
                onClick={() => setCceItemId(item.id)}
              >
                Carta de Correção
              </Button>
            </Group>
          ) : null
        }
      />

      <ModalCancelamento
        opened={!!cancelarItemId}
        onClose={() => setCancelarItemId(null)}
        onConfirm={handleCancelar}
        loading={cancelarMutation.isPending}
      />

      <ModalCartaCorrecao
        opened={!!cceItemId}
        onClose={() => setCceItemId(null)}
        onConfirm={handleCartaCorrecao}
        loading={cartaCorrecaoMutation.isPending}
      />
    </>
  )
}
