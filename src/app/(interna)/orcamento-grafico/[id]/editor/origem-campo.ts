/**
 * origem-campo.ts — base da legenda "copiado / manual / vazio" do Editor de Item.
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Design, Property 4).
 *
 * Função PURA, sem React e sem I/O. Materializa, no frontend, a
 * Tabela_De_Para_Puxar dos requisitos: classifica cada Campo_Técnico como
 * COPIAVEL (vem do cálculo ao Puxar) ou MANUAL (sem fonte na origem) e deriva,
 * a partir da classe + valor atual do campo, o estado de origem exibido na
 * legenda do Editor.
 *
 * O único Campo_Técnico com fonte garantida na origem migrada é a Sigla
 * Acabado (`CalculoGrafico.siglaAcabado`); por isso ela é a única COPIAVEL. Os
 * demais permanecem MANUAL (nunca inventar valor — regra do projeto).
 *
 * _Requirements: 4.4, 4.5_
 */

/** Classe de origem de um campo técnico de paridade. */
export type ClasseCampoTecnico = 'COPIAVEL' | 'MANUAL'

/** Estado de origem derivado (classe + valor) usado pela legenda. */
export type OrigemCampo =
  | 'copiado' // COPIAVEL e preenchido (veio do cálculo ao puxar)
  | 'manual-preenchido' // MANUAL e preenchido (o usuário informou)
  | 'manual-vazio' // MANUAL e vazio (precisa completar manualmente)
  | 'vazio' // COPIAVEL mas vazio (não havia valor na origem)

/**
 * Classificação estática de cada Campo_Técnico (fonte única da legenda).
 * Espelha a Tabela_De_Para_Puxar dos requisitos:
 * - `siglaAcabado` passa a ser copiado do cálculo de origem → COPIAVEL.
 * - Demais campos técnicos não têm fonte na origem → MANUAL.
 */
export const CLASSE_CAMPO_TECNICO: Record<string, ClasseCampoTecnico> = {
  siglaAcabado: 'COPIAVEL',
  tributacao: 'MANUAL',
  processoImpressao: 'MANUAL',
  coberturaTintaTexto: 'MANUAL',
  fabricante: 'MANUAL',
  qtdModelos: 'MANUAL',
  arte: 'MANUAL',
  microondulado: 'MANUAL',
  fornecido: 'MANUAL',
  observacao: 'MANUAL',
  observacaoAreasOp: 'MANUAL',
  acondicionamento: 'MANUAL',
  conteudoVolume: 'MANUAL',
}

/**
 * Campos numéricos em que o valor `0` representa "vazio/não informado".
 * - `qtdModelos` e `conteudoVolume` nascem/ficam em 0 quando não preenchidos,
 *   logo 0 deve ser tratado como vazio para fins da legenda.
 *
 * Decisão (documentada propositalmente): campos BOOLEANOS
 * (`microondulado`, `fornecido`) NÃO entram aqui — `false` é um valor VÁLIDO e
 * deliberado ("não é microondulado" / "não é fornecido"), portanto um boolean
 * é SEMPRE considerado preenchido, nunca vazio. Só `''`, `null` e `undefined`
 * (e `0` para os numéricos acima) contam como vazio.
 */
const CAMPOS_NUMERICOS_ZERO_VAZIO = new Set<string>(['qtdModelos', 'conteudoVolume'])

/**
 * Decide se um valor de campo técnico está "vazio".
 *
 * Regras:
 * - `''`, `null` e `undefined` são sempre vazios.
 * - Booleans nunca são vazios (`false` é valor válido — ver decisão acima).
 * - Para os campos numéricos listados (`qtdModelos`/`conteudoVolume`), `0`
 *   conta como vazio; demais números não.
 *
 * @param campo nome do campo técnico (para aplicar a regra numérica correta).
 * @param valor valor atual do campo.
 */
export function valorVazio(campo: string, valor: unknown): boolean {
  if (valor === '' || valor === null || valor === undefined) return true
  if (typeof valor === 'boolean') return false
  if (typeof valor === 'number') {
    if (Number.isNaN(valor)) return true
    return valor === 0 && CAMPOS_NUMERICOS_ZERO_VAZIO.has(campo)
  }
  return false
}

/**
 * Deriva o estado de origem de um campo técnico para a legenda do Editor.
 *
 * Tabela (Design, Property 4):
 * | Classe   | Preenchido        | Vazio        |
 * |----------|-------------------|--------------|
 * | COPIAVEL | 'copiado'         | 'vazio'      |
 * | MANUAL   | 'manual-preenchido' | 'manual-vazio' |
 *
 * NUNCA retorna 'copiado' para um campo de classe MANUAL.
 *
 * Observação: esta sobrecarga simples não conhece o nome do campo, então usa a
 * regra de vazio genérica ('', null, undefined; números: só NaN). Para aplicar
 * o tratamento de `0` como vazio em `qtdModelos`/`conteudoVolume`, use
 * {@link origemCampoDoCampo}.
 *
 * @param classe classe do campo (`CLASSE_CAMPO_TECNICO[campo]`).
 * @param valor valor atual do campo.
 */
export function origemCampo(classe: ClasseCampoTecnico, valor: unknown): OrigemCampo {
  const vazio = valorVazio('', valor)
  if (classe === 'COPIAVEL') return vazio ? 'vazio' : 'copiado'
  return vazio ? 'manual-vazio' : 'manual-preenchido'
}

/**
 * Conveniência: deriva o estado de origem pelo NOME do campo, resolvendo a
 * classe em `CLASSE_CAMPO_TECNICO` e aplicando a regra de vazio específica do
 * campo (inclui `0` como vazio para `qtdModelos`/`conteudoVolume`).
 *
 * Campos desconhecidos são tratados como MANUAL (não inventa cópia).
 *
 * @param campo nome do campo técnico.
 * @param valor valor atual do campo.
 */
export function origemCampoDoCampo(campo: string, valor: unknown): OrigemCampo {
  const classe = CLASSE_CAMPO_TECNICO[campo] ?? 'MANUAL'
  const vazio = valorVazio(campo, valor)
  if (classe === 'COPIAVEL') return vazio ? 'vazio' : 'copiado'
  return vazio ? 'manual-vazio' : 'manual-preenchido'
}
