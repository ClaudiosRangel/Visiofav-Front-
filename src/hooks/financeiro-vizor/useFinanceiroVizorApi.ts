/**
 * Camada de acesso à API do painel Financeiro Vizor (frontend).
 *
 * Encapsula as chamadas HTTP ao backend (prefixo `/financeiro-vizor` sobre a
 * `API_Base` lida de `NEXT_PUBLIC_API_URL`) usando a instância Axios já
 * configurada do projeto (`@/lib/api`). Essa instância injeta o header
 * `Authorization: Bearer <token>` a partir do `authStorage` (sessionStorage por
 * aba) via interceptor e trata 401/refresh — este módulo não precisa se
 * preocupar com autenticação. Todos os endpoints exigem SUPER_ADMIN no backend.
 *
 * Os tipos de retorno/entrada espelham o contrato real do backend
 * (ver `@/lib/financeiro-vizor/types`). Cada método devolve diretamente
 * `response.data` (a Promise resolve com o payload já desembrulhado), deixando o
 * tratamento de erro para os hooks react-query (via `traduzirErroApi`).
 *
 * _Requirements: 8.1 (API_Base de NEXT_PUBLIC_API_URL), 8.2 (Authorization do
 * authStorage)._
 */

import { api } from '@/lib/api'
import type {
  DetalheCobranca,
  EmpresaStatusView,
  FaturaView,
  GerarVencimentosInput,
  GerarVencimentosResultado,
  SalvarContratoInput,
  StatusEmpresaResultado,
} from '@/lib/financeiro-vizor/types'

/** Prefixo comum de todas as rotas do painel (relativo à `baseURL` do Axios). */
const BASE = '/financeiro-vizor'

export const financeiroVizorApi = {
  /** Lista as empresas com seu status financeiro. `GET /empresas`. */
  listarEmpresas: () =>
    api.get<EmpresaStatusView[]>(`${BASE}/empresas`).then((r) => r.data),

  /**
   * Detalhe de cobrança de uma empresa (contrato, preços, totais, faturas).
   * `GET /empresas/:id`.
   */
  obterDetalhe: (id: string) =>
    api.get<DetalheCobranca>(`${BASE}/empresas/${id}`).then((r) => r.data),

  /** Cria/atualiza o contrato (upsert). `PUT /empresas/:id/contrato`. */
  salvarContrato: (id: string, input: SalvarContratoInput) =>
    api
      .put<DetalheCobranca>(`${BASE}/empresas/${id}/contrato`, input)
      .then((r) => r.data),

  /** Gera N faturas mensais em lote. `POST /empresas/:id/gerar-vencimentos`. */
  gerarVencimentos: (id: string, input: GerarVencimentosInput) =>
    api
      .post<GerarVencimentosResultado>(
        `${BASE}/empresas/${id}/gerar-vencimentos`,
        input,
      )
      .then((r) => r.data),

  /** Marca uma fatura como paga. `POST /empresas/:id/faturas/:faturaId/baixa`. */
  darBaixa: (id: string, faturaId: string) =>
    api
      .post<FaturaView>(`${BASE}/empresas/${id}/faturas/${faturaId}/baixa`)
      .then((r) => r.data),

  /** Cancela uma fatura. `POST /empresas/:id/faturas/:faturaId/cancelar`. */
  cancelarFatura: (id: string, faturaId: string) =>
    api
      .post<FaturaView>(`${BASE}/empresas/${id}/faturas/${faturaId}/cancelar`)
      .then((r) => r.data),

  /** Reativa a empresa (→ ATIVO). `POST /empresas/:id/reativar`. */
  reativar: (id: string) =>
    api
      .post<StatusEmpresaResultado>(`${BASE}/empresas/${id}/reativar`)
      .then((r) => r.data),

  /** Inativa a empresa (→ INATIVADO). `POST /empresas/:id/inativar`. */
  inativar: (id: string) =>
    api
      .post<StatusEmpresaResultado>(`${BASE}/empresas/${id}/inativar`)
      .then((r) => r.data),
}
