'use client'

import HierarquiaMercadologicaView from '@/components/hierarquia/HierarquiaMercadologicaView'

// Rota própria do módulo Compras. Como o caminho começa com /compras,
// `detectModule` mantém o contexto/sidebar em Compras — o usuário não é
// levado para o WMS ao acessar a hierarquia por aqui.
export default function HierarquiaMercadologicaComprasPage() {
  return <HierarquiaMercadologicaView breadcrumb="Compras / Cadastros / Hierarquia Mercadológica" />
}
