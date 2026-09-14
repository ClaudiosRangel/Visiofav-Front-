/**
 * Filtragem pura dos itens do menu do WMS conforme a configuração de menus
 * desabilitados da empresa (spec wms-configurar-menus).
 *
 * Regras:
 * - id de um item = seu `href` (ex.: `/wms/inventario`).
 * - id de um grupo = `grupo:<label>` (ex.: `grupo:Estoque`).
 * - Item cujo id ∈ `menusDesabilitados` é removido.
 * - Grupo cujo id ∈ `menusDesabilitados` é removido inteiro (com seus itens).
 * - Grupo que fica sem itens após o filtro não é renderizado.
 * - O item protegido (Configuração de Menus) NUNCA é filtrado, mesmo que
 *   apareça na lista de desabilitados (salvaguarda contra estado sem saída).
 *
 * Tipos estruturais mínimos (sem dependência de React) para ser testável
 * isoladamente. Compatível com NavItem/NavGroup do ModuleSidebar via campos.
 */

/** Href da tela de Configuração de Menus — nunca pode ser ocultado. */
export const MENU_CONFIG_PROTEGIDO_HREF = '/wms/configuracoes/menus'

export interface MenuItemLike {
  href: string
}

export interface MenuGroupLike {
  label: string
  items: MenuItemLike[]
}

export type MenuEntryLike = MenuItemLike | MenuGroupLike

export function ehGrupo<T extends MenuEntryLike>(entry: T): entry is T & MenuGroupLike {
  return 'items' in entry
}

/** id estável de um grupo. */
export function idGrupo(label: string): string {
  return `grupo:${label}`
}

/**
 * Filtra as entries do menu do WMS removendo itens/grupos desabilitados.
 * Preserva a ordem e o formato dos grupos (só recria o grupo quando algum
 * item interno é removido). O item protegido nunca é removido.
 *
 * Genérico em `T` para preservar o tipo concreto das entries (NavItem/NavGroup
 * do ModuleSidebar) na saída.
 */
export function filtrarEntriesWms<T extends MenuEntryLike>(
  entries: T[],
  menusDesabilitados: string[],
): T[] {
  const desabilitados = new Set(menusDesabilitados.filter((id) => id !== MENU_CONFIG_PROTEGIDO_HREF))
  const resultado: T[] = []

  for (const entry of entries) {
    if (ehGrupo(entry)) {
      // Grupo inteiro desabilitado → some.
      if (desabilitados.has(idGrupo(entry.label))) continue

      const itensFiltrados = entry.items.filter(
        (it) => it.href === MENU_CONFIG_PROTEGIDO_HREF || !desabilitados.has(it.href),
      )
      // Grupo sem itens após o filtro → não renderiza.
      if (itensFiltrados.length === 0) continue

      // Só recria o objeto se algum item foi removido (preserva referência quando possível).
      if (itensFiltrados.length === entry.items.length) {
        resultado.push(entry)
      } else {
        resultado.push({ ...entry, items: itensFiltrados } as T)
      }
      continue
    }

    // Item solto.
    const item = entry as MenuItemLike
    if (item.href === MENU_CONFIG_PROTEGIDO_HREF || !desabilitados.has(item.href)) {
      resultado.push(entry)
    }
  }

  return resultado
}
