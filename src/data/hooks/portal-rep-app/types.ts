// ─── Auth ────────────────────────────────────────────────────────
export interface LoginPayload {
  email: string
  senha: string
  empresaId?: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  representante: {
    id: string
    nome: string
    email: string
    empresaId: string
    vendedorId: string
    senhaTemporaria: boolean
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
  clienteId: string | null
  clienteNome: string | null
  status: StatusSolicitacao
  criadoEm: string
  atualizadoEm?: string
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

export interface CriarSolicitacaoPayload {
  clienteId?: string
  clienteNome?: string
  clienteCpfCnpj?: string
  tipoEmbalagem: string
  quantidade: number
  medidaLargura?: number
  medidaAltura?: number
  medidaComprimento?: number
  acabamentos?: string
  observacoes?: string
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
  pedidoVendaId: string
  numeroPedido: number
  clienteNome: string
  clienteId: string | null
  valorTotal: number
  dataEntrega: string | null
  criadoEm: string
  etapaAtual: string
  etapaIndex: number
  progressoProducao: number | null
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
  pedidoVendaId: string
  numeroPedido: number
  clienteNome: string | null
  precoVenda: number
  comissaoPercentual: number
  comissaoValor: number
  status: 'PROJETADA' | 'REALIZADA'
  dataPedido: string
  dataRealizacao: string | null
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
