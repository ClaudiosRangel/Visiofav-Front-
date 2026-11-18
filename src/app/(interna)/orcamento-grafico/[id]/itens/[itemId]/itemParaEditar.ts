/**
 * Converte o item do `GET /:id` → `itens[]` no shape `ItemParaEditar` (o mesmo que o `EditorItem`
 * usa), mais os campos informativos da hierarquia. É o mesmo mapeamento que a página do orçamento
 * fazia ao abrir o editor em modal; a Tela_Item hidrata o formulário por aqui para enviar o mesmo
 * payload de engenharia do `EditorItem`.
 */

import type { ItemParaEditar } from '../../itemFormShared'

/**
 * Campos informativos da hierarquia Item/Plano (aditivos, fora do motor de cálculo).
 * Chegam do back em `GET /:id` como Decimal (string) ou number; ficam como vieram e
 * são convertidos pelos helpers de `_item/formato-item.ts`.
 */
export interface CamposHierarquiaItem {
  formatoFechadoLarguraMm?: number | string | null
  formatoFechadoAlturaMm?: number | string | null
  formatoAbertoLarguraMm?: number | string | null
  formatoAbertoAlturaMm?: number | string | null
  formatoFinalLarguraMm?: number | string | null
  formatoFinalAlturaMm?: number | string | null
  alturaTampaMm?: number | string | null
  numeroSanfonas?: number | string | null
  numeroPaginas?: number | string | null
  /** Descrição do item (coluna própria; o `EditorItem` não a usa). */
  descricao?: string | null
}

export type ItemParaEditarHierarquia = ItemParaEditar & CamposHierarquiaItem

export function itemParaEditar(
  item: Record<string, any>,
  tipoEmbalagem: { codigo: string; descricao: string } | null | undefined,
): ItemParaEditarHierarquia {
  return {
    // Campos novos da hierarquia (aditivos). Ausentes viram null.
    formatoFechadoLarguraMm: item.formatoFechadoLarguraMm ?? null,
    formatoFechadoAlturaMm: item.formatoFechadoAlturaMm ?? null,
    formatoAbertoLarguraMm: item.formatoAbertoLarguraMm ?? null,
    formatoAbertoAlturaMm: item.formatoAbertoAlturaMm ?? null,
    formatoFinalLarguraMm: item.formatoFinalLarguraMm ?? null,
    formatoFinalAlturaMm: item.formatoFinalAlturaMm ?? null,
    alturaTampaMm: item.alturaTampaMm ?? null,
    numeroSanfonas: item.numeroSanfonas ?? null,
    numeroPaginas: item.numeroPaginas ?? null,
    descricao: item.descricao ?? null,
    id: item.id,
    tipoEmbalagemId: item.tipoEmbalagemId,
    tipoEmbalagem: tipoEmbalagem ?? null,
    medidas: item.medidas ?? null,
    papelId: item.papelId ?? null,
    papelDescricao: item.papelDescricao ?? null,
    suporteId: item.suporteId ?? null,
    gramatura: item.gramatura ?? null,
    numCores: item.numCores,
    cores: item.cores ?? null,
    acabamentosRicos: item.acabamentosRicos ?? null,
    maquinaId: item.maquinaId ?? null,
    modeloFacaId: item.modeloFacaId ?? null,
    aproveitamentoManual: item.aproveitamentoManual ?? null,
    tintaModo: item.tintaModo ?? null,
    tintaConsumoKg: item.tintaConsumoKg ?? null,
    // Campos técnicos: null permanece null (o `itemParaForm` normaliza).
    siglaAcabado: item.siglaAcabado ?? null,
    tributacao: item.tributacao ?? null,
    processoImpressao: item.processoImpressao ?? null,
    coberturaTintaTexto: item.coberturaTintaTexto ?? null,
    fabricante: item.fabricante ?? null,
    microondulado: item.microondulado ?? null,
    materialMicroonduladoId: item.materialMicroonduladoId ?? null,
    suporteProducaoId: item.suporteProducaoId ?? null,
    fornecido: item.fornecido ?? null,
    qtdModelos: item.qtdModelos ?? null,
    arte: item.arte ?? null,
    observacao: item.observacao ?? null,
    observacaoAreasOp: item.observacaoAreasOp ?? null,
    conteudoVolume: item.conteudoVolume ?? null,
    acondicionamento: Array.isArray(item.acondicionamento) ? item.acondicionamento : null,
    comprimentoMm: item.comprimentoMm ?? null,
    larguraMm: item.larguraMm ?? null,
    alturaMm: item.alturaMm ?? null,
    abaColaMm: item.abaColaMm ?? null,
    abaFechamentoMm: item.abaFechamentoMm ?? null,
    fibra: item.fibra ?? null,
    montagemLinhas: item.montagemLinhas ?? null,
    montagemColunas: item.montagemColunas ?? null,
    formatoSupLarguraMm: item.formatoSupLarguraMm ?? null,
    formatoSupAlturaMm: item.formatoSupAlturaMm ?? null,
    formatoCorteLarguraMm: item.formatoCorteLarguraMm ?? null,
    formatoCorteAlturaMm: item.formatoCorteAlturaMm ?? null,
    ajusteCorteMicroMm: item.ajusteCorteMicroMm ?? null,
    matrizQuantidade: item.matrizQuantidade ?? null,
    matrizPrecoUnitario: item.matrizPrecoUnitario ?? null,
    itensDiversos: item.itensDiversos ?? null,
    itensFornecidos: item.itensFornecidos ?? null,
    camposLivres: item.camposLivres ?? null,
    quantidade: item.quantidade,
    resultadoCalculo: item.resultadoCalculo ?? null,
    calculoGraficoOrigemId: item.calculoGraficoOrigemId ?? null,
    // Vínculo com o catálogo e seleções de material.
    produtoGraficoId: item.produtoGraficoId ?? null,
    materiaisAcabamento: Array.isArray(item.materiaisAcabamento) ? item.materiaisAcabamento : null,
    // `tipoPlanoId` de cada plano segue junto.
    planos: Array.isArray(item.planos)
      ? item.planos.map((p: Record<string, any>) => ({ ...p, tipoPlanoId: p.tipoPlanoId ?? null }))
      : null,
  } as ItemParaEditarHierarquia
}
