/**
 * desagrupar-planos.ts — helpers puros do "Desagrupar planos" na fila da
 * Programação (PCP).
 *
 * Spec: pcp-desagrupar-planos-fila.
 *
 * O painel agrupa OPs com 2+ planos (ex.: CAIXA/TAMPA) num bloco pai/filho, com
 * só o pai arrastável. Para sequenciar os planos separadamente (pedido do Caio
 * na Mazola — todas as caixas, depois todas as tampas), o usuário desagrupa uma
 * OP via menu de contexto (botão direito); suas etapas viram linhas soltas e
 * arrastáveis. Estes helpers são PUROS (sem React/IO) para serem testáveis
 * isolados.
 */

/**
 * Chave composta que identifica uma OP desagrupada dentro de um centro.
 * Mesma convenção de `planosRecolhidos` (`${centroId}:${opId}`), garantindo que
 * desagrupar uma OP num centro não afete a mesma OP em outro centro.
 */
export function chaveDesagrupar(centroId: string, opId: string): string {
  return `${centroId}:${opId}`
}

/**
 * Aplica o toggle de uma chave num Set, de forma IMUTÁVEL (retorna um novo Set):
 * adiciona se ausente, remove se presente. Idempotente em pares (aplicar 2× com
 * a mesma chave volta ao Set original).
 */
export function aplicarToggle(set: Set<string>, chave: string): Set<string> {
  const novo = new Set(set)
  if (novo.has(chave)) novo.delete(chave)
  else novo.add(chave)
  return novo
}
