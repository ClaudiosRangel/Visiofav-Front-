/**
 * Prazo de pagamento e histórico do cliente (spec orcamento-prazos-cliente-margem, R1/R4).
 * Leituras: prazos do Comercial e histórico de prazos do cliente (padrão = mais usado).
 */
import { api } from '@/lib/api'

export interface PrazoPagamento {
  id: string
  descricao: string
  dias: number
  parcelas: number
  status?: boolean
}

export interface LinhaHistoricoPrazo {
  prazoId: string | null
  descricao: string
  vezes: number
  ultimaVez: string
  origens: Array<'ORCAMENTO' | 'PEDIDO_PROPOSTA' | 'PORTAL'>
}

export interface HistoricoPrazosCliente {
  historico: LinhaHistoricoPrazo[]
  padrao: { prazoId: string | null; descricao: string } | null
  vendas?: Array<{ condicaoPagId: string | null; descricao: string; vezes: number; ultimaVez: string; tabelaPrecoId: string | null }>
  padraoVendas?: { condicaoPagId: string | null; descricao: string; tabelaPrecoId: string | null } | null
}

let cachePrazos: Promise<PrazoPagamento[]> | null = null

export function carregarPrazos(): Promise<PrazoPagamento[]> {
  if (!cachePrazos) {
    cachePrazos = api
      .get('/orcamento-grafico/pedidos-proposta/prazos-pagamento')
      .then(({ data }) => (Array.isArray(data) ? data : []) as PrazoPagamento[])
      .catch((e) => {
        cachePrazos = null
        throw e
      })
  }
  return cachePrazos
}

/** Só para testes. */
export function limparCachePrazos() {
  cachePrazos = null
}

export async function historicoPrazosDoCliente(clienteId: string): Promise<HistoricoPrazosCliente> {
  const { data } = await api.get(`/orcamento-grafico/clientes/${clienteId}/prazos`)
  return data as HistoricoPrazosCliente
}

/** Rótulo do prazo: "28/35/42 · 3x · 35 dias". */
export function rotuloPrazo(p: Pick<PrazoPagamento, 'descricao' | 'dias' | 'parcelas'>): string {
  const partes = [p.descricao]
  if (p.parcelas > 1) partes.push(`${p.parcelas}x`)
  if (p.dias > 0 && !/\bdias?\b/i.test(p.descricao)) partes.push(`${p.dias} dias`)
  return partes.join(' · ')
}

const ORIGEM: Record<LinhaHistoricoPrazo['origens'][number], string> = {
  ORCAMENTO: 'orçamento',
  PEDIDO_PROPOSTA: 'pedido/proposta',
  PORTAL: 'portal',
}

/** "3 vezes · último em 17/11/2026 · orçamento, portal". */
export function resumoUsoPrazo(l: LinhaHistoricoPrazo): string {
  const data = new Date(l.ultimaVez).toLocaleDateString('pt-BR')
  return `${l.vezes} ${l.vezes === 1 ? 'vez' : 'vezes'} · último em ${data} · ${l.origens.map((o) => ORIGEM[o]).join(', ')}`
}
