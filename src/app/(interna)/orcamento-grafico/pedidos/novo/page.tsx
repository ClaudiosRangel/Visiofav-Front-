'use client'

import { useEffect } from 'react'
import PedidoPropostaForm from '../PedidoPropostaForm'

export default function NovoPedidoPropostaPage() {
  useEffect(() => { document.title = 'Novo Pedido / Proposta' }, [])
  return <PedidoPropostaForm />
}
