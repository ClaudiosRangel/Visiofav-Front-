'use client'

import RelatorioDistribuicaoView from '@/components/hierarquia/RelatorioDistribuicaoView'

// Rota própria do Compras — /compras/* mantém o contexto Compras (detectModule).
export default function HierarquiaRelatorioComprasPage() {
  return <RelatorioDistribuicaoView breadcrumb="Compras / Cadastros / Distribuição por Hierarquia" />
}
