'use client'

import { useEffect } from 'react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { ListagemFiscal, type ColumnDef } from '@/components/fiscal/ListagemFiscal'
import { StatusBadge, FISCAL_STATUS_COLORS } from '@/components/fiscal/StatusBadge'

interface NfseItem {
  id: string
  numero: number
  tomadorRazao: string | null
  descricaoServico: string | null
  valorServicos: number
  status: string
  dataEmissao: string
}

const columns: ColumnDef<NfseItem>[] = [
  { key: 'numero', label: 'Número' },
  { key: 'tomadorRazao', label: 'Tomador', render: (value: string | null) => value ?? '—' },
  {
    key: 'descricaoServico',
    label: 'Serviço',
    render: (value: string | null) => value ?? '—',
  },
  {
    key: 'valorServicos',
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
    label: 'Data',
    render: (value: string) =>
      value ? new Date(value).toLocaleDateString('pt-BR') : '—',
  },
]

export default function NfsePage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - NFS-e' }, [])

  return (
    <ListagemFiscal<NfseItem>
      queryKey={['fiscal', 'nfse']}
      endpoint="/fiscal/nfse"
      columns={columns}
      title="Nota Fiscal de Serviço Eletrônica (NFS-e)"
      breadcrumb="Início / Fiscal / NFS-e"
      createButton={{ label: 'Nova NFS-e', href: '/fiscal/nfse/nova' }}
      statusColors={FISCAL_STATUS_COLORS}
    />
  )
}
