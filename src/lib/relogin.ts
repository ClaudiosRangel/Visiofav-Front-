/**
 * Canal de "entrar de novo sem sair da tela".
 *
 * Quando a renovação automática do token falha (refresh ausente, expirado ou revogado), o
 * interceptor do `api` antes limpava a sessão e fazia `window.location.href = '/login'` — o que
 * disparava "Sair do site?" e fazia o usuário perder tudo o que tinha digitado (ex.: um item de
 * orçamento em edição).
 *
 * Agora, se a tela registrou um tratador (o `ReloginModal` dentro dos providers do ERP), o
 * interceptor pede um novo token por aqui: o modal abre por cima da página, o usuário digita a
 * senha, e a requisição que falhou é refeita com o token novo. O estado da tela é preservado.
 * Sem tratador registrado (ou se o usuário desistir), segue o comportamento antigo.
 */

type Tratador = () => Promise<string>

let tratador: Tratador | null = null
let pendente: Promise<string> | null = null

/** Registra o tratador (o modal). Retorna a função para desregistrar. */
export function registrarRelogin(fn: Tratador): () => void {
  tratador = fn
  return () => {
    if (tratador === fn) tratador = null
  }
}

/** Há um modal de reentrada montado? */
export function podeRelogar(): boolean {
  return tratador !== null
}

/**
 * Pede um novo token de acesso. Chamadas simultâneas compartilham o mesmo pedido (um só modal).
 * Rejeita se não houver tratador ou se o usuário desistir.
 */
export function solicitarRelogin(): Promise<string> {
  if (!tratador) return Promise.reject(new Error('Sessão expirada'))
  if (!pendente) {
    pendente = tratador().finally(() => {
      pendente = null
    })
  }
  return pendente
}
