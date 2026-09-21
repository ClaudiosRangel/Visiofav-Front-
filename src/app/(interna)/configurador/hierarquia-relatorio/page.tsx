'use client'

import RelatorioDistribuicaoView from '@/components/hierarquia/RelatorioDistribuicaoView'

// Rota do WMS. detectModule mapeia /configurador/* → contexto WMS.
export default function HierarquiaRelatorioConfiguradorPage() {
  return <RelatorioDistribuicaoView breadcrumb="WMS / Cadastros / Distribuição por Hierarquia" />
}
