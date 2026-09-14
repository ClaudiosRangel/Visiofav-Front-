import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  filtrarEntriesWms,
  idGrupo,
  MENU_CONFIG_PROTEGIDO_HREF,
  type MenuEntryLike,
  type MenuGroupLike,
  type MenuItemLike,
} from './wms-menu-filter'

/**
 * Testes property-based da filtragem de menu do WMS
 * (spec wms-configurar-menus, propriedades P1–P4 do design).
 */

// Coleta todos os hrefs presentes numa lista de entries (itens soltos + itens de grupos).
function coletarHrefs(entries: MenuEntryLike[]): string[] {
  const hrefs: string[] = []
  for (const e of entries) {
    if ('items' in e) hrefs.push(...e.items.map((i) => i.href))
    else hrefs.push(e.href)
  }
  return hrefs
}

// Gerador de href arbitrário (evita colisão com o href protegido por padrão).
const arbHref = fc.string({ minLength: 1, maxLength: 12 }).map((s) => `/wms/${s.replace(/\s/g, '_')}`)

const arbItem: fc.Arbitrary<MenuItemLike> = arbHref.map((href) => ({ href }))

const arbGrupo: fc.Arbitrary<MenuGroupLike> = fc.record({
  label: fc.string({ minLength: 1, maxLength: 10 }),
  items: fc.array(arbItem, { minLength: 1, maxLength: 5 }),
})

const arbEntry: fc.Arbitrary<MenuEntryLike> = fc.oneof(arbItem, arbGrupo)
const arbEntries = fc.array(arbEntry, { maxLength: 8 })

describe('filtrarEntriesWms (property-based)', () => {
  // P1 — Item desabilitado nunca aparece
  // **Validates: Requirements 1.1**
  it('P1 — nenhum href desabilitado aparece no resultado', () => {
    fc.assert(
      fc.property(arbEntries, (entries) => {
        const todos = coletarHrefs(entries).filter((h) => h !== MENU_CONFIG_PROTEGIDO_HREF)
        if (todos.length === 0) return
        // desabilita o primeiro href encontrado
        const alvo = todos[0]
        const res = filtrarEntriesWms(entries, [alvo])
        expect(coletarHrefs(res)).not.toContain(alvo)
      }),
    )
  })

  // P2 — Item habilitado sempre aparece (salvo grupo desabilitado — aqui usamos só itens soltos)
  // **Validates: Requirements 1.2**
  it('P2 — itens soltos habilitados são preservados', () => {
    fc.assert(
      fc.property(fc.array(arbItem, { maxLength: 8 }), fc.array(fc.string(), { maxLength: 3 }), (itens, desabIrrelevantes) => {
        // Remove qualquer id que por acaso coincida com um href presente.
        const presentes = new Set(itens.map((i) => i.href))
        const desab = desabIrrelevantes.filter((d) => !presentes.has(d))
        const res = filtrarEntriesWms(itens, desab)
        // Todos os itens (hrefs únicos) devem continuar presentes.
        for (const it of itens) {
          expect(coletarHrefs(res)).toContain(it.href)
        }
      }),
    )
  })

  // P3 — Grupo desabilitado oculta todos os seus itens
  // **Validates: Requirements 2.1**
  it('P3 — grupo desabilitado remove o grupo e todos os itens', () => {
    fc.assert(
      fc.property(arbGrupo, (grupo) => {
        const res = filtrarEntriesWms([grupo], [idGrupo(grupo.label)])
        expect(res.length).toBe(0)
      }),
    )
  })

  // P4 — Configuração vazia preserva o menu completo
  // **Validates: Requirements 1.3**
  it('P4 — lista vazia de desabilitados preserva todos os hrefs', () => {
    fc.assert(
      fc.property(arbEntries, (entries) => {
        const res = filtrarEntriesWms(entries, [])
        expect(coletarHrefs(res).sort()).toEqual(coletarHrefs(entries).sort())
      }),
    )
  })

  // Salvaguarda — item protegido nunca é filtrado
  // **Validates: Requirements 5.2**
  it('item protegido (Configuração de Menus) nunca é removido, mesmo se listado', () => {
    const entries: MenuEntryLike[] = [
      { href: MENU_CONFIG_PROTEGIDO_HREF },
      { label: 'Config', items: [{ href: MENU_CONFIG_PROTEGIDO_HREF }, { href: '/wms/x' }] },
    ]
    const res = filtrarEntriesWms(entries, [MENU_CONFIG_PROTEGIDO_HREF, '/wms/x'])
    expect(coletarHrefs(res)).toContain(MENU_CONFIG_PROTEGIDO_HREF)
  })

  // Grupo que fica vazio após o filtro não aparece
  // **Validates: Requirements 2.2**
  it('grupo que fica sem itens após o filtro é removido', () => {
    const grupo: MenuGroupLike = { label: 'G', items: [{ href: '/wms/a' }, { href: '/wms/b' }] }
    const res = filtrarEntriesWms([grupo], ['/wms/a', '/wms/b'])
    expect(res.length).toBe(0)
  })
})
