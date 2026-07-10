import { useQuery, useMutation } from '@tanstack/react-query'

import { api } from '@/lib/api'

// === Tipos ===

export type CadastroFiscal = 'NCM' | 'CFOP' | 'CEST'

export interface ContagemSeedFiscal {
  ncm: number
  cfop: number
  cest: number
}

export interface ResultadoTabelaSucesso {
  inseridos: number
  ignorados: number
}

export interface ResultadoTabelaErro {
  erro: { code: string; message: string }
}

export type ResultadoTabela = ResultadoTabelaSucesso | ResultadoTabelaErro

export type RespostaSeedFiscal = Record<CadastroFiscal, ResultadoTabela>

// === Hooks ===

export function useContagemSeedFiscal() {
  return useQuery<ContagemSeedFiscal>({
    queryKey: ['seed-fiscal-contagem'],
    queryFn: async () => {
      const { data } = await api.get('/fiscal/cadastros/seed/contagem')
      return data
    },
    staleTime: 1000 * 30,
  })
}

export function useDispararSeedFiscal() {
  return useMutation<RespostaSeedFiscal, any, { tabelas: CadastroFiscal[] }>({
    mutationFn: async (body) => {
      const { data } = await api.post('/fiscal/cadastros/seed', body)
      return data
    },
  })
}

// === Funções puras ===

/** Requirement 4.4, 5.2 — payload reflete exatamente o conjunto selecionado, sem duplicatas. */
export function montarTabelasSeedPayload(selecionados: Set<CadastroFiscal>): { tabelas: CadastroFiscal[] } {
  return { tabelas: Array.from(selecionados) }
}

/** Requirement 5.1 — botão habilitado se e somente se ao menos uma tabela está selecionada. */
export function botaoSeedHabilitado(selecionados: Set<CadastroFiscal>): boolean {
  return selecionados.size > 0
}

/** Requirement 5.4, 5.5 — classifica e formata o resultado de uma tabela, independentemente das demais. */
export function classificarResultadoSeedPorTabela(
  resultado: ResultadoTabela
): { tipo: 'sucesso' | 'falha'; mensagem: string } {
  if ('erro' in resultado) {
    return { tipo: 'falha', mensagem: resultado.erro.message }
  }
  return { tipo: 'sucesso', mensagem: `${resultado.inseridos} inserido(s), ${resultado.ignorados} ignorado(s)` }
}

/** Requirement 5.7 — status 403 nunca deve expor contagens/resultados parciais. */
export function deveExibirDadosParciaisSeed(status: number): boolean {
  return status !== 403
}

const PERFIS_ADMIN_SEED_FISCAL = ['ADMIN', 'SUPER_ADMIN']

/** Requirement 6.3 — link de navegação visível apenas para perfis administrativos. */
export function deveExibirLinkSeedFiscal(perfil: string | null): boolean {
  return !!perfil && PERFIS_ADMIN_SEED_FISCAL.includes(perfil)
}
