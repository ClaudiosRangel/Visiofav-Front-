/**
 * Composição padrão de uma Cobertura de Tinta ↔ linhas do formulário do cadastro. Puro.
 * Linha totalmente vazia é ignorada; linha com só um dos campos é erro.
 */

import type { TintasPadrao } from '../../[id]/itens/[itemId]/_item/tintas-item'

export interface LinhaTintaPadrao {
  tinta: string
  perc: number | ''
}

export function tintasPadraoParaLinhas(t: TintasPadrao | null | undefined): { umaCor: LinhaTintaPadrao; cores: LinhaTintaPadrao[] } {
  return {
    umaCor: t?.umaCor ? { tinta: t.umaCor.tinta, perc: Number(t.umaCor.perc) } : { tinta: '', perc: '' },
    cores: (t?.cores ?? []).map((c) => ({ tinta: c.tinta, perc: Number(c.perc) })),
  }
}

type Resultado = { ok: true; valor: TintasPadrao | null } | { ok: false; erro: string }

function linha(l: LinhaTintaPadrao, rotulo: string): { ok: true; valor: { tinta: string; perc: number } | null } | { ok: false; erro: string } {
  const tinta = l.tinta.trim()
  const vazio = !tinta && l.perc === ''
  if (vazio) return { ok: true, valor: null }
  if (!tinta) return { ok: false, erro: `${rotulo}: escolha a tinta.` }
  const perc = l.perc === '' ? NaN : Number(l.perc)
  if (!(perc > 0 && perc <= 100)) return { ok: false, erro: `${rotulo}: informe de 0,01 a 100%.` }
  return { ok: true, valor: { tinta, perc: Math.round(perc * 100) / 100 } }
}

/** Formulário → composição a gravar (null quando não há nenhuma tinta). */
export function linhasParaTintasPadrao(umaCor: LinhaTintaPadrao, cores: LinhaTintaPadrao[]): Resultado {
  const u = linha(umaCor, 'Tinta para 1 cor')
  if (!u.ok) return u
  const seq: { tinta: string; perc: number }[] = []
  for (let i = 0; i < cores.length; i++) {
    const r = linha(cores[i], `${i + 1}ª cor`)
    if (!r.ok) return r
    if (r.valor) seq.push(r.valor)
  }
  if (seq.length > 12) return { ok: false, erro: 'No máximo 12 cores na sequência.' }
  if (!u.valor && seq.length === 0) return { ok: true, valor: null }
  return { ok: true, valor: { umaCor: u.valor, cores: seq } }
}

const pct = (n: number) => `${String(n).replace('.', ',')}%`

/** Resumo para a lista: "1 cor: Escala 20% · 4× Escala 10%, 4× Especiais 10%". */
export function resumoTintasPadrao(t: TintasPadrao | null | undefined): string {
  if (!t || (!t.umaCor && !(t.cores ?? []).length)) return '—'
  const partes: string[] = []
  if (t.umaCor) partes.push(`1 cor: ${t.umaCor.tinta} ${pct(t.umaCor.perc)}`)
  const grupos: { chave: string; n: number }[] = []
  for (const c of t.cores ?? []) {
    const chave = `${c.tinta} ${pct(c.perc)}`
    const ultimo = grupos.at(-1)
    if (ultimo && ultimo.chave === chave) ultimo.n++
    else grupos.push({ chave, n: 1 })
  }
  if (grupos.length) partes.push(grupos.map((g) => (g.n > 1 ? `${g.n}× ${g.chave}` : g.chave)).join(', '))
  return partes.join(' · ')
}
