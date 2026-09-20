'use client'

import HierarquiaMercadologicaView from '@/components/hierarquia/HierarquiaMercadologicaView'

// Rota do WMS (acessada pelo menu Cadastros do WMS). O contexto/sidebar
// permanece WMS porque `detectModule` mapeia /configurador/hierarquia → 'wms'.
export default function HierarquiaMercadologicaConfiguradorPage() {
  return <HierarquiaMercadologicaView breadcrumb="WMS / Cadastros / Hierarquia Mercadológica" />
}
