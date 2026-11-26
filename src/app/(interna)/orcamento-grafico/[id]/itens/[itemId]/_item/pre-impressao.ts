/**
 * Janela "Pré-Impressão" (botão Pré ao lado do Processo de Impressão), como no sistema de referência:
 * CTP, Fotolito, Contatos e Montagem. Os valores só são gravados no item/plano; não alteram o preço.
 * Puro: sem React nem rede.
 *
 * Códigos no sistema de referência (CalculoAtvImpressao): CTP -1/0; Fotolito -1 = Fornecido, 0 = Não
 * calcular; Contatos 0 = Não calcular; Montagem -1 = Mont.Contatos, 0 = Não calcular. "Em arquivo" e
 * "Calcular" existem na tela, mas nenhum cálculo migrado os usa.
 */

export type OpcaoFotolito = 'NAO_CALCULAR' | 'FORNECIDO' | 'EM_ARQUIVO'
export type OpcaoContatos = 'NAO_CALCULAR' | 'FORNECIDO' | 'EM_ARQUIVO' | 'CALCULAR'
export type OpcaoMontagem = 'NAO_CALCULAR' | 'MONT_CONTATOS'

export interface PreImpressao {
  ctp: boolean
  fotolito: OpcaoFotolito
  contatos: OpcaoContatos
  montagem: OpcaoMontagem
}

/** Padrão do cadastro de linhas de produto do sistema de referência (96% dos cálculos migrados). */
export const PRE_IMPRESSAO_PADRAO: PreImpressao = {
  ctp: true,
  fotolito: 'FORNECIDO',
  contatos: 'NAO_CALCULAR',
  montagem: 'MONT_CONTATOS',
}

export const OPCOES_FOTOLITO: ReadonlyArray<{ value: OpcaoFotolito; label: string }> = [
  { value: 'NAO_CALCULAR', label: 'Não calcular' },
  { value: 'FORNECIDO', label: 'Fornecido' },
  { value: 'EM_ARQUIVO', label: 'Em arquivo' },
]

export const OPCOES_CONTATOS: ReadonlyArray<{ value: OpcaoContatos; label: string }> = [
  { value: 'NAO_CALCULAR', label: 'Não calcular' },
  { value: 'FORNECIDO', label: 'Fornecido' },
  { value: 'EM_ARQUIVO', label: 'Em arquivo' },
  { value: 'CALCULAR', label: 'Calcular' },
]

export const OPCOES_MONTAGEM: ReadonlyArray<{ value: OpcaoMontagem; label: string }> = [
  { value: 'NAO_CALCULAR', label: 'Não calcular' },
  { value: 'MONT_CONTATOS', label: 'Mont.Contatos' },
]

const valores = <T extends string>(opcoes: ReadonlyArray<{ value: T }>) => opcoes.map((o) => o.value)

function escolha<T extends string>(v: unknown, validos: readonly T[], padrao: T): T {
  return typeof v === 'string' && (validos as readonly string[]).includes(v) ? (v as T) : padrao
}

/**
 * Valor gravado → valor da janela. Ausente/inválido devolve null (nada gravado); campo solto ou fora
 * da lista cai no padrão daquele campo.
 */
export function lerPreImpressao(bruto: unknown): PreImpressao | null {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null
  const o = bruto as Record<string, unknown>
  if (!('ctp' in o) && !('fotolito' in o) && !('contatos' in o) && !('montagem' in o)) return null
  return {
    ctp: typeof o.ctp === 'boolean' ? o.ctp : PRE_IMPRESSAO_PADRAO.ctp,
    fotolito: escolha(o.fotolito, valores(OPCOES_FOTOLITO), PRE_IMPRESSAO_PADRAO.fotolito),
    contatos: escolha(o.contatos, valores(OPCOES_CONTATOS), PRE_IMPRESSAO_PADRAO.contatos),
    montagem: escolha(o.montagem, valores(OPCOES_MONTAGEM), PRE_IMPRESSAO_PADRAO.montagem),
  }
}

export function preImpressaoIgual(a: PreImpressao | null | undefined, b: PreImpressao | null | undefined): boolean {
  if (!a || !b) return !a && !b
  return a.ctp === b.ctp && a.fotolito === b.fotolito && a.contatos === b.contatos && a.montagem === b.montagem
}

const rotulo = <T extends string>(opcoes: ReadonlyArray<{ value: T; label: string }>, v: T) =>
  opcoes.find((o) => o.value === v)?.label ?? v

/** "CTP · Fotolito: Fornecido · Contatos: Não calcular · Montagem: Mont.Contatos". */
export function resumoPreImpressao(p: PreImpressao | null | undefined): string {
  if (!p) return 'Não definida'
  return [
    p.ctp ? 'CTP' : 'Sem CTP',
    `Fotolito: ${rotulo(OPCOES_FOTOLITO, p.fotolito)}`,
    `Contatos: ${rotulo(OPCOES_CONTATOS, p.contatos)}`,
    `Montagem: ${rotulo(OPCOES_MONTAGEM, p.montagem)}`,
  ].join(' · ')
}
