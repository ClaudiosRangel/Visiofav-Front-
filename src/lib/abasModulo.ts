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

/**
 * Navega "de volta" para a tela de Módulos a partir de qualquer página
 * interna (botão/link "← Módulos" do Header, ModuleSidebar, etc.).
 *
 * Cada módulo é aberto em uma aba NOVA do navegador via window.open()
 * (abrirAbaModulo, em /modulos). Se o botão "← Módulos" apenas navegasse
 * essa mesma aba para `/modulos` (router.push), a aba do módulo se
 * transformava em mais uma aba de Módulos — cada clique gerava uma aba nova
 * de Módulos, acumulando várias abas idênticas abertas.
 *
 * Em vez disso: quando esta aba foi aberta via script (tem `window.opener`
 * ainda aberto — ou seja, é uma aba de módulo), fecha a aba atual e devolve
 * o foco à aba original de Módulos que a abriu. Só faz `router.push` como
 * fallback quando não há opener (ex.: usuário acessou a URL diretamente,
 * atualizou a página, ou o navegador não permite `window.close()`).
 */
export function voltarParaModulos(router: { push: (href: string) => void }) {
  if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
    try {
      window.opener.focus()
      window.close()
      return
    } catch {
      // Fechamento bloqueado pelo navegador — cai no fallback abaixo.
    }
  }
  router.push('/modulos')
}
