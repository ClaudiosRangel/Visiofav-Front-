'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import PedidoPropostaForm from '../PedidoPropostaForm'

export default function EditarPedidoPropostaPage() {
  const params = useParams()
  const id = params.id as string
  useEffect(() => { document.title = 'Pedido / Proposta' }, [])
  return <PedidoPropostaForm pedidoId={id} />
}
