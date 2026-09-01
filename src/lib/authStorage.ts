/**
 * Armazenamento de sessão isolado POR ABA.
 *
 * PROBLEMA QUE RESOLVE (vazamento multi-empresa entre abas):
 * `localStorage` é COMPARTILHADO por todas as abas do mesmo domínio. Antes,
 * o token de acesso e a empresa selecionada ficavam só no localStorage — ao
 * abrir a Empresa A numa aba e a Empresa B em outra, a última seleção
 * sobrescrevia o token global e AMBAS as abas passavam a operar como a última
 * empresa (ex.: notas da empresa Demo aparecendo dentro da Carton Wega).
 *
 * SOLUÇÃO:
 * A fonte de verdade do token/empresa ATIVOS de cada aba passa a ser o
 * `sessionStorage`, que é ISOLADO por aba. O `localStorage` é mantido apenas
 * como "semente" para que uma ABA NOVA herde a última sessão ao abrir (UX de
 * não precisar relogar), e para compatibilidade com código legado que ainda
 * lê a chave. Trocar de empresa numa aba altera o sessionStorage DELA (e
 * atualiza a semente do localStorage), sem afetar as abas já abertas — cada
 * uma continua na sua empresa.
 *
 * Regras:
 *  - LER token/empresa: sessionStorage tem prioridade; se a aba ainda não tem
 *    (aba recém-aberta), herda do localStorage e "fixa" na aba.
 *  - GRAVAR: escreve no sessionStorage (a aba) E no localStorage (semente).
 *  - LIMPAR (logout): limpa ambos.
 */

const TOKEN = 'visiofab-wms-token'
const REFRESH = 'visiofab-wms-refresh-token'
const EMPRESA = 'visiofab-wms-empresa'
const USER = 'visiofab-wms-user'

function hasWindow(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Lê um valor da sessão da ABA. Se o sessionStorage ainda não tem a chave
 * (aba nova), herda do localStorage e fixa no sessionStorage — a partir daí a
 * aba é independente das demais.
 */
function getScoped(key: string): string | null {
  if (!hasWindow()) return null
  const fromSession = sessionStorage.getItem(key)
  if (fromSession !== null) return fromSession
  const fromLocal = localStorage.getItem(key)
  if (fromLocal !== null) {
    // Semente: fixa na aba para isolar das próximas trocas em outras abas.
    sessionStorage.setItem(key, fromLocal)
    return fromLocal
  }
  return null
}

/**
 * Grava um valor: no sessionStorage (a ABA atual) e no localStorage (semente
 * para novas abas). Não afeta abas já abertas — elas leem do próprio
 * sessionStorage.
 */
function setScoped(key: string, value: string): void {
  if (!hasWindow()) return
  sessionStorage.setItem(key, value)
  localStorage.setItem(key, value)
}

function removeScoped(key: string): void {
  if (!hasWindow()) return
  sessionStorage.removeItem(key)
  localStorage.removeItem(key)
}

// ── Token de acesso ──
export const getAuthToken = (): string | null => getScoped(TOKEN)
export const setAuthToken = (t: string): void => setScoped(TOKEN, t)

// ── Refresh token ──
export const getRefreshToken = (): string | null => getScoped(REFRESH)
export const setRefreshToken = (t: string): void => setScoped(REFRESH, t)

// ── Empresa selecionada (JSON serializado) ──
export const getEmpresaRaw = (): string | null => getScoped(EMPRESA)
export const setEmpresaRaw = (json: string): void => setScoped(EMPRESA, json)

// ── Usuário (JSON serializado) ──
export const getUserRaw = (): string | null => getScoped(USER)
export const setUserRaw = (json: string): void => setScoped(USER, json)

/** Limpa toda a sessão (logout) — na aba e na semente. */
export function clearAuthSession(): void {
  removeScoped(TOKEN)
  removeScoped(REFRESH)
  removeScoped(EMPRESA)
  removeScoped(USER)
}
