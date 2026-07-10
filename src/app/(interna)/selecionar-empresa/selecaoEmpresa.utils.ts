export interface EmpresaItem {
  id: string
  razaoSocial: string
  nomeFantasia: string | null
  cnpj: string
  cidade?: string | null
  uf?: string | null
  logo?: string | null
}

/**
 * Requirements 1.1, 1.2, 1.3, 1.6 — retorna `true` se e somente se `quantidade === 1`.
 */
export function deveSelecionarAutomaticamente(quantidade: number): boolean {
  return quantidade === 1
}

/**
 * Requirement 1.7 — retorna `true` se e somente se `quantidade > 1`.
 */
export function podeTrocarEmpresa(quantidade: number): boolean {
  return quantidade > 1
}

/**
 * Requirement 2.1 — retorna `true` se e somente se `quantidade >= 2`.
 */
export function deveExibirBarraBusca(quantidade: number): boolean {
  return quantidade >= 2
}

/**
 * Requirements 2.2, 2.4 — filtra `empresas` por substring (case-insensitive) em
 * `razaoSocial` OU `nomeFantasia`. Termo vazio retorna a lista original inalterada.
 */
export function filtrarEmpresasPorBusca(empresas: EmpresaItem[], termo: string): EmpresaItem[] {
  if (termo === '') {
    return empresas
  }

  const termoNormalizado = termo.toLowerCase()

  return empresas.filter((empresa) => {
    const razaoSocialMatch = empresa.razaoSocial.toLowerCase().includes(termoNormalizado)
    const nomeFantasiaMatch = (empresa.nomeFantasia ?? '').toLowerCase().includes(termoNormalizado)
    return razaoSocialMatch || nomeFantasiaMatch
  })
}

/**
 * Requirement 3.3 — retorna `nomeFantasia` (após `trim()`) quando não vazio,
 * senão retorna `razaoSocial`.
 */
export function obterNomeExibicaoEmpresa(empresa: EmpresaItem): string {
  const nomeFantasiaTrimado = (empresa.nomeFantasia ?? '').trim()
  return nomeFantasiaTrimado !== '' ? nomeFantasiaTrimado : empresa.razaoSocial
}

/**
 * Requirements 3.1, 3.3 — deriva as iniciais a partir do nome de exibição
 * (`obterNomeExibicaoEmpresa`): primeira letra das duas primeiras palavras,
 * em maiúsculas. Com apenas uma palavra, usa as duas primeiras letras dessa
 * palavra (ou a única letra disponível, se a palavra tiver um só caractere).
 */
export function obterIniciaisEmpresa(empresa: EmpresaItem): string {
  const nomeExibicao = obterNomeExibicaoEmpresa(empresa).trim()
  const palavras = nomeExibicao.split(/\s+/).filter((palavra) => palavra !== '')

  if (palavras.length === 0) {
    return ''
  }

  if (palavras.length === 1) {
    return palavras[0].slice(0, 2).toUpperCase()
  }

  return (palavras[0][0] + palavras[1][0]).toUpperCase()
}

/**
 * Requirement 3.3 — formata `cnpj` no padrão `XX.XXX.XXX/XXXX-XX` quando
 * possui exatamente 14 dígitos. Para qualquer outro formato, retorna a
 * string original sem lançar exceção.
 */
export function formatarCnpj(cnpj: string): string {
  const digitos = cnpj.replace(/\D/g, '')

  if (digitos.length !== 14) {
    return cnpj
  }

  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

/**
 * Requirements 3.4, 3.6 — retorna `${cidade}/${uf}` apenas quando ambos
 * existem e não são vazios após `trim()`; caso contrário retorna `null`.
 */
export function obterLocalizacaoEmpresa(empresa: EmpresaItem): string | null {
  const cidadeTrimada = (empresa.cidade ?? '').trim()
  const ufTrimada = (empresa.uf ?? '').trim()

  if (cidadeTrimada === '' || ufTrimada === '') {
    return null
  }

  return `${cidadeTrimada}/${ufTrimada}`
}

/**
 * Requirements 3.4, 3.5, 3.6 — retorna `true` somente quando
 * `!ocultarLocalizacao && obterLocalizacaoEmpresa(empresa) !== null`.
 */
export function deveExibirLinhaLocalizacao(empresa: EmpresaItem, ocultarLocalizacao: boolean): boolean {
  return !ocultarLocalizacao && obterLocalizacaoEmpresa(empresa) !== null
}

/**
 * Requirements 3.1, 3.2 — retorna `true` se e somente se `empresa.logo` é uma
 * string não-vazia após `trim()`; usada junto com `obterIniciaisEmpresa` como
 * fallback no `CardEmpresa`.
 */
export function deveExibirLogoNoAvatar(empresa: EmpresaItem): boolean {
  return (empresa.logo ?? '').trim() !== ''
}

/**
 * Requirements 4.3, 5.1, 5.2 — perfis considerados Perfil_Administrativo.
 * Reaproveitável por qualquer componente que precise decidir visibilidade de
 * controles administrativos (atalho "Nova Empresa", botão "Gerenciar Empresas").
 */
export const ADMIN_PROFILES = ['SUPER_ADMIN', 'ADMIN', 'DIRETOR'] as const

/**
 * Requirements 4.3, 5.1, 5.2 — retorna `true` se e somente se `perfil` está
 * contido em `ADMIN_PROFILES`; usada tanto para o atalho "Nova Empresa" quanto
 * para o botão "Gerenciar Empresas".
 */
export function deveExibirAtalhoNovaEmpresa(perfil: string | null): boolean {
  if (perfil === null) {
    return false
  }

  return (ADMIN_PROFILES as readonly string[]).includes(perfil)
}

/**
 * Requirement 5.5 — retorna `false` (oculta busca e rodapé) sempre que
 * `modoGerenciar` for `true`, independentemente do número de empresas;
 * mantém Modo_Gerenciar_Empresas e os elementos do redesenho mutuamente
 * exclusivos.
 */
export function deveExibirElementosRedesign(modoGerenciar: boolean): boolean {
  return !modoGerenciar
}
