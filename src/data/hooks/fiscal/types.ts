// === Tipos compartilhados do módulo fiscal ===

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface FiscalFilters {
  page?: number
  limit?: number
  status?: string
  periodo?: string       // YYYY-MM
  dataInicio?: string    // ISO date
  dataFim?: string       // ISO date
  busca?: string
}

// === Documento Fiscal ===

export type StatusDocumento =
  | 'RASCUNHO' | 'PENDENTE' | 'AUTORIZADA' | 'REJEITADA'
  | 'CANCELADA' | 'DENEGADA' | 'CONTINGENCIA'
  | 'FALHA_RETRANSMISSAO' | 'INUTILIZADO'

export interface DocumentoFiscal {
  id: string
  tipo: 'NFE' | 'NFCE' | 'CTE' | 'MDFE' | 'NFSE'
  serie: number
  numero: number
  chaveAcesso: string | null
  status: StatusDocumento
  naturezaOp: string | null
  dataEmissao: string
  destCpfCnpj: string | null
  destRazao: string | null
  valorTotal: number
  protocolo: string | null
  contingencia: boolean
  ambiente: 1 | 2
}

// === Emissão NF-e ===

export interface Endereco {
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  codigoMunicipio: string
  municipio: string
  uf: string
  cep: string
}

export interface ItemNfe {
  produtoId?: string
  codigoProd: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorDesconto?: number
}

export interface DadosTransporte {
  modalidadeFrete: 0 | 1 | 2 | 3 | 4 | 9
  transportadoraCpfCnpj?: string
  transportadoraRazao?: string
  placa?: string
  ufVeiculo?: string
}

export interface DadosPagamento {
  formaPagamento: string
  valor: number
  bandeira?: string
  autorizacao?: string
}

// === Motor Tributário ===

export interface SimulacaoMotorPayload {
  ncm: string
  cfop: string
  ufOrigem: string
  ufDestino: string
  regime: string
}

export interface SimulacaoMotorResponse {
  encontrada: boolean
  nivelFallback: 'EXATO' | 'NCM_PARCIAL' | 'CFOP_GENERICO' | 'PADRAO_REGIME' | null
  regra: {
    id: string
    ncm: string
    cfop: string
    ufOrigem: string
    ufDestino: string
    regime: string
    cstCsosn: string
    aliqIcms: number
    aliqPis: number
    aliqCofins: number
    aliqIpi: number
  } | null
}

// === Emissão NF-e ===

export interface EmissaoNfePayload {
  dadosGerais: {
    naturezaOp: string
    tipoOperacao: 0 | 1
    finalidade: 1 | 2 | 3 | 4
    dataEmissao: string
    dataSaida?: string
  }
  destinatario: {
    cpfCnpj: string
    razaoSocial: string
    ie?: string
    uf: string
    endereco: Endereco
  }
  itens: ItemNfe[]
  transporte: DadosTransporte
  pagamento: DadosPagamento
  informacoesComplementares?: string
}
