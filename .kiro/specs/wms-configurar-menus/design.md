# Design — Configuração de menus do WMS (desativar/ocultar itens)

## Overview

Adicionar ao módulo WMS uma tela "Configuração de Menus" onde um administrador
pode **desativar** itens do menu lateral do WMS. Um item desativado **some**
completamente da barra lateral (desktop e mobile) — deixa de ser uma opção
navegável, não fica apenas desabilitado.

A configuração é **por empresa** (um admin desliga o item e ele some para todos
os usuários daquela empresa), aplicada inicialmente **somente ao módulo WMS**.
O escopo é intencionalmente restrito ao WMS nesta primeira entrega; a mecânica
é genérica o bastante para estender a outros módulos depois, sem redesenho.

O menu do WMS é definido estaticamente em `MODULE_MENUS.wms` no componente
`ModuleSidebar.tsx`, e já existe um precedente exato: o módulo **PCP** filtra
seus itens em `useModuleEntries` com base em `acessoMenus` carregado do backend.
Este design **reaproveita esse mesmo padrão** para o WMS.

## Architecture

```
Backend (VisioFab.Wms.Back)
  wms-config-menus.routes.ts  (novo)
    GET  /wms/config-menus         → { menusDesabilitados: string[] }   (qualquer usuário WMS)
    PUT  /wms/config-menus         → grava lista                        (só ADMIN/SUPER_ADMIN)
      └── persistência: tabela Parametro, chave por empresa 'wms.menusDesabilitados' (JSON string[])

Frontend (VisioFab.Wms.Front)
  /wms/configuracoes/menus/page.tsx  (nova tela)
    - lista os itens do menu WMS (mesma fonte que o ModuleSidebar)
    - toggle habilitado/desabilitado por item; salva via PUT
  ModuleSidebar.tsx  useModuleEntries()
    - carrega GET /wms/config-menus (como já faz para o PCP)
    - filtra os itens do WMS cujo id ∈ menusDesabilitados (item some da barra)
```

## Identificação estável dos itens de menu

Os itens do WMS não têm hoje um `id` — são identificados por `href` (único) e
`label`. Para a configuração ser estável (independente de reordenação/tradução),
a chave de cada item será o **`href`** (ex.: `/wms/inventario`), que já é único
no menu. Grupos (ex.: "Estoque", "Recebimento") são identificados pelo `label`
do grupo, com prefixo para evitar colisão com hrefs: `grupo:Estoque`.

Regra de grupo: desativar um **grupo** oculta o grupo inteiro; desativar itens
individuais oculta só os itens. Se todos os itens de um grupo forem ocultados,
o grupo não é renderizado (comportamento natural de lista vazia — ver Error
Handling).

## Components and Interfaces

### Backend — `wms-config-menus.routes.ts` (novo)

```ts
// GET /wms/config-menus  — leitura (qualquer usuário do módulo WMS, para o menu decidir)
// Retorna { menusDesabilitados: string[] }
// PUT /wms/config-menus  — escrita (somente ADMIN/SUPER_ADMIN)
//   body: { menusDesabilitados: string[] }

const CHAVE = 'wms.menusDesabilitados'

// getMenusDesabilitados(empresaId): Promise<string[]>
//   lê Parametro { empresaId, chave: CHAVE }; JSON.parse(valor) ?? []

// PUT valida com Zod: z.object({ menusDesabilitados: z.array(z.string()) })
//   upsert em Parametro (mesmo padrão de configuracao-pcp.routes.ts)
```

Isolamento multi-tenant: a leitura/escrita filtra por `empresaId` do usuário
autenticado (via `Parametro.empresaId_chave`). Escrita restrita a
`ADMIN/SUPER_ADMIN` (mesmo guard de `PATCH /pcp/configuracao`).

Registrar a rota no `server.ts` com prefixo `/api/wms` (ou junto do módulo WMS).

### Frontend — filtro no `ModuleSidebar.tsx` (`useModuleEntries`)

Estender o hook para, quando `moduleName === 'wms'`, carregar
`GET /wms/config-menus` (uma vez, como já faz para o PCP com
`/pcp/permissoes/minha`) e filtrar:

```ts
// itemId(entry): href do NavItem, ou `grupo:${label}` do NavGroup
entries = entries.filter((entry) => {
  if (isGroup(entry)) {
    if (menusDesabilitados.includes(`grupo:${entry.label}`)) return false
    // remove itens desabilitados dentro do grupo
    const itens = entry.items.filter((it) => !menusDesabilitados.includes(it.href))
    if (itens.length === 0) return false // grupo vazio some
    grupoFiltrado = { ...entry, items: itens }
    return true
  }
  return !menusDesabilitados.includes(entry.href)
})
```

Aplicar o mesmo filtro no `MobileModuleDrawer` (ambos usam `useModuleEntries`,
então a filtragem no hook cobre os dois — verificar que o drawer consome as
`entries` já filtradas).

### Frontend — tela `/wms/configuracoes/menus/page.tsx` (nova)

- Só acessível a ADMIN/SUPER_ADMIN (guard de perfil, como outras telas de config).
- Deriva a lista de itens/grupos da MESMA fonte do menu WMS. Para evitar
  duplicação de `MODULE_MENUS`, exportar de `ModuleSidebar.tsx` (ou de um novo
  `wms-menu-config.ts`) uma função `listarItensMenuWms(): { grupo, href, label }[]`
  usada tanto pela sidebar quanto por esta tela.
- Renderiza grupos com um `Switch` por item (habilitado/desabilitado) e um
  `Switch` no cabeçalho do grupo (desativa o grupo inteiro).
- Botão "Salvar" → `PUT /wms/config-menus` com a lista de ids desabilitados.
- Adicionar o link para esta tela no grupo "Configuração WMS" do próprio menu
  (`{ label: 'Configuração de Menus', href: '/wms/configuracoes/menus' }`) — e
  esse item nunca pode se auto-desabilitar (ver Error Handling).

## Data Models

Nenhuma tabela/coluna nova. Reutiliza a tabela genérica `Parametro`
(`@@unique([empresaId, chave])`), com:

- chave: `wms.menusDesabilitados`
- valor: JSON `string[]` (lista de ids de item/grupo desabilitados)

**Checklist `database-migrations.md`: nenhum item aplicável — sem alteração de
`schema.prisma`/`migrate-prod.ts`.**

## Correctness Properties

### Property 1: Item desabilitado nunca aparece no menu

Para qualquer configuração `menusDesabilitados` e qualquer item de menu cujo id
∈ `menusDesabilitados`, a lista de entries retornada pelo filtro NÃO contém esse
item (nem como item solto, nem dentro de um grupo).

**Validates: Requirements 1.1**

### Property 2: Item habilitado sempre aparece

Para qualquer item cujo id ∉ `menusDesabilitados`, o filtro preserva o item na
lista (a menos que o grupo pai esteja desabilitado).

**Validates: Requirements 1.2**

### Property 3: Grupo desabilitado oculta todos os seus itens

Se `grupo:<label>` ∈ `menusDesabilitados`, nenhum item daquele grupo aparece,
independentemente do estado individual dos itens.

**Validates: Requirements 2.1**

### Property 4: Configuração vazia preserva o menu completo

`menusDesabilitados = []` → a lista filtrada é idêntica à lista original do WMS
(backward-compatible; sem configuração, tudo visível).

**Validates: Requirements 1.3**

## Error Handling

- **Falha ao carregar `GET /wms/config-menus`** (rede/backend): o menu é
  renderizado COMPLETO (fail-open) — nunca deixar o usuário sem navegação por
  causa da config. Mesma postura tolerante do PCP (`.catch(() => {})`).
- **Item "Configuração de Menus" não pode ser desabilitado**: o backend rejeita
  (ou o frontend impede) incluir o próprio href da tela de config na lista, para
  não criar um estado sem saída (menu que não pode mais ser reconfigurado).
  Salvaguarda no backend (remove o id da config na escrita) + no frontend
  (switch fixo/desabilitado para esse item).
- **Grupo que ficaria vazio**: some da barra naturalmente (lista de itens vazia
  → grupo não renderizado). Não é erro.
- **Escrita por usuário sem perfil admin**: HTTP 403.

## Testing Strategy

- Property-based (fast-check) sobre a função pura de filtragem
  `filtrarEntriesWms(entries, menusDesabilitados)` cobrindo P1–P4.
- Teste de que o item de "Configuração de Menus" nunca é filtrado, mesmo se
  presente na lista de desabilitados (salvaguarda).
- Backend: testes da rota (leitura default vazia; escrita só admin; remoção do
  href protegido).
- `get_diagnostics` limpo nos arquivos tocados; `tsc`/lint sem novos erros.
- Verificação manual: desativar um item → some da barra (desktop e mobile);
  reativar → volta.
