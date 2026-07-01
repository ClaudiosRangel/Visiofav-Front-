'use client'

import { useEffect } from 'react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { ListagemFiscal, type ColumnDef, type FilterConfig } from '@/components/fiscal/ListagemFiscal'
import { StatusBadge } from '@/components/fiscal/StatusBadge'

interface MdfeItem {
  id: string
  numero: number
  serie: number
  ufCarregamento: string | null
  ufDescarregamento: string | null
  status: string
  dataEmissao: string
}

const columns: ColumnDef<MdfeItem>[] = [
  { key: 'numero', label: 'Número' },
  { key: 'serie', label: 'Série' },
  { key: 'ufCarregamento', label: 'UF Carregamento', render: (value: string | null) => value ?? '—' },
  { key: 'ufDescarregamento', label: 'UF Descarregamento', render: (value: string | null) => value ?? '—' },
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

export default function MdfePage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - MDF-e' }, [])

  return (
    <ListagemFiscal<MdfeItem>
      queryKey={['fiscal', 'mdfe']}
      endpoint="/fiscal/mdfe"
      columns={columns}
      filters={filters}
      title="Manifesto Eletrônico de Documentos Fiscais (MDF-e)"
      breadcrumb="Início / Fiscal / MDF-e"
      createButton={{ label: 'Novo MDF-e', href: '/fiscal/mdfe/nova' }}
    />
  )
}
