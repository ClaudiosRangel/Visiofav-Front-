/**
 * Resolução de binding + formatação (porta TS pura — espelho do backend).
 * Spec comercial-editor-visual-templates. MESMA especificação de
 * src/modules/orcamento-grafico/template-visual/binding-resolver.service.ts.
 */

export interface ContextoGeracao {
  cliente: { nome?: string | null; cnpj?: string | null; contato?: string | null; email?: string | null }
  empresa: { razaoSocial?: string | null; cnpj?: string | null; telefone?: string | null; email?: string | null }
  orcamento: {
    numero?: number | null
    versao?: number | null
    precoVenda?: number | null
    precoUnitario?: number | null
    quantidade?: number | null
    validadeAte?: Date | string | null
    criadoEm?: Date | string | null
    descricao?: string | null
    vendedorNome?: string | null
    [k: string]: unknown
  }
  itens: Array<{ descricao: string; quantidade: number; precoUnitario: number; precoTotal: number }>
  variacoes: Array<{ quantidade: number; precoUnitario: number; precoTotal: number }>
}

export interface ResultadoBinding {
  texto?: string
  vazio?: boolean
  aviso?: string
}

const CAMINHOS_MONETARIOS = new Set<string>(['orcamento.precoVenda', 'orcamento.precoUnitario'])

export function formatarMoeda(valor: number): string {
  const n = Number.isFinite(valor) ? valor : 0
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarData(data: Date | string): string {
  const d = data instanceof Date ? data : new Date(data)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function limparCaminho(bindingBruto: string): string {
  return bindingBruto.replace(/^\s*\{\{\s*/, '').replace(/\s*\}\}\s*$/, '').trim()
}

function navegar(ctx: ContextoGeracao, caminho: string): unknown {
  const partes = caminho.split('.')
  let atual: unknown = ctx
  for (const p of partes) {
    if (atual == null || typeof atual !== 'object') return undefined
    atual = (atual as Record<string, unknown>)[p]
  }
  return atual
}

export function resolverBinding(bindingBruto: string, ctx: ContextoGeracao): ResultadoBinding {
  try {
    const caminho = limparCaminho(String(bindingBruto ?? ''))
    if (!caminho) return { vazio: true, aviso: 'Binding vazio' }
    const valor = navegar(ctx, caminho)
    if (valor === undefined || valor === null || valor === '') {
      return { vazio: true, aviso: `Binding não encontrado: ${caminho}` }
    }
    if (CAMINHOS_MONETARIOS.has(caminho)) return { texto: formatarMoeda(Number(valor)) }
    if (valor instanceof Date) return { texto: formatarData(valor) }
    // Datas que chegam como string ISO em orcamento.criadoEm/validadeAte.
    if ((caminho === 'orcamento.criadoEm' || caminho === 'orcamento.validadeAte') && typeof valor === 'string') {
      return { texto: formatarData(valor) }
    }
    return { texto: String(valor) }
  } catch {
    return { vazio: true, aviso: 'Binding inválido' }
  }
}

export type LinhaTabela = string[]

export function resolverTabela(
  fonteDados: 'itens' | 'variacoes',
  bindings: string[],
  ctx: ContextoGeracao,
): LinhaTabela[] {
  const linhas = fonteDados === 'itens' ? ctx.itens : ctx.variacoes
  if (!Array.isArray(linhas)) return []
  return linhas.map((linha) =>
    bindings.map((b) => {
      const chave = limparCaminho(b)
      const v = (linha as Record<string, unknown>)[chave]
      if (v === undefined || v === null) return ''
      if (chave === 'precoUnitario' || chave === 'precoTotal') return formatarMoeda(Number(v))
      if (chave === 'quantidade') return Number(v).toLocaleString('pt-BR')
      return String(v)
    }),
  )
}
