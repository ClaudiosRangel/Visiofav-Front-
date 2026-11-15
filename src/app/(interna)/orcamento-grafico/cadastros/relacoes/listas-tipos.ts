import { api } from '@/lib/api'
import { itensDiversosApi, produtosApi, tiposPlanoApi } from '../_shared/cadastros-graficos.api'

/** Item genérico para os seletores de origem/destino. */
export interface OpcaoCadastro {
  id: string
  nome: string
}

/**
 * Pares origem → destino permitidos. Réplica de PARES_PERMITIDOS do back
 * (src/modules/orcamento-grafico/cadastros-graficos/relacoes-permitidas.ts).
 * O back continua sendo a fonte de verdade (devolve 400 para par inválido).
 */
export const PARES_PERMITIDOS: ReadonlyArray<{ origem: string; destino: string }> = [
  { origem: 'PRODUTO', destino: 'PLANO' },
  { origem: 'PRODUTO', destino: 'ATIVIDADE' },
  { origem: 'PRODUTO', destino: 'ACONDICIONAMENTO' },
  { origem: 'PRODUTO', destino: 'ITEM_DIVERSO' },
  { origem: 'PLANO', destino: 'ATIVIDADE' },
  { origem: 'PLANO', destino: 'COBERTURA_TINTA' },
  { origem: 'PLANO', destino: 'ITEM_DIVERSO' },
  { origem: 'PLANO', destino: 'SUPORTE' },
  { origem: 'ATIVIDADE', destino: 'MATERIAL' },
  { origem: 'ATIVIDADE', destino: 'CENTRO' },
  { origem: 'ATIVIDADE', destino: 'LINHA' },
  { origem: 'ATIVIDADE', destino: 'TINTA' },
  { origem: 'MATRIZ', destino: 'ATIVIDADE' },
  { origem: 'MATRIZ', destino: 'CENTRO' },
  { origem: 'SUPORTE', destino: 'ATIVIDADE' },
  { origem: 'ITEM_DIVERSO', destino: 'ATIVIDADE' },
]

export const ROTULO_TIPO: Record<string, string> = {
  PRODUTO: 'Produto',
  PLANO: 'Tipo de plano',
  ATIVIDADE: 'Atividade (acabamento)',
  ACONDICIONAMENTO: 'Acondicionamento',
  MATERIAL: 'Material de acabamento',
  SUPORTE: 'Suporte',
  CENTRO: 'Centro de produção',
  LINHA: 'Linha de produto',
  COBERTURA_TINTA: 'Cobertura de tinta',
  ITEM_DIVERSO: 'Item diverso',
  TINTA: 'Tinta',
  MATRIZ: 'Matriz',
}

export const rotuloTipo = (t: string) => ROTULO_TIPO[t] ?? t

type Linha = Record<string, unknown>

const txt = (v: unknown) => (v == null ? '' : String(v))
const juntar = (cod: unknown, nome: unknown) => [txt(cod), txt(nome)].filter(Boolean).join(' — ')

/** Lê todas as páginas de uma listagem `{ data, total }` (ou array simples). */
async function listarPaginado(url: string, params: Record<string, unknown> = {}): Promise<Linha[]> {
  const limit = 100
  const acc: Linha[] = []
  for (let page = 1; page <= 50; page++) {
    const { data } = await api.get(url, { params: { ...params, page, limit } })
    const lote: Linha[] = Array.isArray(data) ? data : (data?.data ?? data?.itens ?? [])
    acc.push(...lote)
    const total = Array.isArray(data) ? undefined : data?.total
    if (total == null || acc.length >= total || lote.length < limit) break
  }
  return acc
}

function mapear(linhas: Linha[], rotular: (l: Linha) => string): OpcaoCadastro[] {
  return linhas
    .map((l) => ({ id: txt(l.id), nome: rotular(l) }))
    .filter((o) => o.id)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Lista os itens ativos de cada tipo de cadastro (usa as rotas já existentes). */
export async function listarItensDoTipo(tipo: string): Promise<OpcaoCadastro[]> {
  switch (tipo) {
    case 'PRODUTO':
      return mapear(await produtosApi.listar({ situacao: 'ativo' }) as unknown as Linha[], (l) => juntar(l.codigo, l.nome))
    case 'PLANO':
      return mapear(await tiposPlanoApi.listar({ situacao: 'ativo' }) as unknown as Linha[], (l) => juntar(l.codigo, l.nome))
    case 'ITEM_DIVERSO': {
      const acc: Linha[] = []
      for (let pagina = 1; pagina <= 50; pagina++) {
        const r = await itensDiversosApi.listar({ pagina, limite: 100, status: 'ativo' })
        acc.push(...(r.itens as unknown as Linha[]))
        if (acc.length >= r.total || r.itens.length === 0) break
      }
      return mapear(acc, (l) => txt(l.nome))
    }
    case 'ATIVIDADE':
      return mapear(await listarPaginado('/orcamento-grafico/acabamentos'), (l) => juntar(l.codigo, l.nome))
    case 'ACONDICIONAMENTO': {
      const todos = await listarPaginado('/orcamento-grafico/acabamentos')
      const so = todos.filter((l) => l.acondicionamento === true)
      return mapear(so.length > 0 ? so : todos, (l) => juntar(l.codigo, l.nome))
    }
    case 'MATERIAL':
      return mapear(await listarPaginado('/orcamento-grafico/materiais-acabamento', { situacao: 'ativa' }), (l) => juntar(l.codigo, l.nome))
    case 'SUPORTE':
      return mapear(await listarPaginado('/orcamento-grafico/suportes'), (l) => juntar(l.codigo, l.descricao))
    case 'CENTRO':
      return mapear(await listarPaginado('/centros-producao', { status: 'true' }), (l) => juntar(l.codigo, l.descricao ?? l.nome))
    case 'LINHA':
      return mapear(await listarPaginado('/orcamento-grafico/linhas-produto', { situacao: 'ativa' }), (l) => juntar(l.codigo, l.nome))
    case 'COBERTURA_TINTA':
      return mapear(await listarPaginado('/orcamento-grafico/coberturas-tinta', { situacao: 'ativa' }), (l) => juntar(l.codigo, l.nome))
    case 'TINTA':
      return mapear(await listarPaginado('/orcamento-grafico/precos-mp', { tipo: 'TINTA' }), (l) => txt(l.descricao))
    case 'MATRIZ':
      return mapear(await listarPaginado('/orcamento-grafico/precos-mp'), (l) => txt(l.descricao))
    default:
      return []
  }
}
