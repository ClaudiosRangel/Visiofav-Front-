import type { PaginatedResponse } from '../fiscal/types'

// === Enums ===

export type PrioridadePedido = 'BAIXA' | 'NORMAL' | 'URGENTE'
export type OrigemPedido = 'MANUAL' | 'ECOMMERCE' | 'EDI' | 'ORCAMENTO'
export type StatusPedido = 'RASCUNHO' | 'CONFIRMADO' | 'EM_SEPARACAO' | 'EFETIVADO' | 'FATURADO' | 'CANCELADO'
export type TipoDesconto = 'PERCENTUAL' | 'VALOR_FIXO'
export type TipoAcrescimo = 'FRETE' | 'SEGURO' | 'OUTRAS_DESPESAS'
export type ModalidadeFrete = 0 | 1 | 2 | 3 | 4 | 9

// === Interfaces ===

export interface EnderecoEntrega {
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  uf: string
  cep: string
}

export interface ItemPedidoVenda {
  id: string
  produtoId: string
  produto?: { id: string; codigo: string; nome: string; unidade: string }
  unidade: string
  quantidade: number
  precoUnitario: number
  desconto: number            // percentual
  descontoValor: number       // valor fixo
  frete: number
  seguro: number
  outrasDespesas: number
  precoFinal: number
  valorTotal: number
  quantidadeFaturada: number
  observacaoItem?: string
  dataEntregaItem?: string
  comissaoPercItem?: number
}

export interface VendaEfetivada {
  id: string
  dataEfetivacao: string
  valorTotal: number
  nfeId?: string
  nfeNumero?: number
}

export interface PedidoVenda {
  id: string
  numero: number
  status: StatusPedido
  clienteId: string
  cliente?: { id: string; razaoSocial: string; nomeFantasia?: string }
  vendedorId?: string
  vendedor?: { id: string; nome: string }
  tabelaPrecoId: string
  tabelaPreco?: { id: string; nome: string }
  condicaoPagId?: string
  prioridade: PrioridadePedido
  origemPedido: OrigemPedido
  numeroPedidoCliente?: string
  dataValidade?: string
  dataEntrega?: string
  transportadoraId?: string
  transportadora?: { id: string; razaoSocial: string }
  modalidadeFrete?: ModalidadeFrete
  enderecoEntrega?: EnderecoEntrega
  tipoDesconto?: TipoDesconto
  descontoGeral?: number
  tipoAcrescimo?: TipoAcrescimo
  acrescimoGeral?: number
  observacao?: string
  observacaoNota?: string
  dataLimiteAtendimento?: string
  valorTotal: number
  itens: ItemPedidoVenda[]
  vendasEfetivadas?: VendaEfetivada[]
  motivoCancelamento?: string
  createdAt: string
  updatedAt: string
}

export interface PedidosVendaFilters {
  page?: number
  limit?: number
  status?: StatusPedido
  prioridade?: PrioridadePedido
  origemPedido?: OrigemPedido
  numeroPedidoCliente?: string
  ordenarPorPrioridade?: boolean
}

export interface FaturarParcialPayload {
  itens: Array<{ itemId: string; quantidade: number }>
}

export type PedidosVendaResponse = PaginatedResponse<PedidoVenda>
