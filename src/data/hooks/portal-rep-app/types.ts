// ─── Auth ────────────────────────────────────────────────────────
export interface LoginPayload {
  email: string
  senha: string
  empresaId?: string
}

export interface LoginResponse {
  token: string
  refreshToken: string
  senhaTemporaria: boolean
  representante: {
    id: string
    nome: string
    email: string
  }
}

export interface TrocarSenhaPayload {
  senhaAtual: string
  novaSenha: string
}

// ─── Clientes ────────────────────────────────────────────────────
export interface ClienteCarteira {
  id: string
  razaoSocial: string
  nomeFantasia: string | null
  cpfCnpj: string
  inscricaoEstadual: string | null
  telefone: string | null
  email: string | null
  cidade: string | null
  uf: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cep: string | null
}

export interface CriarClientePayload {
  razaoSocial: string
  nomeFantasia?: string
  cpfCnpj: string
  inscricaoEstadual?: string
  telefone?: string
  email?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string
}

export interface EditarClientePayload {
  telefone?: string
  email?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string
}

export interface SolicitarAlteracaoFiscalPayload {
  razaoSocial?: string
  cpfCnpj?: string
  inscricaoEstadual?: string
}

// ─── Solicitações de Orçamento ───────────────────────────────────
export type StatusSolicitacao = 'PENDENTE' | 'CALCULADO' | 'ENVIADO' | 'ACEITO' | 'RECUSADO'

export interface ItemSolicitacao {
  produtoNome: string
  quantidade: number
  especificacao?: string
  precoUnitario?: number  // apenas quando status >= CALCULADO
  precoTotal?: number     // apenas quando status >= CALCULADO
}

export interface SolicitacaoOrcamento {
  id: string
  clienteId: string
  clienteNome: string
  status: StatusSolicitacao
  criadoEm: string
  itens: ItemSolicitacao[]
}

export interface CriarSolicitacaoPayload {
  clienteId: string
  itens: Array<{
    produtoNome: string
    quantidade: number
    especificacao?: string
  }>
}

// ─── Pipeline ────────────────────────────────────────────────────
export type StatusPedido =
  | 'ORCAMENTO'
  | 'PV'
  | 'OP'
  | 'PRODUCAO'
  | 'EXPEDICAO'
  | 'ENTREGUE'

export interface PedidoPipeline {
  id: string
  numero: string
  clienteNome: string
  statusAtual: StatusPedido
  criadoEm: string
  dataEntregaPrevista: string | null
}

export interface DetalhePipeline {
  id: string
  numero: string
  clienteNome: string
  statusAtual: StatusPedido
  percentualProducao: number | null // só quando status === 'PRODUCAO'
  produtos: Array<{ nome: string; quantidade: number }>
  criadoEm: string
  dataEntregaPrevista: string | null
  transicoes: Array<{ status: StatusPedido; data: string }>
}

// ─── Comissões ───────────────────────────────────────────────────
export interface ResumoComissao {
  mes: number
  ano: number
  projetada: number
  realizada: number
}

export interface DetalheComissao {
  pedidoNumero: string
  clienteNome: string
  valorVenda: number
  percentualComissao: number
  valorComissao: number
}

// ─── Notificações ────────────────────────────────────────────────
export interface Notificacao {
  id: string
  titulo: string
  mensagem: string
  lida: boolean
  criadoEm: string
}

// ─── Dashboard ───────────────────────────────────────────────────
export interface DashboardData {
  orcamentosPendentes: number
  pipeline: Record<StatusPedido, number>
  comissaoMes: { projetada: number; realizada: number }
}
