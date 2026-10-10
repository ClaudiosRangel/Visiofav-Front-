/**
 * Helper compartilhado pela Task 4 (spec orcamento-grafico-op-relatorio-paridade).
 *
 * Monta a fatia do payload referente aos "Dados Técnicos" do item — campos de
 * paridade (Req 1/3), geometria/formatos (Req 2) e acondicionamento (Req 3) —
 * a partir do WizardFormData. Enviamos APENAS os campos efetivamente
 * preenchidos: strings vazias viram `undefined` (omitidas), números não
 * informados (`null`) são omitidos, e `acondicionamento` só é enviado quando há
 * ao menos uma linha com descrição. Usado tanto pelo wizard `/novo` quanto pelo
 * editor de item `[id]/ItemWizardModal`.
 */

import type { WizardFormData } from './page'

/** Normaliza string: `undefined` quando vazia/apenas espaços. */
function str(v?: string): string | undefined {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : undefined
}

/** Normaliza número: `undefined` quando `null`/`undefined`/`NaN`. */
function num(v?: number | null): number | undefined {
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined
}

export function montarPayloadDadosTecnicos(formData: WizardFormData): Record<string, unknown> {
  const acond = (formData.acondicionamento ?? [])
    .map((a) => ({ descricao: (a?.descricao ?? '').trim() }))
    .filter((a) => a.descricao.length > 0)

  return {
    // Paridade (Req 1 / 3)
    siglaAcabado: str(formData.siglaAcabado),
    tributacao: str(formData.tributacao),
    processoImpressao: str(formData.processoImpressao),
    coberturaTintaTexto: str(formData.coberturaTintaTexto),
    fabricante: str(formData.fabricante),
    microondulado: formData.microondulado || undefined,
    fornecido: formData.fornecido || undefined,
    qtdModelos: num(formData.qtdModelos),
    arte: str(formData.arte),
    observacao: str(formData.observacao),
    observacaoAreasOp: str(formData.observacaoAreasOp),
    conteudoVolume: num(formData.conteudoVolume),
    acondicionamento: acond.length > 0 ? acond : undefined,
    // Geometria / formatos (Req 2)
    comprimentoMm: num(formData.comprimentoMm),
    larguraMm: num(formData.larguraMm),
    alturaMm: num(formData.alturaMm),
    abaColaMm: num(formData.abaColaMm),
    abaFechamentoMm: num(formData.abaFechamentoMm),
    fibra: formData.fibra || undefined,
    montagemLinhas: num(formData.montagemLinhas),
    montagemColunas: num(formData.montagemColunas),
    formatoSupLarguraMm: num(formData.formatoSupLarguraMm),
    formatoSupAlturaMm: num(formData.formatoSupAlturaMm),
    formatoCorteLarguraMm: num(formData.formatoCorteLarguraMm),
    formatoCorteAlturaMm: num(formData.formatoCorteAlturaMm),
    ajusteCorteMicroMm: num(formData.ajusteCorteMicroMm),
  }
}
