import type { EnderecoEntrega, StatusPedido, ItemPedidoVenda, PrioridadePedido } from '@/data/hooks/vendas/types'

// === Priority Colors ===
export const PRIORIDADE_COLORS: Record<PrioridadePedido, string> = {
  URGENTE: 'red',
  NORMAL: 'blue',
  BAIXA: 'gray',
}

// === Item Total Calculation ===
export function calcularTotalItem(item: {
  precoUnitario: number
  desconto: number       // percentual 0-100
  descontoValor: number  // valor fixo
  quantidade: number
  frete: number
  seguro: number
  outrasDespesas: number
}): number {
  const precoComDesconto = item.precoUnitario * (1 - item.desconto / 100)
  const precoFinal = precoComDesconto - item.descontoValor
  return precoFinal * item.quantidade + item.frete + item.seguro + item.outrasDespesas
}

// === Address Formatting ===
export function formatarEnderecoEntrega(endereco: EnderecoEntrega): string {
  let result = `${endereco.logradouro}, ${endereco.numero}`
  if (endereco.complemento) result += ` - ${endereco.complemento}`
  result += ` - ${endereco.bairro}, ${endereco.cidade}/${endereco.uf} - CEP: ${endereco.cep}`
  return result
}

// === Billing Progress Color ===
export function getProgressColor(quantidadeFaturada: number, quantidade: number): string {
  if (quantidadeFaturada >= quantidade) return 'green'
  if (quantidadeFaturada > 0) return 'orange'
  return 'gray'
}

// === Status-Based Field Disabling ===
const CAMPOS_EDITAVEIS_CONFIRMADO = [
  'observacao', 'observacaoNota', 'prioridade',
  'dataEntrega', 'transportadoraId', 'modalidadeFrete', 'enderecoEntrega',
] as const

export function isFieldDisabled(fieldName: string, status: StatusPedido): boolean {
  if (status === 'RASCUNHO') return false
  if (status === 'CONFIRMADO') {
    return !(CAMPOS_EDITAVEIS_CONFIRMADO as readonly string[]).includes(fieldName)
  }
  return true
}

export function isItemEditable(item: Pick<ItemPedidoVenda, 'quantidadeFaturada'>, status: StatusPedido): boolean {
  if (status === 'RASCUNHO') return true
  if (status === 'CONFIRMADO') return item.quantidadeFaturada === 0
  return false
}

// === Field-to-Tab Mapping (for auto-navigation to tab with error) ===
export const FIELD_TO_TAB: Record<string, string> = {
  clienteId: 'cabecalho',
  vendedorId: 'cabecalho',
  tabelaPrecoId: 'cabecalho',
  condicaoPagId: 'cabecalho',
  prioridade: 'cabecalho',
  origemPedido: 'cabecalho',
  numeroPedidoCliente: 'cabecalho',
  dataValidade: 'cabecalho',
  orcamentoOrigemId: 'cabecalho',
  dataEntrega: 'entrega',
  transportadoraId: 'entrega',
  modalidadeFrete: 'entrega',
  enderecoEntrega: 'entrega',
  tipoDesconto: 'financeiro',
  descontoGeral: 'financeiro',
  tipoAcrescimo: 'financeiro',
  acrescimoGeral: 'financeiro',
  itens: 'itens',
  observacao: 'observacoes',
  observacaoNota: 'observacoes',
}

/** @deprecated Use FIELD_TO_TAB — kept for backward compatibility */
export const FIELD_TO_SECTION = FIELD_TO_TAB

export function getFirstErrorTab(errors: Record<string, any>): string | null {
  for (const field of Object.keys(errors)) {
    const tab = FIELD_TO_TAB[field]
    if (tab) return tab
  }
  return null
}

/** @deprecated Use getFirstErrorTab — kept for backward compatibility */
export function getFirstErrorSection(errors: Record<string, any>): string | null {
  return getFirstErrorTab(errors)
}

// === Modalidade Frete Labels ===
export const MODALIDADE_FRETE_OPTIONS = [
  { value: '0', label: '0 - CIF (Contratação do frete por conta do remetente)' },
  { value: '1', label: '1 - FOB (Contratação do frete por conta do destinatário)' },
  { value: '2', label: '2 - Terceiros' },
  { value: '3', label: '3 - Próprio por conta do remetente' },
  { value: '4', label: '4 - Próprio por conta do destinatário' },
  { value: '9', label: '9 - Sem frete' },
]
