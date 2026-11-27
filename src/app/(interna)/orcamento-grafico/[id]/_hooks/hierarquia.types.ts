/**
 * Tipos das respostas das rotas de leitura da hierarquia Orçamento → Item → Plano
 * (prefixo /api/orcamento-grafico). Espelham os DTOs do back; nenhum campo é derivado no front.
 */

export interface ItemResumoOp {
  id: string
  numero: number
}

export interface ItemResumoDTO {
  id: string
  sequencia: number
  calculo: number | null
  linhaProduto: string | null
  tipoProduto: string | null
  tiragens: number[]
  descricao: string | null
  /** "Pendente" | "Liberado" | "Sem cálculo" */
  status: string
  op: ItemResumoOp | null
  /** Pedido de venda gerado do orçamento ("Ped: N"). Ausente em respostas antigas. */
  pedido?: { id: string; numero: number } | null
  temCalculo: boolean
}

export interface ItensResumoResposta {
  itens: ItemResumoDTO[]
}

export interface SecaoDadosItem {
  chave: string
  titulo: string
  /** Vazio ⇒ a tela mostra "Sem informação cadastrada." */
  linhas: string[]
}

export interface DadosItemDTO {
  itemId: string
  estrutura: 'PLANO_UNICO' | 'MULTI_PLANO'
  planosPersistidos: number
  secoes: SecaoDadosItem[]
}

export interface FechamentoLinhaDTO {
  tiragem: number
  margemPerc: number | null
  contribuicaoMarginalPerc: number | null
  valorUnitario: number
  valorTotal: number
  custoProducao: number
  itens: number
}

export interface ItemSemCalculoDTO {
  id: string
  sequencia: number
  descricao: string | null
}

export interface FechamentoTotalizadorDTO {
  orcamentoId: string
  linhas: FechamentoLinhaDTO[]
  itensSemCalculo: ItemSemCalculoDTO[]
  quantidadeSemCalculo: number
  /** Margem mínima entre custo e preço (%), configurada no orçamento. */
  margemMinima?: number | null
}

export interface ComissaoLinhaDTO {
  origem: 'VENDEDOR' | string
  descricao: string
  percentual: number
  base: number
  valor: number
}

export interface ComissoesDTO {
  linhas: ComissaoLinhaDTO[]
}

export type OrigemFichaMaster = 'PRODUTO' | 'RASCUNHO' | 'ORCAMENTO' | 'VAZIO'

/** Resposta de GET /:id/ficha-master (rota existente). */
export interface FichaMasterDTO {
  origem: OrigemFichaMaster
  imagemFaca: string | null
  arte: string | null
  /** Caminho relativo da API para a arte servida como binário (anexo do pedido). */
  arteUrl?: string | null
  cartao: string | null
  gramatura: string | null
  numCores: number | null
  coresDescricao: string | null
  acabamentos: string | null
  matriz: string | null
}
