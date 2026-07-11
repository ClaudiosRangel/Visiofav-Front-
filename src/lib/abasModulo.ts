// Módulo compartilhado para rastrear as janelas/abas de módulo abertas via
// window.open() na tela de seleção de módulos (/modulos).
//
// Precisa viver fora do componente ModulosPage (como um Map em nível de
// módulo, não um useRef local) porque o EmpresaProvider — responsável por
// logout() e trocarEmpresa() — está em outra parte da árvore de componentes
// e precisa conseguir fechar essas abas quando o usuário sai do sistema ou
// troca de empresa, para não deixar dados de uma sessão/empresa anterior
// acessíveis em abas que ficaram abertas.
const abasAbertas = new Map<string, Window>()

export function registrarAbaModulo(modulo: string, janela: Window) {
  abasAbertas.set(modulo, janela)
}

export function obterAbaModulo(modulo: string): Window | undefined {
  return abasAbertas.get(modulo)
}

/**
 * Fecha todas as abas de módulo abertas nesta sessão do navegador e limpa o
 * registro. Deve ser chamado em logout() e trocarEmpresa() do EmpresaProvider.
 */
export function fecharTodasAbasModulo() {
  abasAbertas.forEach((janela) => {
    if (!janela.closed) {
      try {
        janela.close()
      } catch {
        // Alguns navegadores bloqueiam o fechamento de abas que não foram
        // abertas por script nesta mesma origem — ignorar silenciosamente.
      }
    }
  })
  abasAbertas.clear()
}
