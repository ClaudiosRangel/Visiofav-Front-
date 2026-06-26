/**
 * Mapeia os valores antigos dos enums modoResolucaoLote/modoResolucaoValidade
 * para os novos campos booleanos aceitarSenha e aceitarCcePendente.
 *
 * Regras de mapeamento:
 * - BLOQUEAR         → aceitarSenha=false, aceitarCcePendente=false
 * - ACEITAR_LIVRE    → aceitarSenha=false, aceitarCcePendente=false (opção removida, vira bloqueio total)
 * - ACEITAR_SENHA    → aceitarSenha=true, aceitarCcePendente=false
 * - ACEITAR_CCE      → aceitarSenha=false, aceitarCcePendente=true
 *
 * Se o produto já possui os campos booleanos (após migração), retorna diretamente.
 */
export function mapearModosBloqueio(produto: Record<string, any>): {
  aceitarSenha: boolean
  aceitarCcePendente: boolean
} {
  // Se já possui campos booleanos da nova API, usar diretamente
  if (typeof produto.aceitarSenha === 'boolean') {
    return {
      aceitarSenha: produto.aceitarSenha,
      aceitarCcePendente: produto.aceitarCcePendente ?? false,
    }
  }

  // Mapeamento dos valores legados
  const modoLote = produto.modoResolucaoLote || 'BLOQUEAR'
  const modoValidade = produto.modoResolucaoValidade || 'BLOQUEAR'

  const aceitarSenha = modoLote === 'ACEITAR_SENHA' || modoValidade === 'ACEITAR_SENHA'
  const aceitarCcePendente = modoLote === 'ACEITAR_CCE' || modoValidade === 'ACEITAR_CCE'

  return { aceitarSenha, aceitarCcePendente }
}
