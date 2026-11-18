/**
 * Cores do Gantt por Linha de Produto (pedido do cliente: cada linha com a sua
 * cor para o PCP bater o olho e entender). A linha vem do backend
 * (`op.linhaProduto`, derivada do campo "Produto:" do PDF). Prioridade da cor
 * da barra: cor personalizada da OP > cor da linha > cor padrão.
 */

export type LinhaProdutoFront = { codigo: string; rotulo: string }

const CORES_LINHA: Record<string, string> = {
  CARTUCHO: '#2F9E44', // verde
  CARTUCHO_COMPOSTO: '#1C7ED6', // azul
  LAMINA_SIMPLES: '#F08C00', // âmbar
  LAMINAS: '#E8590C', // laranja
  SACOLA: '#AE3EC9', // roxo
}

// Linhas novas/desconhecidas (ex.: Caixa, Cartelas) recebem uma cor estável
// escolhida por hash do código — a mesma linha tem sempre a mesma cor.
const PALETA_EXTRA = ['#0CA678', '#D6336C', '#1098AD', '#5C7CFA', '#74B816', '#C2255C', '#7048E8', '#E67700']

export const COR_SEM_LINHA = '#868E96'

export function corDaLinha(codigo: string | null | undefined): string {
  if (!codigo) return COR_SEM_LINHA
  const fixa = CORES_LINHA[codigo]
  if (fixa) return fixa
  let h = 0
  for (let i = 0; i < codigo.length; i++) h = (h * 31 + codigo.charCodeAt(i)) >>> 0
  return PALETA_EXTRA[h % PALETA_EXTRA.length]
}
