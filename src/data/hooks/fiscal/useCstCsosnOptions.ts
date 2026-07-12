import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface CstListItem {
  codigo: string
  descricao: string
}

interface CstListResponse {
  data: CstListItem[]
  total: number
}

/**
 * Busca os códigos de CST de um imposto (ICMS, PIS, COFINS ou IPI) para uso
 * em combobox — consome as tabelas de referência estáticas já expostas por
 * `GET /fiscal/cadastros/cst?tipo=X` (usadas por `validarCstCsosn`, o motor
 * de validação de compatibilidade), sem depender do cadastro persistido
 * (que é editável pelo usuário e pode não conter todos os códigos oficiais).
 */
export function useCstOptions(tipo: 'ICMS' | 'PIS' | 'COFINS' | 'IPI') {
  const { data, isLoading } = useQuery<CstListResponse>({
    queryKey: ['fiscal-cst-options', tipo],
    queryFn: async () => {
      const { data } = await api.get<CstListResponse>('/fiscal/cadastros/cst', {
        params: { tipo },
      })
      return data
    },
    staleTime: 1000 * 60 * 5,
  })

  const options = (data?.data || []).map((c) => ({
    value: c.codigo,
    label: `${c.codigo} - ${c.descricao}`,
  }))

  return { options, isLoading }
}

/**
 * Busca os códigos de CSOSN (Simples Nacional) para uso em combobox —
 * consome a tabela de referência estática exposta por `GET /fiscal/cadastros/csosn`.
 */
export function useCsosnOptions() {
  const { data, isLoading } = useQuery<CstListResponse>({
    queryKey: ['fiscal-csosn-options'],
    queryFn: async () => {
      const { data } = await api.get<CstListResponse>('/fiscal/cadastros/csosn')
      return data
    },
    staleTime: 1000 * 60 * 5,
  })

  const options = (data?.data || []).map((c) => ({
    value: c.codigo,
    label: `${c.codigo} - ${c.descricao}`,
  }))

  return { options, isLoading }
}
