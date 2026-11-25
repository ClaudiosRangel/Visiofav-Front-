/**
 * Cadastros de apoio da janela "Tintas", carregados uma vez por sessão da tela:
 * - tintas (preço de matéria-prima do tipo TINTA, todas as páginas);
 * - coberturas de tinta ativas com a composição padrão (`tintasPadrao`).
 * `tintasDaCoberturaPorNome` junta os dois e devolve as tintas da cobertura para as cores do plano.
 */

import { api } from '@/lib/api'

import { tintasDaCobertura, type CorGravada, type TintaCadastro, type TintasPadrao } from './tintas-item'

export interface CoberturaComTintas {
  id: string
  nome: string
  tintasPadrao: TintasPadrao | null
}

let cacheTintas: Promise<TintaCadastro[]> | null = null
let cacheCoberturas: Promise<CoberturaComTintas[]> | null = null

export function carregarTintas(): Promise<TintaCadastro[]> {
  if (!cacheTintas) {
    cacheTintas = (async () => {
      const saida: TintaCadastro[] = []
      for (let page = 1; page <= 20; page++) {
        const { data } = await api.get('/orcamento-grafico/precos-mp', { params: { tipo: 'TINTA', limit: 100, page } })
        const lista: Array<{ id: string; descricao: string; precoUnitario: unknown }> = data?.data ?? []
        saida.push(...lista.map((t) => ({ id: t.id, nome: t.descricao, precoKg: Number(t.precoUnitario) || 0 })))
        if (page >= (data?.totalPages ?? 1)) break
      }
      return saida
    })().catch((err) => {
      cacheTintas = null
      throw err
    })
  }
  return cacheTintas
}

export function carregarCoberturas(): Promise<CoberturaComTintas[]> {
  if (!cacheCoberturas) {
    cacheCoberturas = (async () => {
      const { data } = await api.get('/orcamento-grafico/coberturas-tinta', { params: { situacao: 'ativa' } })
      const lista: Array<{ id: string; nome: string; tintasPadrao?: TintasPadrao | null }> = Array.isArray(data)
        ? data
        : (data?.data ?? [])
      return lista.map((c) => ({ id: c.id, nome: c.nome, tintasPadrao: c.tintasPadrao ?? null }))
    })().catch((err) => {
      cacheCoberturas = null
      throw err
    })
  }
  return cacheCoberturas
}

/** Só para testes: esquece o que foi carregado. */
export function limparCacheTintas() {
  cacheTintas = null
  cacheCoberturas = null
}

const normal = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

/** Tintas padrão da cobertura (pelo nome) para as cores "NxM". Sem composição → lista vazia. */
export async function tintasDaCoberturaPorNome(nome: string, cores: string): Promise<CorGravada[]> {
  if (!nome.trim()) return []
  const coberturas = await carregarCoberturas()
  const cob = coberturas.find((c) => normal(c.nome) === normal(nome))
  if (!cob?.tintasPadrao) return []
  const tintas = await carregarTintas().catch(() => [] as TintaCadastro[])
  return tintasDaCobertura(cob.tintasPadrao, cores, tintas)
}
