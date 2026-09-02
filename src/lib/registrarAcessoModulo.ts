import { api } from './api'

/**
 * Registra o acesso do usuário a um módulo (Log de Acesso — Opção A).
 * Chamado na navegação interna. Nunca lança: falha de log não pode quebrar
 * a navegação. Deduplica chamadas idênticas seguidas (mesmo módulo+rota)
 * para não gravar múltiplas linhas ao re-renderizar a mesma página.
 */
let ultimoRegistro = ''

export function registrarAcessoModulo(modulo: string, rota: string): void {
  if (!modulo) return
  const chave = `${modulo}|${rota}`
  if (chave === ultimoRegistro) return
  ultimoRegistro = chave

  api.post('/acesso-log/registrar-modulo', { modulo, rota }).catch(() => {
    // Silencioso — não bloquear navegação por falha de log.
  })
}
