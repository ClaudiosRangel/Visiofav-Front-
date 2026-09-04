/**
 * Tipos, enums e limites de negócio do painel Financeiro Vizor (frontend).
 *
 * Espelham o contrato REAL do backend (VisioFab.Wms.Back), definido em
 * `src/modules/financeiro-vizor/financeiro.types.ts` e nas rotas de
 * `financeiro-vizor.routes.ts` (prefixo `/api/financeiro-vizor`, exclusivo do
 * SUPER_ADMIN). O frontend não persiste nada — só apresenta o estado retornado
 * e monta os payloads de escrita.
 *
 * ---------------------------------------------------------------------------
 * DIVERGÊNCIAS EM RELAÇÃO AO RASCUNHO DO DESIGN (o contrato do backend prevalece):
 * ---------------------------------------------------------------------------
 * 1. Chave da empresa: o backend usa `empresaId` (não `id`) tanto em
 *    `EmpresaStatusView` quanto em `DetalheCobranca` e `FaturaView`. Ajustado
 *    para `empresaId`.
 * 2. `DetalheCobranca` do backend NÃO inclui `nome` nem `statusFinanceiro` — a
 *    rota `GET /empresas/:id` devolve `{ ...detalhe, faturas }`, ou seja, o
 *    `DetalheCobranca` acrescido do array `faturas`. O `nome`/`statusFinanceiro`
 *    da empresa vêm da listagem (`EmpresaStatusView`). Modelado aqui como
 *    `DetalheCobranca` (campos do backend + `faturas`), sem `nome`/`status`.
 * 3. Datas: no backend `dataContrato`, `dataVencimento` e `dataPagamento` são
 *    `Date`. Ao trafegar por JSON (Axios) chegam como `string` ISO no cliente —
 *    por isso são tipadas como `string` aqui (com `| null` onde aplicável).
 * 4. `PRECO_MIN` não existe no backend (só `PRECO_MAX`). O design do frontend
 *    pede `PRECO_MIN` como limite de validação no cliente — mantido como 0.
 * 5. `StatusFatura`: mesma união do backend; a ordem dos literais no backend é
 *    `PENDENTE | PAGA | VENCIDA | CANCELADA` (irrelevante para o tipo).
 * 6. `GerarVencimentosResultado`: o backend devolve `{ criadas, ignoradas }`
 *    (confirmado no `fatura.service.ts`), igual ao rascunho.
 * 7. Reativar/inativar respondem `{ empresaId, statusFinanceiro }` (não um
 *    `EmpresaStatusView` completo) — modelado como `StatusEmpresaResultado`.
 */

// ---------------------------------------------------------------------------
// Enums (como string) e módulos
// ---------------------------------------------------------------------------

/** Os seis módulos comercializáveis do ERP. Ordem canônica de exibição. */
export const MODULOS = ['COMPRAS', 'VENDAS', 'FINANCEIRO', 'FISCAL', 'WMS', 'PCP'] as const
export type Modulo = (typeof MODULOS)[number]

/** Estágio de cobrança materializado na empresa (`statusFinanceiro`). */
export type StatusFinanceiro = 'ATIVO' | 'SOMENTE_LEITURA' | 'INATIVADO'

/** Ciclo de vida de uma fatura. */
export type StatusFatura = 'PENDENTE' | 'VENCIDA' | 'PAGA' | 'CANCELADA'

// ---------------------------------------------------------------------------
// Limites de negócio (espelhados para validação no cliente / feedback imediato).
// A validação autoritativa permanece no backend (Zod).
// ---------------------------------------------------------------------------

/** Piso de preço por módulo. Não existe no backend; convenção do frontend. */
export const PRECO_MIN = 0
/** Teto de preço por módulo: R$ 999.999.999,99. */
export const PRECO_MAX = 999_999_999.99
/** Dia de vencimento mínimo aceito no contrato. */
export const DIA_VENCIMENTO_MIN = 1
/** Dia de vencimento máximo aceito no contrato. */
export const DIA_VENCIMENTO_MAX = 31
/** Mínimo de meses na geração de vencimentos em lote. */
export const MESES_MIN = 1
/** Máximo de meses na geração de vencimentos em lote. */
export const MESES_MAX = 60

// ---------------------------------------------------------------------------
// Modelos de leitura (respostas da API)
// ---------------------------------------------------------------------------

/**
 * Preço negociado de um módulo específico. Presente para os seis módulos no
 * `DetalheCobranca` (preço 0 para os não precificados).
 */
export interface PrecoModuloView {
  modulo: Modulo
  preco: number
}

/**
 * Linha da listagem de empresas com seu status financeiro.
 * (`GET /empresas` → `EmpresaStatusView[]`)
 */
export interface EmpresaStatusView {
  empresaId: string
  /** Nome/razão social da empresa (listagem ordenada por nome asc). */
  nome: string
  statusFinanceiro: StatusFinanceiro
  /** Soma dos preços ativos do contrato (0 se sem contrato). */
  totalMensal: number
  /** Soma das faturas vencidas em aberto. Sempre >= 0. */
  totalVencidoEmAberto: number
}

/**
 * Representação de saída de uma fatura. Datas chegam como string ISO via JSON.
 */
export interface FaturaView {
  id: string
  empresaId: string
  /** Competência no formato "YYYY-MM". */
  competencia: string
  /** Data de vencimento (ISO). */
  dataVencimento: string
  valor: number
  status: StatusFatura
  /** Data de pagamento (baixa), ISO, ou `null` enquanto não paga. */
  dataPagamento: string | null
}

/**
 * Detalhe do contrato de cobrança de uma empresa.
 *
 * A rota `GET /empresas/:id` devolve `{ ...detalhe, faturas }` — este tipo já
 * inclui `faturas` para refletir a resposta real. `nome`/`statusFinanceiro` NÃO
 * fazem parte deste payload (vêm da listagem `EmpresaStatusView`).
 *
 * `diaVencimento`, `dataContrato` e `diasEmAtraso` são `null` quando a empresa
 * ainda não tem contrato/atraso.
 */
export interface DetalheCobranca {
  empresaId: string
  /** Preços dos seis módulos, na ordem canônica de `MODULOS` (0 se não precificado). */
  precos: PrecoModuloView[]
  /** Soma dos preços de módulo estritamente maiores que zero. */
  totalMensal: number
  /** Dia de vencimento (1..31) ou `null` se não há contrato. */
  diaVencimento: number | null
  /** Data do contrato (ISO) ou `null` se não há contrato. */
  dataContrato: string | null
  /** Soma das faturas PENDENTE/VENCIDA já vencidas. Sempre >= 0. */
  totalVencidoEmAberto: number
  /** Dias em atraso da fatura vencida mais antiga, ou `null` se não há atraso. */
  diasEmAtraso: number | null
  /** Faturas da empresa (acrescentadas pela rota ao `DetalheCobranca` do service). */
  faturas: FaturaView[]
}

// ---------------------------------------------------------------------------
// Modelos de escrita (payloads enviados) e resultados de ação
// ---------------------------------------------------------------------------

/**
 * Payload de criação/atualização de contrato (upsert).
 * `dataContrato` é enviada como string "YYYY-MM-DD" (serializada do input).
 * A validação (data não futura, dia 1..31, preços 0..999.999.999,99) é feita
 * no cliente para feedback imediato; o Zod do backend é a autoridade final.
 */
export interface SalvarContratoInput {
  /** Data do contrato no formato "YYYY-MM-DD". */
  dataContrato: string
  diaVencimento: number
  /** Preços por módulo (parciais — módulos ausentes assumem preço 0). */
  precos: PrecoModuloView[]
}

/** Payload da geração de vencimentos em lote. */
export interface GerarVencimentosInput {
  /** Inteiro de 1 a 60. */
  meses: number
  /** Competência inicial "YYYY-MM" (opcional; default = mês seguinte ao atual). */
  competenciaInicial?: string
}

/** Resposta da geração de vencimentos: quantas criadas e quais competências ignoradas. */
export interface GerarVencimentosResultado {
  criadas: number
  /** Competências "YYYY-MM" ignoradas (já existiam e não estavam canceladas). */
  ignoradas: string[]
}

/**
 * Resposta das ações de status da empresa (`reativar`/`inativar`).
 * O backend responde apenas `{ empresaId, statusFinanceiro }`.
 */
export interface StatusEmpresaResultado {
  empresaId: string
  statusFinanceiro: StatusFinanceiro
}
