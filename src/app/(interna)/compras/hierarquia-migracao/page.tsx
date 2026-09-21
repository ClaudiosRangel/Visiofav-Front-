'use client'

import MigracaoAssistidaView from '@/components/hierarquia/MigracaoAssistidaView'

// Rota própria do Compras — /compras/* mantém o contexto Compras (detectModule).
export default function HierarquiaMigracaoComprasPage() {
  return <MigracaoAssistidaView breadcrumb="Compras / Cadastros / Migração da Hierarquia" />
}
