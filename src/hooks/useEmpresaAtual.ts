'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface EmpresaAtual {
  usaWms: boolean
}

/**
 * Busca os dados da empresa selecionada pelo usuário autenticado (`GET /empresas/minha`),
 * expondo o campo `usaWms` já retornado pela API — usado para decidir a visibilidade e o
 * acesso à Tela_Kardex (Requirements 9.1, 9.2, 9.3, 9.4).
 */
export function useEmpresaAtual() {
  const { data, isLoading, isError, error } = useQuery<EmpresaAtual>({
    queryKey: ['empresa-atual-usa-wms'],
    queryFn: async () => {
      const { data } = await api.get('/empresas/minha')
      return data
    },
    staleTime: 1000 * 60 * 5,
  })

  return { usaWms: data?.usaWms ?? false, isLoading, isError, error }
}

/**
 * Requirements 9.1, 9.2 — a entrada de navegação para a Tela_Kardex SHALL ser exibida se e
 * somente se a empresa autenticada é uma Empresa_Sem_WMS (usaWms === false).
 */
export function deveExibirLinkKardex(usaWms: boolean): boolean {
  return usaWms === false
}

/**
 * Requirements 9.3, 9.4 — redireciona para fora da Tela_Kardex quando a empresa usa WMS,
 * exceto quando o usuário já dispensou permanentemente o aviso (preferência local).
 */
export function deveRedirecionarKardex(usaWms: boolean, avisoDispensado: boolean): boolean {
  return usaWms === true && avisoDispensado === false
}
