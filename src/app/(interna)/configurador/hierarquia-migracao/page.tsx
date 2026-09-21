'use client'

import MigracaoAssistidaView from '@/components/hierarquia/MigracaoAssistidaView'

// Rota do WMS. detectModule mapeia /configurador/* → contexto WMS.
export default function HierarquiaMigracaoConfiguradorPage() {
  return <MigracaoAssistidaView breadcrumb="WMS / Cadastros / Migração da Hierarquia" />
}
