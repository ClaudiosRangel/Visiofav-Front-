// ─── Tipos (Enums) ────────────────────────────────────────────────

export type StatusRepresentante = 'ATIVO' | 'INATIVO'
export type CriterioComissao = 'ENTREGUE' | 'FATURADO' | 'PAGO'
export type TipoAprovacao = 'VINCULACAO' | 'ALTERACAO_FISCAL'
export type StatusAprovacao = 'PENDENTE' | 'APROVADA' | 'REJEITADA'
export type StatusSolicitacao = 'PENDENTE' | 'CALCULADO' | 'ENVIADO' | 'ACEITO' | 'RECUSADO'

// ─── Representantes ──────────────────────────────────────────────

export interface Representante {
  id: string
  vendedorId: string
  vendedorNome: string
  email: string
  status: StatusRepresentante
  senhaTemporaria: boolean
  notificacaoEmail: boolean
  ultimoAcesso: string | null
  criadoEm: string
}

export interface VendedorDisponivel {
  id: string
  nome: string
}

export interface CriarRepresentantePayload {
  vendedorId: string
  email: string
}

export interface CriarRepresentanteResponse {
  id: string
  senhaTemporaria: string
}

export interface EditarRepresentantePayload {
  email?: string
  status?: StatusRepresentante
  notificacaoEmail?: boolean
}

export interface ResetarSenhaResponse {
  senhaTemporaria: string
}

// ─── Solicitações de Orçamento ───────────────────────────────────

export interface SolicitacaoOrcamento {
  id: string
  representanteId: string
  representante?: {
    email: string
    vendedor: { nome: string }
  }
  representanteNome?: string
  clienteNome: string | null
  status: StatusSolicitacao
  criadoEm: string
  tipoEmbalagem: string
  quantidade: number
  medidaLargura?: number | null
  medidaAltura?: number | null
  medidaComprimento?: number | null
  acabamentos?: string | null
  observacoes?: string | null
  precoVenda?: number | null
  precoUnitario?: number | null
}

export interface SolicitacaoItem {
  produtoNome: string
  quantidade: number
  especificacao?: string
}

export interface SolicitacoesFilters {
  page: number
  pageSize: number
  status?: StatusSolicitacao
  vendedorId?: string
  clienteNome?: string
  dataInicio?: string
  dataFim?: string
}

export interface PaginatedResponse<T> {
  solicitacoes: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ─── Configuração de Comissão ────────────────────────────────────

export interface ConfiguracaoComissao {
  criterio: CriterioComissao
}

export interface AlterarComissaoPayload {
  criterio: CriterioComissao
}

// ─── Aprovações de Clientes ──────────────────────────────────────

export interface AprovacaoCliente {
  id: string
  representanteNome: string
  clienteNome: string
  tipo: TipoAprovacao
  status: StatusAprovacao
  criadoEm: string
  dadosAnteriores: Record<string, unknown>
  dadosNovos: Record<string, unknown>
}

// ─── Constantes de UI ────────────────────────────────────────────

export const statusRepresentanteColors: Record<StatusRepresentante, string> = {
  ATIVO: 'green',
  INATIVO: 'red',
}

export const statusSolicitacaoColors: Record<StatusSolicitacao, string> = {
  PENDENTE: 'yellow',
  CALCULADO: 'blue',
  ENVIADO: 'cyan',
  ACEITO: 'green',
  RECUSADO: 'red',
}

export const criterioComissaoOptions = [
  { value: 'ENTREGUE', label: 'Entregue', description: 'Comissão creditada na confirmação de entrega' },
  { value: 'FATURADO', label: 'Faturado', description: 'Comissão creditada na emissão da nota fiscal' },
  { value: 'PAGO', label: 'Pago', description: 'Comissão creditada na confirmação de pagamento' },
] as const
