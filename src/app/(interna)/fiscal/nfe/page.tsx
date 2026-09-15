'use client'

import { useState, useEffect } from 'react'
import { Button, Group } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { ListagemFiscal, type ColumnDef, type FilterConfig } from '@/components/fiscal/ListagemFiscal'
import { StatusBadge, FISCAL_STATUS_COLORS } from '@/components/fiscal/StatusBadge'
import { ModalCancelamento } from '@/components/fiscal/ModalCancelamento'
import { ModalCartaCorrecao } from '@/components/fiscal/ModalCartaCorrecao'
import { useNfe, abrirDanfe, baixarXmlNfe } from '@/data/hooks/fiscal/useNfe'

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
    // Valores no MASCULINO — é como o backend grava/filtra (where.status.toUpperCase()).
    options: [
      { value: 'PENDENTE', label: 'Pendente' },
      { value: 'AUTORIZADO', label: 'Autorizada' },
      { value: 'REJEITADO', label: 'Rejeitada' },
      { value: 'CANCELADO', label: 'Cancelada' },
      { value: 'DENEGADO', label: 'Denegada' },
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

  const { useCancelar, useCartaCorrecao, useRetransmitir } = useNfe()
  const cancelarMutation = useCancelar()
  const cartaCorrecaoMutation = useCartaCorrecao()
  const retransmitirMutation = useRetransmitir()

  const [cancelarItemId, setCancelarItemId] = useState<string | null>(null)
  const [cceItemId, setCceItemId] = useState<string | null>(null)

  async function handleDanfe(id: string) {
    try {
      await abrirDanfe(id)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: 'Não foi possível abrir a DANFE', color: 'red' })
    }
  }

  async function handleXml(id: string, chaveAcesso: string | null) {
    try {
      await baixarXmlNfe(id, chaveAcesso)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: 'XML ainda não disponível', color: 'red' })
    }
  }

  function handleRetransmitir(id: string) {
    retransmitirMutation.mutate(
      { id },
      {
        onSuccess: (data: any) => {
          notifications.show({
            title: 'NF-e retransmitida',
            message: data?.status === 'AUTORIZADO' ? 'Autorizada pela SEFAZ' : `Status: ${data?.status ?? 'processada'}`,
            color: 'green',
          })
        },
        onError: (err: any) => {
          const d = err?.response?.data
          notifications.show({
            title: 'Rejeição',
            message: d?.orientacao || d?.message || 'Erro ao retransmitir NF-e',
            color: 'red',
          })
        },
      },
    )
  }

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
        actions={(item) => {
          const autorizada = item.status === 'AUTORIZADO' || item.status === 'AUTORIZADA'
          const rejeitada = item.status === 'REJEITADO' || item.status === 'REJEITADA'
          return (
            <Group gap={4}>
              {autorizada && (
                <>
                  <Button size="compact-xs" variant="subtle" onClick={() => handleDanfe(item.id)}>
                    DANFE
                  </Button>
                  <Button size="compact-xs" variant="subtle" onClick={() => handleXml(item.id, item.chaveAcesso)}>
                    XML
                  </Button>
                  <Button size="compact-xs" variant="subtle" color="red" onClick={() => setCancelarItemId(item.id)}>
                    Cancelar
                  </Button>
                  <Button size="compact-xs" variant="subtle" color="teal" onClick={() => setCceItemId(item.id)}>
                    Carta de Correção
                  </Button>
                </>
              )}
              {rejeitada && (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="blue"
                  loading={retransmitirMutation.isPending}
                  onClick={() => handleRetransmitir(item.id)}
                >
                  Reprocessar
                </Button>
              )}
            </Group>
          )
        }}
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
