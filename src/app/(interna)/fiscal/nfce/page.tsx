'use client'

import { useEffect } from 'react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { ListagemFiscal, type ColumnDef, type FilterConfig } from '@/components/fiscal/ListagemFiscal'
import { StatusBadge } from '@/components/fiscal/StatusBadge'

interface NfceItem {
  id: string
  numero: number
  serie: number
  destRazao: string | null
  valorTotal: number
  status: string
  dataEmissao: string
}

const columns: ColumnDef<NfceItem>[] = [
  { key: 'numero', label: 'Número' },
  { key: 'serie', label: 'Série' },
  { key: 'destRazao', label: 'Consumidor', render: (value: string | null) => value ?? 'Consumidor Final' },
  {
    key: 'valorTotal',
    label: 'Valor Total',
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
    label: 'Data',
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
      { value: 'CONTINGENCIA', label: 'Contingência' },
    ],
  },
]

export default function NfcePage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - NFC-e' }, [])

  return (
    <ListagemFiscal<NfceItem>
      queryKey={['fiscal', 'nfce']}
      endpoint="/fiscal/nfce"
      columns={columns}
      filters={filters}
      title="Notas Fiscais ao Consumidor (NFC-e)"
      breadcrumb="Início / Fiscal / NFC-e"
      createButton={{ label: 'Nova NFC-e', href: '/fiscal/nfce/nova' }}
    />
  )
}
