/**
 * itemFormShared — lógica compartilhada de edição de UM item de orçamento gráfico.
 *
 * Este módulo centraliza, SEM alterar comportamento, as peças que antes viviam
 * dentro do `ItemWizardModal`:
 *   - `INITIAL_ITEM`      → estado inicial do form (espelha o `/novo`, sem cliente).
 *   - `ItemParaEditar`    → shape de um item carregado da API (GET /:id → itens[]).
 *   - `itemParaForm`      → hidrata o `WizardFormData` a partir do item.
 *   - `montarPayloadItem` → monta o payload de salvar (POST/PUT) do item.
 *   - `salvarItem`        → chama a API (POST novo / PUT edição) com o payload.
 *
 * Objetivo: permitir que o `ItemWizardModal` (wizard de steps, mantido como
 * fallback) e o novo `EditorItem` (página única com âncoras — experiência
 * Calcgraf) compartilhem EXATAMENTE a mesma lógica de hidratar/montar payload/
 * salvar, sem duplicar nem divergir a regra de salvar/calcular.
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Tarefa 4.3)
 * _Requirements: 1.1, 1.5_
 */

import { api } from '@/lib/api'

import type { WizardFormData, CorItem, AcabamentoItem, MaterialAcabamentoItem } from '../novo/page'
import { extrairTiragensDasObservacoes } from '../novo/page'
import { montarPayloadDadosTecnicos } from '../novo/dadosTecnicosPayload'

// ============================================================================
// Estado inicial do item (espelha o INITIAL_FORM do wizard, sem campos de
// cliente, que são do cabeçalho do orçamento).
// ============================================================================

export const INITIAL_ITEM: WizardFormData = {
  clienteId: null,
  clienteNome: '',
  vendedorId: null,
  produtoId: null,
  produtoNome: '',
  tipoEmbalagemId: null,
  tipoEmbalagem: null,
  medidas: {},
  suporteId: null,
  suporteNome: '',
  papelId: null,
  papelDescricao: '',
  gramatura: 0,
  precoKg: 0,
  cores: [
    { nome: 'Ciano', tipo: 'CMYK', coberturaPercent: 30, precoKg: 45, rendimentoM2Kg: 15000 },
    { nome: 'Magenta', tipo: 'CMYK', coberturaPercent: 30, precoKg: 45, rendimentoM2Kg: 15000 },
    { nome: 'Amarelo', tipo: 'CMYK', coberturaPercent: 30, precoKg: 40, rendimentoM2Kg: 15000 },
    { nome: 'Preto', tipo: 'CMYK', coberturaPercent: 40, precoKg: 35, rendimentoM2Kg: 18000 },
  ],
  acabamentos: [
    { tipo: 'CORTE_VINCO', label: 'Corte e Vinco', ativo: true, custoHora: 180, velocidade: 4000, custoMaterialM2: 0 },
    { tipo: 'COLAGEM', label: 'Colagem', ativo: true, custoHora: 150, velocidade: 8000, custoMaterialM2: 0 },
    { tipo: 'VERNIZ_UV', label: 'Verniz UV', ativo: false, custoHora: 200, velocidade: 5000, custoMaterialM2: 0.12 },
    { tipo: 'LAMINACAO_BOPP', label: 'Laminação BOPP', ativo: false, custoHora: 220, velocidade: 3000, custoMaterialM2: 0.18 },
    { tipo: 'HOT_STAMPING', label: 'Hot Stamping', ativo: false, custoHora: 250, velocidade: 2000, custoMaterialM2: 0.25 },
  ],
  acabamentosRicos: [],
  materiaisAcabamento: [],
  quantidade: 10000,
  tabelaMargemId: null,
  maquinaId: null,
  aproveitamentoManual: null,
  modeloFacaId: null,
  matrizQuantidade: null,
  matrizPrecoUnitario: null,
  tintaModo: 'COBERTURA',
  tintaConsumoKg: null,
  tintaPrecoKg: null,
  itensDiversos: [],
  itensFornecidos: [],
  camposLivres: [],
  // Task 4 — Dados Técnicos (paridade / geometria / acondicionamento)
  siglaAcabado: '',
  tributacao: '',
  processoImpressao: '',
  coberturaTintaTexto: '',
  fabricante: '',
  microondulado: false,
  materialMicroonduladoId: null,
  fornecido: false,
  qtdModelos: null,
  arte: '',
  observacao: '',
  observacaoAreasOp: '',
  conteudoVolume: null,
  acondicionamento: [],
  comprimentoMm: null,
  larguraMm: null,
  alturaMm: null,
  abaColaMm: null,
  abaFechamentoMm: null,
  fibra: false,
  montagemLinhas: null,
  montagemColunas: null,
  formatoSupLarguraMm: null,
  formatoSupAlturaMm: null,
  formatoCorteLarguraMm: null,
  formatoCorteAlturaMm: null,
  ajusteCorteMicroMm: null,
}

// ============================================================================
// Shape de um item carregado da API (GET /:id → itens[]).
// ============================================================================

export interface ItemParaEditar {
  id: string
  tipoEmbalagemId: string
  tipoEmbalagem?: any | null
  medidas?: Record<string, number> | null
  papelId?: string | null
  papelDescricao?: string | null
  suporteId?: string | null
  gramatura?: number | string | null
  numCores?: number
  cores?: any[] | null
  acabamentosRicos?: any[] | null
  // R6 — materiais de acabamento computados no custo
  materiaisAcabamento?: Array<{
    materialAcabamentoId?: string | null
    nome?: string | null
    computarCusto?: boolean | null
    valorUnitario?: number | string | null
    quantidade?: number | string | null
  }> | null
  maquinaId?: string | null
  aproveitamentoManual?: number | null
  modeloFacaId?: string | null
  // Fase 4 — matriz / tinta / itens complementares
  matrizQuantidade?: number | string | null
  matrizPrecoUnitario?: number | string | null
  tintaModo?: 'COBERTURA' | 'CONSUMO_DIRETO' | null
  tintaConsumoKg?: number | string | null
  itensDiversos?: Array<{ descricao: string; quantidade: number; valor: number; fixo: boolean }> | null
  itensFornecidos?: Array<{ descricao: string; quantidade: number }> | null
  camposLivres?: Array<{ rotulo: string; conteudo: string }> | null
  // Task 4 — Dados Técnicos (paridade / geometria / acondicionamento)
  siglaAcabado?: string | null
  tributacao?: string | null
  processoImpressao?: string | null
  coberturaTintaTexto?: string | null
  fabricante?: string | null
  microondulado?: boolean | null
  materialMicroonduladoId?: string | null
  fornecido?: boolean | null
  qtdModelos?: number | string | null
  arte?: string | null
  observacao?: string | null
  observacaoAreasOp?: string | null
  conteudoVolume?: number | string | null
  acondicionamento?: Array<{ descricao: string }> | null
  comprimentoMm?: number | string | null
  larguraMm?: number | string | null
  alturaMm?: number | string | null
  abaColaMm?: number | string | null
  abaFechamentoMm?: number | string | null
  fibra?: boolean | null
  montagemLinhas?: number | string | null
  montagemColunas?: number | string | null
  formatoSupLarguraMm?: number | string | null
  formatoSupAlturaMm?: number | string | null
  formatoCorteLarguraMm?: number | string | null
  formatoCorteAlturaMm?: number | string | null
  ajusteCorteMicroMm?: number | string | null
  quantidade: number
  /**
   * Resultado do cálculo persistido (shape tolerante). Usado por `itemParaForm`
   * (preço do papel) e pelas seções de leitura do Editor (Estrutura de Custo,
   * pré-visualização de margem no Fechamento). Campos extras aceitos.
   */
  resultadoCalculo?:
    | {
        papel?: { precoKg?: number } | null
        custoProducao?: number
        custoTotal?: number
        cevPerc?: number
        margemReal?: number
        [extra: string]: unknown
      }
    | null
  // Origem (repetição): cálculo da biblioteca de onde o item foi copiado.
  // Habilita a Conferência foto × recálculo no StepRevisao.
  calculoGraficoOrigemId?: string | null
  // Planos do item (quando o GET /:id passar a retorná-los). Usado por
  // `montarAncoras` para decidir exibir a seção/âncora "Planos".
  planos?: unknown[] | null
}

/**
 * Mapeia um item carregado da API de volta para o `WizardFormData`.
 *
 * Função PURA (sem React/IO). Extraída sem alteração do `ItemWizardModal` para
 * ser reutilizada pelo `EditorItem` — a hidratação do form é idêntica no wizard
 * e no editor de página única.
 */
export function itemParaForm(
  item: ItemParaEditar,
  orcamentoId?: string,
  observacoesOrcamento?: string | null,
  imagemFacaOrcamento?: string | null,
  imagemProdutoOrcamento?: string | null,
): WizardFormData {
  const coresMapeadas: CorItem[] = (item.cores || []).map((c: any) => ({
    nome: c.nome,
    tipo: c.tipo,
    coberturaPercent: c.coberturaPercent,
    precoKg: c.precoKg ?? 45,
    rendimentoM2Kg: c.rendimentoM2Kg ?? 15000,
  }))

  let precoKgCarregado = 0
  if (item.resultadoCalculo?.papel?.precoKg) {
    precoKgCarregado = Number(item.resultadoCalculo.papel.precoKg)
  }
  if (precoKgCarregado <= 0) precoKgCarregado = 4.5

  return {
    ...INITIAL_ITEM,
    tipoEmbalagemId: item.tipoEmbalagemId ?? null,
    tipoEmbalagem: item.tipoEmbalagem ?? null,
    medidas: item.medidas ?? {},
    suporteId: item.suporteId ?? null,
    papelId: item.papelId ?? null,
    papelDescricao: item.papelDescricao ?? '',
    gramatura: item.gramatura ? Number(item.gramatura) : 0,
    precoKg: precoKgCarregado,
    cores: coresMapeadas.length > 0 ? coresMapeadas : INITIAL_ITEM.cores,
    acabamentosRicos: (item.acabamentosRicos as any) ?? [],
    // R6 — materiais de acabamento computados no custo (reabrir item salvo)
    materiaisAcabamento: Array.isArray(item.materiaisAcabamento)
      ? item.materiaisAcabamento.map((m): MaterialAcabamentoItem => ({
          materialAcabamentoId: m.materialAcabamentoId ?? undefined,
          nome: m.nome ?? undefined,
          computarCusto: m.computarCusto ?? true,
          valorUnitario: m.valorUnitario != null ? Number(m.valorUnitario) : null,
          quantidade: m.quantidade != null ? Number(m.quantidade) : null,
        }))
      : [],
    quantidade: item.quantidade ?? 10000,
    maquinaId: item.maquinaId ?? null,
    aproveitamentoManual: item.aproveitamentoManual ?? null,
    modeloFacaId: item.modeloFacaId ?? null,
    // Fase 4 — matriz / tinta / itens complementares
    matrizQuantidade: item.matrizQuantidade != null ? Number(item.matrizQuantidade) : null,
    matrizPrecoUnitario: item.matrizPrecoUnitario != null ? Number(item.matrizPrecoUnitario) : null,
    tintaModo: item.tintaModo ?? 'COBERTURA',
    tintaConsumoKg: item.tintaConsumoKg != null ? Number(item.tintaConsumoKg) : null,
    tintaPrecoKg: null, // não vem da API
    itensDiversos: (item.itensDiversos as any) ?? [],
    itensFornecidos: (item.itensFornecidos as any) ?? [],
    camposLivres: (item.camposLivres as any) ?? [],
    // Task 4 — Dados Técnicos (paridade / geometria / acondicionamento)
    siglaAcabado: item.siglaAcabado ?? '',
    tributacao: item.tributacao ?? '',
    processoImpressao: item.processoImpressao ?? '',
    coberturaTintaTexto: item.coberturaTintaTexto ?? '',
    fabricante: item.fabricante ?? '',
    microondulado: item.microondulado ?? false,
    materialMicroonduladoId: item.materialMicroonduladoId ?? null,
    fornecido: item.fornecido ?? false,
    qtdModelos: item.qtdModelos != null ? Number(item.qtdModelos) : null,
    arte: item.arte ?? '',
    observacao: item.observacao ?? '',
    observacaoAreasOp: item.observacaoAreasOp ?? '',
    conteudoVolume: item.conteudoVolume != null ? Number(item.conteudoVolume) : null,
    acondicionamento: Array.isArray(item.acondicionamento)
      ? item.acondicionamento.map((a: any) => ({ descricao: a?.descricao ?? '' }))
      : [],
    comprimentoMm: item.comprimentoMm != null ? Number(item.comprimentoMm) : null,
    larguraMm: item.larguraMm != null ? Number(item.larguraMm) : null,
    alturaMm: item.alturaMm != null ? Number(item.alturaMm) : null,
    abaColaMm: item.abaColaMm != null ? Number(item.abaColaMm) : null,
    abaFechamentoMm: item.abaFechamentoMm != null ? Number(item.abaFechamentoMm) : null,
    fibra: item.fibra ?? false,
    montagemLinhas: item.montagemLinhas != null ? Number(item.montagemLinhas) : null,
    montagemColunas: item.montagemColunas != null ? Number(item.montagemColunas) : null,
    formatoSupLarguraMm: item.formatoSupLarguraMm != null ? Number(item.formatoSupLarguraMm) : null,
    formatoSupAlturaMm: item.formatoSupAlturaMm != null ? Number(item.formatoSupAlturaMm) : null,
    formatoCorteLarguraMm: item.formatoCorteLarguraMm != null ? Number(item.formatoCorteLarguraMm) : null,
    formatoCorteAlturaMm: item.formatoCorteAlturaMm != null ? Number(item.formatoCorteAlturaMm) : null,
    ajusteCorteMicroMm: item.ajusteCorteMicroMm != null ? Number(item.ajusteCorteMicroMm) : null,
    // Contexto da Conferência foto × recálculo (só quando o item veio de cálculo).
    _conferenciaOrcamentoId: item.calculoGraficoOrigemId && orcamentoId ? orcamentoId : null,
    _conferenciaItemId: item.calculoGraficoOrigemId ? item.id : null,
    // Item salvo em edição (QUALQUER origem) — usado pelo P15 (encaixe real).
    _itemSalvoOrcamentoId: orcamentoId ?? null,
    _itemSalvoId: item.id ?? null,
    // Tiragens da proposta/RFQ (observações do orçamento) p/ a grade de comparação.
    _faixasTiragemIniciais: extrairTiragensDasObservacoes(observacoesOrcamento) || null,
    // Imagem da faca do orçamento (visualização em Dados Técnicos e Revisão).
    _imagemFaca: imagemFacaOrcamento ?? null,
    // Foto do produto cadastrado (ao lado da faca).
    _imagemProdutoUrl: imagemProdutoOrcamento ?? null,
  }
}

/**
 * Monta o payload de salvar/calcular de um item a partir do `WizardFormData`.
 *
 * Função PURA extraída SEM alteração do `salvar()` do `ItemWizardModal` — segue
 * o `itemOrcamentoBodySchema` do backend. Inclui os Dados Técnicos via
 * `montarPayloadDadosTecnicos(formData)`. O cálculo/ancoragem é do backend; aqui
 * só se coletam e normalizam os parâmetros do item.
 */
export function montarPayloadItem(formData: WizardFormData): Record<string, unknown> {
  const acabamentosAtivos = formData.acabamentos
    .filter((a: AcabamentoItem) => a.ativo)
    .map((a: AcabamentoItem) => ({
      tipo: a.tipo,
      custoHora: a.custoHora,
      velocidade: a.velocidade,
      custoMaterialM2: a.custoMaterialM2,
    }))

  return {
    tipoEmbalagemId: formData.tipoEmbalagemId,
    medidas: formData.medidas,
    suporteId: formData.suporteId || undefined,
    papelId: formData.papelId || undefined,
    papelDescricao: formData.papelDescricao || undefined,
    gramatura: formData.gramatura,
    precoKg: formData.precoKg,
    cores: formData.cores.map((c) => ({
      nome: c.nome,
      tipo: c.tipo,
      coberturaPercent: c.coberturaPercent,
      precoKg: c.precoKg,
      rendimentoM2Kg: c.rendimentoM2Kg,
    })),
    acabamentos: acabamentosAtivos,
    acabamentosRicos: formData.acabamentosRicos?.length ? formData.acabamentosRicos : undefined,
    // R6 — materiais de acabamento a computar no custo. Só envia os marcados
    // (computarCusto=true); lista vazia → omite (não-regressão).
    materiaisAcabamento: (() => {
      const itens = (formData.materiaisAcabamento ?? [])
        .filter((m) => m.computarCusto)
        .map((m) => ({
          materialAcabamentoId: m.materialAcabamentoId,
          nome: m.nome,
          computarCusto: true,
          valorUnitario: m.valorUnitario ?? 0,
          quantidade: m.quantidade ?? 1,
        }))
      return itens.length ? itens : undefined
    })(),
    quantidade: formData.quantidade,
    tabelaMargemId: formData.tabelaMargemId || undefined,
    maquinaId: formData.maquinaId || undefined,
    aproveitamentoManual: formData.aproveitamentoManual || undefined,
    modeloFacaId: formData.modeloFacaId || undefined,
    // Fase 4 — matriz / tinta / itens complementares
    matriz:
      (formData.matrizQuantidade ?? 0) > 0
        ? { quantidade: formData.matrizQuantidade as number, precoUnitario: formData.matrizPrecoUnitario ?? 0 }
        : undefined,
    tinta:
      formData.tintaModo === 'CONSUMO_DIRETO'
        ? { modo: 'CONSUMO_DIRETO' as const, consumoKg: formData.tintaConsumoKg ?? 0, precoKg: formData.tintaPrecoKg ?? 0 }
        : { modo: 'COBERTURA' as const },
    // Itens complementares: normaliza quantidade/valor para os mínimos do backend.
    itensDiversos: (() => {
      const itens = (formData.itensDiversos ?? [])
        .filter((i) => i.descricao?.trim())
        .map((i) => ({
          descricao: i.descricao.trim(),
          quantidade: i.fixo ? 1 : i.quantidade && i.quantidade >= 0.001 ? i.quantidade : 1,
          valor: i.valor && i.valor >= 0.01 ? i.valor : 0.01,
          fixo: !!i.fixo,
        }))
      return itens.length ? itens : undefined
    })(),
    itensFornecidos: (() => {
      const itens = (formData.itensFornecidos ?? [])
        .filter((i) => i.descricao?.trim())
        .map((i) => ({ descricao: i.descricao.trim(), quantidade: i.quantidade && i.quantidade >= 0.001 ? i.quantidade : 1 }))
      return itens.length ? itens : undefined
    })(),
    camposLivres: (() => {
      const campos = (formData.camposLivres ?? []).filter((c) => c.rotulo?.trim())
      return campos.length ? campos : undefined
    })(),
    // Task 4 — Dados Técnicos (paridade / geometria / acondicionamento)
    ...montarPayloadDadosTecnicos(formData),
  }
}

/**
 * Monta o payload do RECÁLCULO (preview) de um item — o mesmo shape que o
 * `StepRevisao` envia para `POST /orcamento-grafico/calcular` (item novo) ou
 * `POST /:id/itens/:itemId/calcular` (item de repetição ancorado). Fonte única
 * para o recálculo ao vivo do editor e para o StepRevisao, evitando divergência.
 *
 * É um SUBCONJUNTO do payload de salvar focado nos parâmetros que afetam o
 * cálculo. Função PURA.
 */
export function montarPayloadCalculo(formData: WizardFormData): Record<string, unknown> {
  const acabamentosAtivos = formData.acabamentos
    .filter((a: AcabamentoItem) => a.ativo)
    .map((a: AcabamentoItem) => ({
      tipo: a.tipo,
      custoHora: a.custoHora,
      velocidade: a.velocidade,
      custoMaterialM2: a.custoMaterialM2,
    }))

  const itensDiversos = (formData.itensDiversos ?? [])
    .filter((i) => i.descricao?.trim())
    .map((i) => ({
      descricao: i.descricao.trim(),
      quantidade: i.fixo ? 1 : i.quantidade && i.quantidade >= 0.001 ? i.quantidade : 1,
      valor: i.valor && i.valor >= 0.01 ? i.valor : 0.01,
      fixo: !!i.fixo,
    }))

  return {
    tipoEmbalagemId: formData.tipoEmbalagemId,
    medidas: formData.medidas,
    suporteId: formData.suporteId || undefined,
    papelId: formData.papelId || undefined,
    gramatura: formData.gramatura,
    precoKg: formData.precoKg,
    cores: formData.cores.map((c) => ({
      nome: c.nome,
      tipo: c.tipo,
      coberturaPercent: c.coberturaPercent,
      precoKg: c.precoKg,
      rendimentoM2Kg: c.rendimentoM2Kg,
    })),
    acabamentos: acabamentosAtivos,
    acabamentosRicos: formData.acabamentosRicos?.length ? formData.acabamentosRicos : undefined,
    quantidade: formData.quantidade,
    tabelaMargemId: formData.tabelaMargemId || undefined,
    maquinaId: formData.maquinaId || undefined,
    aproveitamentoManual: formData.aproveitamentoManual || undefined,
    itensDiversos: itensDiversos.length ? itensDiversos : undefined,
    formatoCorteLarguraMm: formData.formatoCorteLarguraMm || undefined,
    formatoCorteAlturaMm: formData.formatoCorteAlturaMm || undefined,
  }
}

/**
 * Salva o item: PUT quando há `itemId` (edição), POST quando é novo.
 *
 * Reaproveita `montarPayloadItem`. É a MESMA chamada que o `ItemWizardModal`
 * fazia inline — o cálculo/ancoragem acontecem no backend. NÃO aciona fluxo de OP.
 */
export async function salvarItem(
  orcamentoId: string,
  formData: WizardFormData,
  itemId?: string | null,
): Promise<void> {
  const payload = montarPayloadItem(formData)
  if (itemId) {
    await api.put(`/orcamento-grafico/${orcamentoId}/itens/${itemId}`, payload)
  } else {
    await api.post(`/orcamento-grafico/${orcamentoId}/itens`, payload)
  }
}
