import { api } from '@/lib/api'
import type {
  AjusteProdutividade,
  AjusteProdutividadeInput,
  CampoLivre,
  CampoLivreInput,
  CatalogoPlano,
  CatalogoProduto,
  DefaultProdutoPlano,
  DefaultProdutoPlanoInput,
  ItemDiversoGrafico,
  ItemDiversoGraficoInput,
  LimiteMontagem,
  LimiteMontagemInput,
  ListaAjustesParams,
  ListaCamposLivresParams,
  ListaItensDiversosParams,
  ListaPaginada,
  ListaProdutosParams,
  ListaQuebrasParams,
  ListaRelacoesParams,
  ListaTiposPlanoParams,
  PaginacaoParams,
  Parametros,
  ProdutoGrafico,
  ProdutoGraficoInput,
  QuebraGrafica,
  QuebraGraficaInput,
  RelacaoCadastroGrafico,
  RestricoesAutomaticas,
  SalvarRelacoesInput,
  SalvarSelecaoMaterialInput,
  SalvarSelecaoMaterialResposta,
  RemoverSelecaoMaterialResposta,
  SelecaoMaterial,
  TipoPlanoGrafico,
  TipoPlanoGraficoInput,
  VerificacaoRelacoes,
} from './cadastros-graficos.types'

// ============================================================================
// Acesso à API dos cadastros gráficos do orçamento.
// `api` já tem baseURL com /api; o prefixo abaixo é o do módulo.
// Exclusões (DELETE) são lógicas (inativam), exceto ajustes e limites de montagem.
// ============================================================================

const BASE = '/orcamento-grafico/cadastros'

// ───────────────────────────── Produtos ─────────────────────────────

export const produtosApi = {
  listar: (params?: ListaProdutosParams) =>
    api.get<ProdutoGrafico[]>(`${BASE}/produtos`, { params }).then((r) => r.data),
  obter: (id: string) => api.get<ProdutoGrafico>(`${BASE}/produtos/${id}`).then((r) => r.data),
  criar: (dados: ProdutoGraficoInput) =>
    api.post<ProdutoGrafico>(`${BASE}/produtos`, dados).then((r) => r.data),
  atualizar: (id: string, dados: Partial<ProdutoGraficoInput>) =>
    api.patch<ProdutoGrafico>(`${BASE}/produtos/${id}`, dados).then((r) => r.data),
  inativar: (id: string) => api.delete(`${BASE}/produtos/${id}`).then(() => undefined),

  // Defaults do produto por tipo de plano (exige relação PRODUTO→PLANO)
  listarDefaults: (produtoId: string) =>
    api.get<DefaultProdutoPlano[]>(`${BASE}/produtos/${produtoId}/defaults`).then((r) => r.data),
  salvarDefault: (produtoId: string, tipoPlanoId: string, dados: DefaultProdutoPlanoInput) =>
    api
      .put<DefaultProdutoPlano>(`${BASE}/produtos/${produtoId}/defaults/${tipoPlanoId}`, dados)
      .then((r) => r.data),
  removerDefault: (produtoId: string, tipoPlanoId: string) =>
    api.delete(`${BASE}/produtos/${produtoId}/defaults/${tipoPlanoId}`).then(() => undefined),
}

// ───────────────────────────── Tipos de Plano ─────────────────────────────

export const tiposPlanoApi = {
  listar: (params?: ListaTiposPlanoParams) =>
    api.get<TipoPlanoGrafico[]>(`${BASE}/tipos-plano`, { params }).then((r) => r.data),
  obter: (id: string) => api.get<TipoPlanoGrafico>(`${BASE}/tipos-plano/${id}`).then((r) => r.data),
  criar: (dados: TipoPlanoGraficoInput) =>
    api.post<TipoPlanoGrafico>(`${BASE}/tipos-plano`, dados).then((r) => r.data),
  atualizar: (id: string, dados: Partial<TipoPlanoGraficoInput>) =>
    api.patch<TipoPlanoGrafico>(`${BASE}/tipos-plano/${id}`, dados).then((r) => r.data),
  /** Plano fixo não pode ser excluído (409). */
  inativar: (id: string) => api.delete(`${BASE}/tipos-plano/${id}`).then(() => undefined),
}

// ───────────────────────────── Relações ─────────────────────────────

export const relacoesApi = {
  listar: (params?: ListaRelacoesParams) =>
    api.get<RelacaoCadastroGrafico[]>(`${BASE}/relacoes`, { params }).then((r) => r.data),
  verificar: () => api.get<VerificacaoRelacoes>(`${BASE}/relacoes/verificar`).then((r) => r.data),
  /** Substitui o conjunto de destinos de uma origem + par de tipos (idempotente). */
  salvar: (dados: SalvarRelacoesInput) =>
    api.put<RelacaoCadastroGrafico[]>(`${BASE}/relacoes`, dados).then((r) => r.data),
}

// ───────────────────────────── Itens Diversos ─────────────────────────────

export const itensDiversosApi = {
  listar: (params?: ListaItensDiversosParams) =>
    api.get<ListaPaginada<ItemDiversoGrafico>>(`${BASE}/itens-diversos`, { params }).then((r) => r.data),
  obter: (id: string) =>
    api.get<ItemDiversoGrafico>(`${BASE}/itens-diversos/${id}`).then((r) => r.data),
  criar: (dados: ItemDiversoGraficoInput) =>
    api.post<ItemDiversoGrafico>(`${BASE}/itens-diversos`, dados).then((r) => r.data),
  atualizar: (id: string, dados: Partial<ItemDiversoGraficoInput>) =>
    api.patch<ItemDiversoGrafico>(`${BASE}/itens-diversos/${id}`, dados).then((r) => r.data),
  inativar: (id: string) => api.delete(`${BASE}/itens-diversos/${id}`).then(() => undefined),
}

// ───────────────────────────── Campos Livres ─────────────────────────────

export const camposLivresApi = {
  listar: (params?: ListaCamposLivresParams) =>
    api.get<CampoLivre[]>(`${BASE}/campos-livres`, { params }).then((r) => r.data),
  obter: (id: string) => api.get<CampoLivre>(`${BASE}/campos-livres/${id}`).then((r) => r.data),
  criar: (dados: CampoLivreInput) =>
    api.post<CampoLivre>(`${BASE}/campos-livres`, dados).then((r) => r.data),
  atualizar: (id: string, dados: Partial<CampoLivreInput>) =>
    api.patch<CampoLivre>(`${BASE}/campos-livres/${id}`, dados).then((r) => r.data),
  inativar: (id: string) => api.delete(`${BASE}/campos-livres/${id}`).then(() => undefined),
}

// ───────────────────────────── Ajustes de Produtividade ─────────────────────────────

export const ajustesProdutividadeApi = {
  listar: (params?: ListaAjustesParams) =>
    api
      .get<ListaPaginada<AjusteProdutividade>>(`${BASE}/ajustes-produtividade`, { params })
      .then((r) => r.data),
  restricoesAutomaticas: () =>
    api
      .get<RestricoesAutomaticas>(`${BASE}/ajustes-produtividade/restricoes-automaticas`)
      .then((r) => r.data),
  obter: (id: string) =>
    api.get<AjusteProdutividade>(`${BASE}/ajustes-produtividade/${id}`).then((r) => r.data),
  criar: (dados: AjusteProdutividadeInput) =>
    api.post<AjusteProdutividade>(`${BASE}/ajustes-produtividade`, dados).then((r) => r.data),
  atualizar: (id: string, dados: Partial<AjusteProdutividadeInput>) =>
    api.patch<AjusteProdutividade>(`${BASE}/ajustes-produtividade/${id}`, dados).then((r) => r.data),
  /** Exclusão física. */
  excluir: (id: string) => api.delete(`${BASE}/ajustes-produtividade/${id}`).then(() => undefined),
}

// ───────────────────────────── Quebras ─────────────────────────────

export const quebrasApi = {
  listar: (params?: ListaQuebrasParams) =>
    api.get<QuebraGrafica[]>(`${BASE}/quebras`, { params }).then((r) => r.data),
  obter: (id: string) => api.get<QuebraGrafica>(`${BASE}/quebras/${id}`).then((r) => r.data),
  criar: (dados: QuebraGraficaInput) =>
    api.post<QuebraGrafica>(`${BASE}/quebras`, dados).then((r) => r.data),
  atualizar: (id: string, dados: Partial<QuebraGraficaInput>) =>
    api.patch<QuebraGrafica>(`${BASE}/quebras/${id}`, dados).then((r) => r.data),
  inativar: (id: string) => api.delete(`${BASE}/quebras/${id}`).then(() => undefined),
}

// ───────────────────────────── Limites de Montagem ─────────────────────────────

export const limitesMontagemApi = {
  listar: (params?: PaginacaoParams) =>
    api.get<ListaPaginada<LimiteMontagem>>(`${BASE}/limites-montagem`, { params }).then((r) => r.data),
  obter: (id: string) =>
    api.get<LimiteMontagem>(`${BASE}/limites-montagem/${id}`).then((r) => r.data),
  criar: (dados: LimiteMontagemInput) =>
    api.post<LimiteMontagem>(`${BASE}/limites-montagem`, dados).then((r) => r.data),
  atualizar: (id: string, dados: Partial<LimiteMontagemInput>) =>
    api.patch<LimiteMontagem>(`${BASE}/limites-montagem/${id}`, dados).then((r) => r.data),
  /** Exclusão física. */
  excluir: (id: string) => api.delete(`${BASE}/limites-montagem/${id}`).then(() => undefined),
}

// ───────────────────────────── Parâmetros do Orçamento ─────────────────────────────

export const parametrosApi = {
  obter: () => api.get<Parametros>(`${BASE}/parametros`).then((r) => r.data),
  /** Só ADMIN/SUPER_ADMIN. Chaves sem prefixo `orc.` (ex.: refileFinal). */
  salvar: (valores: Record<string, number>) =>
    api.put<Parametros>(`${BASE}/parametros`, valores).then((r) => r.data),
}

// ───────────────────────────── Catálogo (leitura) ─────────────────────────────

export const catalogoApi = {
  produto: (produtoId: string) =>
    api.get<CatalogoProduto>(`${BASE}/catalogo/produto/${produtoId}`).then((r) => r.data),
  plano: (tipoPlanoId: string, produtoId?: string) =>
    api
      .get<CatalogoPlano>(`${BASE}/catalogo/plano/${tipoPlanoId}`, { params: { produtoId } })
      .then((r) => r.data),
}

// ───────────────────────────── Seleção de material do item ─────────────────────────────

export const selecaoMaterialApi = {
  listar: (itemId: string) =>
    api
      .get<{ dados: SelecaoMaterial[] }>(`${BASE}/selecao-material`, { params: { itemId } })
      .then((r) => r.data.dados),
  salvar: (dados: SalvarSelecaoMaterialInput) =>
    api.put<SalvarSelecaoMaterialResposta>(`${BASE}/selecao-material`, dados).then((r) => r.data),
  /** Remove a seleção do par (item, plano, atividade). Idempotente. */
  remover: (itemId: string, acabamentoId: string, planoId?: string | null) =>
    api
      .delete<RemoverSelecaoMaterialResposta>(`${BASE}/selecao-material`, {
        params: { itemId, acabamentoId, ...(planoId ? { planoId } : {}) },
      })
      .then((r) => r.data),
}

/** Extrai a mensagem de erro da API (padrão `{ message }`). */
export function mensagemErroApi(err: unknown, padrao = 'Falha na operação'): string {
  const e = err as { response?: { data?: { message?: string } } }
  return e?.response?.data?.message || padrao
}
