'use client'

/**
 * Tela do plano (rota `/orcamento-grafico/:id/itens/:itemId/planos/:planoId`) — Tela_Plano da
 * Fase 3. `planoId = novo` cria o plano no OK; `?apos=<planoId>` posiciona o novo logo abaixo.
 */

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Center, Loader } from '@mantine/core'

import TelaPlano from '../../_plano/TelaPlano'

function PaginaPlanoConteudo() {
  const params = useParams()
  const busca = useSearchParams()
  return (
    <TelaPlano
      orcamentoId={params.id as string}
      itemId={params.itemId as string}
      planoId={params.planoId as string}
      posicaoApos={busca.get('apos')}
    />
  )
}

export default function PaginaPlano() {
  return (
    <Suspense
      fallback={
        <Center py="xl">
          <Loader size="lg" />
        </Center>
      }
    >
      <PaginaPlanoConteudo />
    </Suspense>
  )
}
