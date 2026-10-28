/**
 * Parser PURO de faixas de tiragem (sem React) — P1 "várias tiragens por item".
 *
 * O operador DIGITA as tiragens separadas por vírgula (e também aceita
 * ponto-e-vírgula), ex.: "10.000, 20.000, 50.000". Esta função normaliza esse
 * texto numa lista de números limpa para alimentar o endpoint `simular-tiragens`
 * do backend (que aceita de 1 a 20 quantidades).
 *
 * Regras (ver design `orcamento-grafico-varias-tiragens`):
 * - separa por vírgula E ponto-e-vírgula;
 * - remove o separador de milhar brasileiro (pontos) e espaços;
 * - aceita apenas dígitos por faixa (qualquer caractere não-dígito descarta a
 *   entrada inteira, para não interpretar lixo como número);
 * - descarta entradas não numéricas e menores ou iguais a zero;
 * - deduplica, ordena em ordem crescente;
 * - limita a 20 faixas (corta o excedente — limite do backend).
 *
 * Mantida PURA de propósito, para ser testável isoladamente (vitest).
 */
export const MAX_FAIXAS_TIRAGEM = 20

export function parseFaixasTiragem(texto: string): number[] {
  if (!texto) return []

  const partes = texto.split(/[,;]/)
  const numeros: number[] = []

  for (const parte of partes) {
    // Remove pontos (separador de milhar BR) e TODOS os espaços em branco.
    const limpo = parte.replace(/\./g, '').replace(/\s/g, '')
    if (limpo === '') continue
    // Só aceita faixa composta exclusivamente por dígitos (0-9). Qualquer outro
    // caractere (letra, símbolo, vírgula decimal) descarta a entrada.
    if (!/^\d+$/.test(limpo)) continue
    const n = Number(limpo)
    if (!Number.isFinite(n) || n <= 0) continue
    numeros.push(n)
  }

  // Dedup + ordenação crescente.
  const unicos = Array.from(new Set(numeros)).sort((a, b) => a - b)

  // Limita ao máximo aceito pelo backend (corta o excedente).
  return unicos.slice(0, MAX_FAIXAS_TIRAGEM)
}
