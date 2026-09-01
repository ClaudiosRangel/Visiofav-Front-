'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthToken, getUserRaw } from '@/lib/authStorage'

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
    const token = getAuthToken()
    if (!token) {
      router.replace('/login')
      return
    }

    // Se é primeiro acesso (senha temporária não alterada), redirecionar
    // para a tela de alteração obrigatória
    const userStr = getUserRaw()
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        if (user.primeiroLogin) {
          router.replace('/alterar-senha-obrigatoria')
          return
        }
      } catch { /* ignora JSON inválido */ }
    }

    setPronto(true)
  }, [router])

  return pronto
}
