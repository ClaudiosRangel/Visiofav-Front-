'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY_TOKEN = 'visiofab-wms-token'

/**
 * Guard de autenticação client-side para as páginas internas (grupo de
 * rotas `(interna)`).
 *
 * Sem este guard, um usuário que clicou em "Sair" (ou cujo token expirou)
 * ainda conseguia ver dados ao navegar diretamente para uma URL protegida
 * (ex: /configurador/produtos) ou usando o botão "voltar" do navegador —
 * porque nada verificava a presença do token antes de renderizar o
 * conteúdo da página, e o cache do React Query podia devolver dados
 * antigos instantaneamente enquanto o token era (re)validado em segundo
 * plano.
 *
 * Retorna `pronto = true` somente depois de confirmar que existe um token
 * no localStorage. Enquanto `pronto` for `false`, o layout NÃO deve
 * renderizar `children` — evitando qualquer flash de dados protegidos.
 */
export function useRequireAuth() {
  const router = useRouter()
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN)
    if (!token) {
      router.replace('/login')
      return
    }
    setPronto(true)
  }, [router])

  return pronto
}
