/**
 * passe-selecao-puro — função PURA (sem React, rede ou banco) que resume o passe de
 * seleções de material logo após o salvamento do item (spec
 * orcamento-grafico-fase3-produto-embalagem, Req 10).
 *
 * Regra: o passe de recálculo só roda quando nenhuma seleção ficou "não gravada";
 * a retentativa reenvia somente as não gravadas.
 */

/** Estado de uma seleção de material no editor. */
export type EstadoSelecao = 'PENDENTE' | 'GRAVADA' | 'NAO_GRAVADA'

export interface FalhaSelecao {
  /** `acabamentoId|planoId` (ver `chaveSelecao`). */
  chave: string
  atividadeNome: string
  /** `message` da API ou aviso de tempo esgotado. */
  mensagem: string
}

/** Resultado de um passe (ou de uma retentativa) de gravação de seleções. */
export interface ResultadoPasse {
  gravadas: { chave: string }[]
  falhas: FalhaSelecao[]
}

export interface ResumoPasse {
  /** Falhas atuais (uma por chave), com a atividade e a mensagem. */
  falhas: FalhaSelecao[]
  /** `true` quando nenhuma seleção ficou não gravada: o recálculo pode rodar e o editor fechar. */
  podeRecalcular: boolean
  /** Chaves a reenviar em "Tentar novamente" (só as não gravadas, na ordem das falhas). */
  reenviar: string[]
  totalGravadas: number
  totalNaoGravadas: number
  /** Estado final por chave. */
  estados: Record<string, EstadoSelecao>
}

/** Tempo máximo de espera por gravação de uma seleção (Req 10.1). */
export const TIMEOUT_PASSE_PADRAO_MS = 30_000
export const MENSAGEM_TEMPO_ESGOTADO = 'Tempo esgotado: a API não respondeu a tempo.'

export interface ItemDoPasse {
  chave: string
  atividadeNome: string
  /** Grava (ou remove) a seleção; deve respeitar o `signal` quando possível. */
  executar: (signal: AbortSignal) => Promise<unknown>
}

export interface OpcoesPasse {
  timeoutMs?: number
  /** Extrai a mensagem legível de um erro (ex.: `message` da API). */
  mensagemDoErro?: (err: unknown) => string
}

/**
 * Executa os itens em sequência. Cada chamada tem seu próprio `AbortController` e
 * prazo; erro ou prazo estourado vira falha daquela chave e o passe segue para as demais.
 */
export async function executarPasse(
  itens: ReadonlyArray<ItemDoPasse>,
  opcoes: OpcoesPasse = {},
): Promise<ResultadoPasse> {
  const timeoutMs = opcoes.timeoutMs ?? TIMEOUT_PASSE_PADRAO_MS
  const mensagemDoErro =
    opcoes.mensagemDoErro ?? ((err: unknown) => (err instanceof Error && err.message ? err.message : 'Falha ao gravar a escolha.'))
  const resultado: ResultadoPasse = { gravadas: [], falhas: [] }

  for (const item of itens) {
    const controller = new AbortController()
    let expirou = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const prazo = new Promise<never>((_, rejeitar) => {
      timer = setTimeout(() => {
        expirou = true
        controller.abort()
        rejeitar(new Error(MENSAGEM_TEMPO_ESGOTADO))
      }, timeoutMs)
    })
    prazo.catch(() => undefined)
    try {
      const execucao = Promise.resolve().then(() => item.executar(controller.signal))
      execucao.catch(() => undefined)
      await Promise.race([execucao, prazo])
      resultado.gravadas.push({ chave: item.chave })
    } catch (err) {
      resultado.falhas.push({
        chave: item.chave,
        atividadeNome: item.atividadeNome,
        mensagem: expirou ? MENSAGEM_TEMPO_ESGOTADO : mensagemDoErro(err),
      })
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  return resultado
}

/**
 * Resume um passe, ou uma sequência de passes em ordem (passe inicial e retentativas).
 * Em sequência, o resultado mais recente de cada chave prevalece; dentro de um mesmo
 * resultado, a falha prevalece sobre a gravação da mesma chave.
 */
export function resumirPasse(resultados: ResultadoPasse | ReadonlyArray<ResultadoPasse>): ResumoPasse {
  const lista: ReadonlyArray<ResultadoPasse> = Array.isArray(resultados)
    ? (resultados as ReadonlyArray<ResultadoPasse>)
    : [resultados as ResultadoPasse]

  const estados: Record<string, EstadoSelecao> = {}
  const falhasPorChave = new Map<string, FalhaSelecao>()

  for (const r of lista) {
    for (const g of r?.gravadas ?? []) {
      estados[g.chave] = 'GRAVADA'
      falhasPorChave.delete(g.chave)
    }
    for (const f of r?.falhas ?? []) {
      estados[f.chave] = 'NAO_GRAVADA'
      falhasPorChave.delete(f.chave)
      falhasPorChave.set(f.chave, f)
    }
  }

  const falhas = Array.from(falhasPorChave.values())
  const valores = Object.values(estados)
  return {
    falhas,
    podeRecalcular: falhas.length === 0,
    reenviar: falhas.map((f) => f.chave),
    totalGravadas: valores.filter((e) => e === 'GRAVADA').length,
    totalNaoGravadas: falhas.length,
    estados,
  }
}
